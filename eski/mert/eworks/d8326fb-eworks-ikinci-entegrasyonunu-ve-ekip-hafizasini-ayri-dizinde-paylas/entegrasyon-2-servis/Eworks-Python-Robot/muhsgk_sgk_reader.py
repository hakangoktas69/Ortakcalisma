"""GİB MUHSGK detayındaki işyeri/ay satırları ve salt okunur belgeler."""
import asyncio
import re
from datetime import datetime,timezone
from institution_discovery import safe_origin
from local_files import atomic_json
from source_record_id import canonical_source_id,source_id,action_ids

def normalize_child(source,parent):
    cells=source['cells']
    if len(cells)!=4:raise ValueError('SGK detay sütunları değişti.')
    if cells[1]=='Vergi':return None
    raw_oid=source['id'].removeprefix('row');oid=canonical_source_id(raw_oid)
    if source['id']!='row'+raw_oid:raise ValueError('SGK kaynak satır kimliği eksik.')
    matches=re.findall(r'(?:^|,\s*)(0[1-9]|1[0-2])\s*/\s*(20\d{2})\s*,\s*(\d{17,30})(?:,|$)',cells[1])
    if len(matches)!=1:raise ValueError('SGK işyeri ve ay bilgisi tekil değil.')
    month,year,workplace=matches[0];period=year+'-'+month
    if not parent['period']<=period<=parent['metadata'].get('periodEnd',parent['period']):raise ValueError('SGK dönemi kaynak MUHSGK dışında.')
    return dict(identity=parent['identity'],parentRecordId=parent['recordId'],recordId=oid,
        workplace=workplace,period=period,status=cells[2] or 'Durum belirtilmedi',reference=workplace,
        metadata=dict(description=cells[1],sourcePeriod=cells[0],sourceStatus=cells[2],sourceSgkId=raw_oid,
            observedAt=datetime.now(timezone.utc).isoformat()),_pdfs=[])

async def close_detail(detail):
    close=detail.locator('#bynGoruntu_close')
    if await close.count()!=1 or await close.get_attribute('onclick')!='Windows.close("bynGoruntu", event)':raise ValueError('SGK detay kapatma kontrolü doğrulanamadı.')
    await close.click(timeout=5000)

async def collect_sgk(frame,parent,folder,report,existing_provider=None):
    try:
        return await _collect_sgk(frame,parent,folder,report,existing_provider)
    finally:
        # PDF veya kaynak ayrıştırma hatası açık modal bırakıp sonraki sorguyu engellemez.
        if safe_origin(frame.url)=='https://ebeyanname.gib.gov.tr':
            detail=frame.locator('#bynGoruntu')
            if await detail.count()==1 and await detail.is_visible():await close_detail(detail)

async def _collect_sgk(frame,parent,folder,report,existing_provider=None):
    if parent.get('document')!='MUHSGK':return []
    if safe_origin(frame.url)!='https://ebeyanname.gib.gov.tr':raise ValueError('SGK kaynak kökeni eşleşmedi.')
    detail=frame.locator('#bynGoruntu')
    parent_source_id=source_id(parent)
    parent_action_pattern='(?:'+'|'.join(re.escape(v) for v in action_ids(parent_source_id))+')'
    if await detail.count()==1 and await detail.is_visible():
        if await detail.locator('#tahakkukTable [id="row'+parent_source_id+'"]').count()!=1:await close_detail(detail)
    if await detail.count()!=1 or not await detail.is_visible():
        row=frame.locator('[id="row'+parent_source_id+'"]')
        controls=[]
        for c in await row.locator('img[onclick]').all():
            action=await c.get_attribute('onclick') or ''
            if re.fullmatch(r"beyannameSGKBildirimleriGoster\('"+parent_action_pattern+r"',\s*(?:true|false)\)",action):controls.append(c)
        if len(controls)!=1:raise ValueError('MUHSGK SGK detay kontrolü doğrulanamadı.')
        await controls[0].click(timeout=5000)
    await detail.wait_for(state='visible',timeout=15000)
    for _ in range(60):
        if await detail.locator('#tahakkukTable').count()==1:break
        await asyncio.sleep(.5)
    children=[];seen=set();processed=0;expected_total=None
    while True:
        if (folder/'cancel').exists():raise ValueError('İş iptal edildi.')
        source=await detail.locator('#tahakkukTable').evaluate('''t=>({headers:Array.from(t.rows[0].cells).map(c=>c.innerText.trim()),rows:Array.from(t.rows).slice(1).map(r=>({id:r.id,cells:Array.from(r.cells).map(c=>c.innerText.trim()),controls:Array.from(r.querySelectorAll('img[onclick]')).map(c=>({title:c.title,action:c.getAttribute('onclick')}))}))})''')
        if source['headers']!=['Vergilendirme Dönemi','Açıklama','Vergi Tahakkuku Durumu','']:raise ValueError('SGK detay başlıkları doğrulanamadı.')
        next_page=detail.locator('input[title="Sonraki Sayfa"]')
        if await next_page.count()!=1:raise ValueError('SGK sayfalama kontrolü eksik.')
        paging=await next_page.evaluate("el=>({text:el.closest('tr').innerText.trim(),disabled:el.disabled})")
        counter=re.fullmatch(r'\s*(\d+)\s*-\s*(\d+)\s*/\s*(\d+)\s*',paging['text'])
        if not counter:raise ValueError('SGK liste toplamı doğrulanamadı.')
        start,end,total=map(int,counter.groups())
        if expected_total is None:expected_total=total
        if start!=processed+1 or end-start+1!=len(source['rows']) or total!=expected_total:raise ValueError('SGK sayfa kapsamı değişti.')
        for source_row in source['rows']:
            if source_row['id'] in seen:raise ValueError('SGK listesinde mükerrer satır.')
            seen.add(source_row['id']);child=normalize_child(source_row,parent)
            if child is None:continue
            pdf_controls=[];unknown=[]
            child_action_pattern='(?:'+'|'.join(re.escape(v) for v in action_ids(child['metadata']['sourceSgkId']))+')'
            for c in source_row['controls']:
                action=c['action']
                if re.fullmatch(r"mesajButtonClick\('"+child_action_pattern+r"'\)",action):continue
                matched=False
                for function,kind,title in (
                    ('sgkTahakkukGoruntule','sgk_accrual','Tahakkuku PDF Formatında görüntülemek için tıklayınız.'),
                    ('sgkHizmetGoruntule','sgk_service','Hizmet Dökümünü PDF Formatında görüntülemek için tıklayınız.')):
                    expected=function+r"\('"+parent_action_pattern+r"','"+child_action_pattern+r"',\s*(?:true|false),\s*(?:true|false)\)"
                    if c['title']==title and re.fullmatch(expected,action):
                        if any(item[0]==kind for item in pdf_controls):raise ValueError('SGK PDF kontrolü tekil değil.')
                        pdf_controls.append((kind,c));matched=True;break
                if not matched:unknown.append(c)
            if unknown:
                atomic_json(folder/'sgk-pdf-controls.json',dict(parentRecordId=parent['recordId'],row=source_row))
                raise ValueError('SGK belge kontrolleri değişti; doğrulanamayan işlem çalıştırılmadı.')
            from declaration_document_adapter import download_one,DocumentUnavailable
            child['metadata']['availableDocumentKinds']=[kind for kind,_ in pdf_controls]
            existing=await existing_provider(child) if existing_provider else []
            for kind,control in pdf_controls:
                if any(f.get('kind')==kind for f in existing):continue
                target=detail.locator('#tahakkukTable [id="'+source_row['id']+'"] img[onclick]')
                candidates=[c for c in await target.all() if await c.get_attribute('onclick')==control['action'] and await c.get_attribute('title')==control['title']]
                if len(candidates)!=1:raise ValueError('SGK PDF kaynak satırı değişti.')
                report(folder,'running','GİB '+('SGK tahakkuk' if kind=='sgk_accrual' else 'SGK hizmet listesi')+' PDF dosyası indiriliyor.')
                try:
                    try:raw=await download_one(frame,candidates[0],kind,folder)
                    except DocumentUnavailable:raise
                    except ValueError:
                        # Salt okunur PDF isteği için tek sınırlı yeniden deneme; kaynak kayıt-yok yanıtı tekrarlanmaz.
                        await asyncio.sleep(2.2)
                        raw=await download_one(frame,candidates[0],kind,folder)
                    child['_pdfs'].append((kind,raw))
                except ValueError as exc:
                    child.setdefault('documentWarnings',[]).append(dict(kind=kind,message=str(exc),
                        sourceUnavailable=isinstance(exc,DocumentUnavailable)))
            if child.get('documentWarnings'):
                child['metadata']['documentWarnings']=child['documentWarnings']
            # Uzun taramada bulut bağlantısı kesilse de doğrulanmış kaynak belgeleri kaybolmaz.
            from declaration_documents import validate_pdf
            cache=folder/'sgk-pdf-cache'/child['recordId'];cache.mkdir(parents=True,exist_ok=True)
            local_files=[]
            for kind,raw in child['_pdfs']:
                digest=validate_pdf(raw);filename=kind+'-'+digest+'.pdf'
                (cache/filename).write_bytes(raw)
                local_files.append(dict(kind=kind,sha256=digest,filename=filename))
            atomic_json(cache/'record.json',dict(sourceOrigin='https://ebeyanname.gib.gov.tr',
                record={k:v for k,v in child.items() if k!='_pdfs'},files=local_files))
            children.append(child)
        processed=end
        if end==total:
            if not paging['disabled']:raise ValueError('SGK son sayfası doğrulanamadı.')
            break
        if paging['disabled']:raise ValueError('SGK sayfası eksik.')
        await next_page.click(timeout=5000)
        for _ in range(100):
            if (await next_page.evaluate("el=>el.closest('tr').innerText.trim()"))!=paging['text']:break
            await asyncio.sleep(.1)
        else:raise ValueError('Sonraki SGK sayfası yüklenmedi.')
    await close_detail(detail)
    parent['sgkSyncStatus']='observed' if children else 'no_sgk_rows_observed'
    return children
