"""Aynı oturumda gözlenmiş salt okunur sorgunun ikinci HTTP taşıma yolu.

Token ve istek gövdesi yalnız bellektedir. Kaynak HTML çalıştırılmaz.
"""
import asyncio
import re
from html.parser import HTMLParser
from urllib.parse import parse_qsl, urlsplit, urlencode
from declaration_reader import HEADERS

ORIGIN='https://ebeyanname.gib.gov.tr'
FIELDS={'TOKEN','cmd','sorguTipiZ','baslangicTarihi','bitisTarihi'}
MAX_BYTES=2_000_000


def source_url(url):
    p=urlsplit(url)
    return (p.scheme=='https' and p.hostname=='ebeyanname.gib.gov.tr'
        and p.port in (None,443) and not p.username and not p.password and p.path=='/dispatch')


def date_format(value,expected):
    for fmt in ('%d%m%Y','%Y%m%d','%d.%m.%Y','%d/%m/%Y','%Y-%m-%d','%d-%m-%Y'):
        if expected.strftime(fmt)==value:return fmt
    raise ValueError('Servis sorgusunun tarih kapsamı doğrulanamadı.')


class ListHTML(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables=[];self.stack=[];self.rows=[];self.cells=[];self.skip=0

    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag in ('script','style'):self.skip+=1;return
        if self.skip:return
        if tag=='table':
            table=[];self.tables.append(table);self.stack.append(table)
        elif tag=='tr' and self.stack:
            row={'cells':[],'text':[],'id':a.get('id',''),'next':[]}
            self.stack[-1].append(row);self.rows.append(row)
        elif tag in ('td','th') and self.rows:
            cell=[];self.rows[-1]['cells'].append(cell);self.cells.append(cell)
        elif tag=='input' and self.rows and a.get('title')=='Sonraki Sayfa':
            self.rows[-1]['next'].append('disabled' in a)
        elif tag in ('br','div','p','li'):self.handle_data(' ')

    def handle_endtag(self,tag):
        if tag in ('script','style'):
            self.skip=max(0,self.skip-1);return
        if self.skip:return
        if tag in ('div','p','li'):self.handle_data(' ')
        elif tag in ('td','th') and self.cells:self.cells.pop()
        elif tag=='tr' and self.rows:self.rows.pop()
        elif tag=='table' and self.stack:self.stack.pop()

    def handle_data(self,text):
        if self.skip:return
        for row in self.rows:row['text'].append(text)
        # GİB durum hücreleri iç içe tablo içerir. Metin dış hücrenin de
        # textContent/innerText kapsamındadır; yalnız en iç hücreye yazma.
        for cell in self.cells:cell.append(text)


def clean(parts):return re.sub(r'\s+',' ',''.join(parts)).strip()


def parse_list(html):
    if not isinstance(html,str) or len(html.encode('utf-8'))>MAX_BYTES:
        raise ValueError('Servis yanıtı boyut sınırını aştı.')
    parser=ListHTML();parser.feed(html)
    tables=[t for t in parser.tables if t and [clean(c) for c in t[0]['cells']]==HEADERS]
    if len(tables)!=1:raise ValueError('Servis yanıtında doğrulanmış beyanname tablosu yok; boş sonuç kabul edilmedi.')
    records=[]
    for row in tables[0][1:]:
        if len(row['cells'])!=10:raise ValueError('Servis sonuç satırının sütun sayısı değişti.')
        records.append({'id':row['id'],'cells':[clean(c) for c in row['cells']]})
    paging=[r for t in parser.tables for r in t if r['next']]
    if len(paging)!=1 or len(paging[0]['next'])!=1:
        raise ValueError('Servis sayfalama kontrolü doğrulanamadı.')
    count=re.fullmatch(r'(\d+)\s*-\s*(\d+)\s*/\s*(\d+)',clean(paging[0]['text']))
    if not count:raise ValueError('Servis sonuç toplamı doğrulanamadı.')
    start,end,total=map(int,count.groups());disabled=paging[0]['next'][0]
    if not records or start!=1 or end!=len(records) or total<end or disabled!=(end==total):
        raise ValueError('Servis sonuç sayfalaması tutarsız; eksik sonuç başarı sayılmadı.')
    if len({r['id'] for r in records})!=len(records):raise ValueError('Servis listesinde mükerrer satır var.')
    return {'records':records,'totalRows':total,'hasMorePages':not disabled}


def compare_records(browser,service):
    """Görünür boşluk farkını tolere et; kimlik, sıra ve hücre içeriğini değiştirme."""
    def canonical(rows):
        return [(r['id'],[re.sub(r'\s+','',c) for c in r['cells']]) for r in rows]
    return canonical(browser)==canonical(service)


class DeclarationService:
    """Yalnız yetkili tarayıcı sorgusundan alınan şablon; keyfi komut göndermez."""
    def __init__(self,context,start,end):
        self.context=context;self.start=start;self.end=end;self.payload=None;self.last_query=0.0;self.error=False

    def capture(self,request):
        if request.method!='POST' or not source_url(request.url):return
        body=request.post_data or ''
        if len(body)>65536:return
        try:pairs=parse_qsl(body,keep_blank_values=True,strict_parsing=True,max_num_fields=10)
        except ValueError:return
        fields=dict(pairs)
        if set(fields)!=FIELDS or len(pairs)!=len(FIELDS):return
        if not fields['TOKEN'] or not fields['cmd'] or fields['sorguTipiZ'] not in ('on','true','1'):return
        try:
            date_format(fields['baslangicTarihi'],self.start)
            date_format(fields['bitisTarihi'],self.end)
        except ValueError:
            self.error=True;return
        if self.payload is not None:self.error=True;return
        self.payload=fields
        self.last_query=asyncio.get_running_loop().time()

    async def query(self):
        if self.error or self.payload is None:raise ValueError('Yetkili salt okunur sorgu şablonu doğrulanamadı.')
        delay=1.5-(asyncio.get_running_loop().time()-self.last_query)
        if delay>0:await asyncio.sleep(delay)
        self.last_query=asyncio.get_running_loop().time()
        response=None
        try:
            response=await self.context.request.post(ORIGIN+'/dispatch',
                data=urlencode(self.payload),headers={'Content-Type':'application/x-www-form-urlencoded',
                    'X-Requested-With':'XMLHttpRequest','Referer':ORIGIN+'/dispatch'},
                timeout=20000,max_redirects=0,fail_on_status_code=False)
            if response.status in (401,403):raise ValueError('GİB servis oturumu geçersiz; yeniden giriş gerekli.')
            if response.status==429:raise ValueError('GİB hız sınırı bildirdi; yeniden sorgu gönderilmedi.')
            if response.status!=200 or not source_url(response.url):raise ValueError('GİB servis yanıtı veya yönlendirmesi doğrulanamadı.')
            content_type=response.headers.get('content-type','').lower()
            if not content_type.startswith('text/html'):raise ValueError('GİB servis yanıt türü değişti.')
            length=response.headers.get('content-length','')
            if length.isdigit() and int(length)>MAX_BYTES:raise ValueError('GİB servis yanıtı çok büyük.')
            body=await response.body()
            if len(body)>MAX_BYTES:raise ValueError('GİB servis yanıtı çok büyük.')
            charset=re.search(r'charset\s*=\s*([\w-]+)',content_type)
            encoding=charset[1] if charset and charset[1] in ('utf-8','iso-8859-9','windows-1254') else 'utf-8'
            return parse_list(body.decode(encoding,errors='strict'))
        except ValueError:raise
        except Exception:
            # İstek hatalarında URL, token veya gövde exception üzerinden sızmasın.
            raise ValueError('GİB doğrudan servis bağlantısı kurulamadı; sonuç aktarılmadı.') from None
        finally:
            if response is not None:await response.dispose()

    def close(self):
        if self.payload:self.payload.clear()
        self.payload=None
