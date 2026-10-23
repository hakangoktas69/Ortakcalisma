"""Gözlenen listeyi doğrular; isteğe bağlı belge toplayıcısını sayfalama öncesi çağırır."""
import re
import asyncio
from urllib.parse import urlsplit
from declaration_adapter import normalize_declaration_rows
from source_record_id import canonical_source_id
_DIAGNOSTIC_FOLDER=None


HEADERS=['','Beyanname Türü','TC Kimlik Numarası / Vergi Kimlik Numarası',
    'Ad Soyad/Unvan(*)','Vergi Dairesi / Malmüdürlüğü','Vergilendirme Dönemi',
    'Şube No','Yükleme Zamanı','Vergi Tahakkuku Durumu','SGK Tahakkuku Durumu']


async def read_declaration_page(frame,*,identity,year,upload_month,allow_partial=False,upload_year_only=False,upload_range=None,period_range=None,identity_aliases=None,diagnostic_folder=None):
    diagnostic_folder=diagnostic_folder or _DIAGNOSTIC_FOLDER or getattr(frame.page,'_eworks_diagnostic_folder',None)
    source=urlsplit(frame.url)
    if (source.scheme!='https' or source.hostname!='ebeyanname.gib.gov.tr'
            or source.username or source.password or source.port not in (None,443)):
        raise ValueError('Beyanname kaynak kökeni doğrulanamadı.')
    tables=await frame.locator('table').evaluate_all('''(tables,expected)=>tables.flatMap(table=>{
        if(!table.getClientRects().length||getComputedStyle(table).visibility==='hidden')return [];
        const rows=Array.from(table.rows||[]);if(!rows.length)return [];
        const headers=Array.from(rows[0].cells).map(c=>(c.innerText||'').replace(/\\s+/g,' ').trim());
        if(JSON.stringify(headers)!==JSON.stringify(expected))return [];
        return [{rows:rows.slice(1).filter(r=>r.cells.length===10).map(r=>({
            sourceRowId:(r.id||'').replace(/^row/,''),sourceTitle:r.title||'',
            identity:(r.cells[2].innerText||'').replace(/\\D/g,''),document:r.cells[1].innerText.trim(),
            period:r.cells[5].innerText.trim(),uploadedAt:r.cells[7].innerText.trim(),
            taxStatus:r.cells[8].innerText.trim(),sgkStatus:r.cells[9].innerText.trim()}))}];
    })''',HEADERS)
    if not tables:return None
    if len(tables)!=1:raise ValueError('Beyanname listesi tekil değil.')
    controls=await frame.locator('input[title="Sonraki Sayfa"]').all()
    visible=[c for c in controls if await c.is_visible()]
    if len(visible)!=1:raise ValueError('Sayfalama doğrulanamadı.')
    paging=await visible[0].evaluate("el=>({disabled:el.disabled,text:(el.closest('tr')?.innerText||'').trim()})")
    count=re.fullmatch(r'\s*(\d+)\s*-\s*(\d+)\s*/\s*(\d+)\s*',paging['text'])
    rows=tables[0]['rows']
    complete=count and int(count[1])==1 and int(count[2])==len(rows) and int(count[3])==len(rows) and paging['disabled']
    if not complete and not (allow_partial and count and int(count[2])-int(count[1])+1==len(rows) and int(count[2])<=int(count[3])):
        raise ValueError('Liste tek sayfada tam değil; sayfalama adaptörü gerekli.')
    for row in rows:
        title=row.pop('sourceTitle')
        try:canonical_source_id(row['sourceRowId'])
        except ValueError:
            if diagnostic_folder:
                from local_files import atomic_json
                atomic_json(diagnostic_folder/'source-reference-diagnostic.json',dict(sourceRowId=row['sourceRowId'],sourceTitle=title,document=row['document'],identity=identity))
            raise
        filename=re.match(r'^([A-Za-z0-9_-]+\.xml)(?:\s|$)',title)
        if filename:row['sourceFilename']=filename[1]
        elif len(row['sourceRowId'])>=10 and canonical_source_id(row['sourceRowId']):
            # Bazı GİB satırları title içinde XML adı sunmaz. Görünür kaydın
            # uzun kaynak kimliği korunur; dosya adı veya belge içeriği uydurulmaz.
            row['sourceReferenceType']='source_record_id'
        else:
            if diagnostic_folder:
                from local_files import atomic_json
                atomic_json(diagnostic_folder/'source-reference-diagnostic.json',dict(sourceRowId=row['sourceRowId'],sourceTitle=title,
                    document=row['document'],identity=identity))
            raise ValueError('Kaynak dosya veya kalıcı kayıt kimliği bulunamadı.')
    normalized=normalize_declaration_rows(rows,identity=identity,year=year,
        upload_month=upload_month,expected_count=len(rows),upload_year_only=upload_year_only,upload_range=upload_range,period_range=period_range,identity_aliases=identity_aliases)
    return dict(schema='eworks.declaration.observation.v1',sourceOrigin='https://ebeyanname.gib.gov.tr',
        year=year,uploadMonth=upload_month,observedCount=len(normalized),
        pageRange=paging['text'],singlePageVerified=bool(complete),records=normalized,
        imported=False,authorizationVerified=False)


async def read_declaration_pages(frame,*,identity,year,upload_month,upload_range=None,period_range=None,identity_aliases=None,document_collector=None):
    """Yalnızca gözlenen Sonraki Sayfa kontrolüyle tam listeyi okur."""
    rows=[];seen=set();total=None
    while True:
        page=await read_declaration_page(frame,identity=identity,year=year,upload_month=upload_month,
            allow_partial=True,upload_year_only=True,upload_range=upload_range,period_range=period_range,identity_aliases=identity_aliases,
            diagnostic_folder=getattr(document_collector,'folder',None))
        if page is None:
            if rows:raise ValueError('Liste kayboldu.')
            return None
        start,end,count=map(int,re.fullmatch(r'\s*(\d+)\s*-\s*(\d+)\s*/\s*(\d+)\s*',page['pageRange']).groups())
        if total is None:total=count
        if start!=len(rows)+1 or count!=total or total>100000:raise ValueError('Sayfalama toplamı değişti.')
        for row in page['records']:
            if row['recordId'] in seen:raise ValueError('Sayfalarda mükerrer kayıt.')
            seen.add(row['recordId']);rows.append(row)
        if document_collector is not None and page['records']:
            await document_collector.collect(frame,page['records'])
        control=frame.locator('input[title="Sonraki Sayfa"]')
        if await control.count()!=1:raise ValueError('Sayfalama kontrolü tekil değil.')
        if end==total:
            if not await control.is_disabled():raise ValueError('Son sayfa doğrulanamadı.')
            return rows
        if await control.is_disabled():raise ValueError('Eksik sayfa.')
        await control.click(timeout=5000)
        for _ in range(100):
            await asyncio.sleep(.1)
            current=await control.evaluate("el=>(el.closest('tr')?.innerText||'').trim()")
            if current!=page['pageRange']:break
        else:raise ValueError('Sonraki sayfa yüklenmedi.')
