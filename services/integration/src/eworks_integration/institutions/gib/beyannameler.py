"""e-Beyanname listesi ve belgeleri — eski robotun canlı gözleme dayalı mantığı (declaration_sync, declaration_reader,
declaration_adapter, institution_discovery.declaration_pilot_query, declaration_document_adapter).

Erişim kuralı (eski kurum incelemesi): beyanname yalnız AYNI OTURUMDA okunan sözleşme listesinde geçerli "Aracılık ve
Sorumluluk" sözleşmesi bulunan mükellef için sorgulanır; kanıt (sözleşme numaraları) sonuçla birlikte yayımlanır.
Fail-closed: kimlik, dönem, yükleme tarihi, satır kimliği veya sayfa toplamı doğrulanmazsa o sorgunun sonucu yazılmaz;
GİB'in açık "bulunamamıştır" yanıtı dışındaki uyarılar boş sonuç sayılmaz. Salt okunur: gönderme/onay eylemi yoktur.
Not: canlı e-Beyanname ekranı bu taşımada henüz yeniden doğrulanmadı (D33).
"""
from __future__ import annotations

import asyncio
import calendar
import hashlib
import io
import re
import time
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from urllib.parse import unquote, urlsplit
from zoneinfo import ZoneInfo

from ...core.hatalar import KaynakEngelledi
from ...transports.robot.tarayici import gib_alani
from .ebeyanname_servis import Kapsam
from .gezinme import confirm_transition, visible_target
from .muhsgk import sgk_bildirimleri

TR = ZoneInfo('Europe/Istanbul')
KOKEN = 'https://ebeyanname.gib.gov.tr'
HEADERS = ['', 'Beyanname Türü', 'TC Kimlik Numarası / Vergi Kimlik Numarası', 'Ad Soyad/Unvan(*)', 'Vergi Dairesi / Malmüdürlüğü',
           'Vergilendirme Dönemi', 'Şube No', 'Yükleme Zamanı', 'Vergi Tahakkuku Durumu', 'SGK Tahakkuku Durumu']
PDF_BASLIK = {'declaration': ('Beyannameyi PDF Formatında görüntülemek için tıklayınız.', 'beyannameGoruntule'),
              'tax_accrual': ('Tahakkuku PDF Formatında görüntülemek için tıklayınız.', 'tahakkukGoruntule')}
BOS_SONUC = {'hata: sorgu yaptiginiz kriterlere uyan beyanname bulunamamistir.', 'sorgu yaptiginiz kriterlere uyan beyanname bulunamamistir.'}
HIZ_UYARISI = 'hata: iki istek arasi en az 1 sn olabilir.'
ARACILIK = {'aracilik ve sorumluluk sozlesmesi', 'elektronik beyanname aracilik ve sorumluluk sozlesmesi'}
PDF_SINIR = 20 * 1024 * 1024
SAYAC = re.compile(r'\s*(\d+)\s*-\s*(\d+)\s*/\s*(\d+)\s*')


class BeyannameHatasi(ValueError):
    """Sorgu ya da liste doğrulanamadı; o kapsamın sonucu yazılmaz."""


@dataclass(frozen=True)
class BelgeIstegi:
    """Hangi belgeler indirilir: beyanname + tahakkuk ve/veya MUHSGK SGK bildirimleri (tahakkuk + hizmet listesi)."""
    kaydet: object
    beyanname: bool = True
    sgk: bool = True


def _engel_varsa(tasima) -> None:
    """Servis yolunda kurum oturumu reddettiyse ya da hız sınırı bildirdiyse iş durur (D38): kalan kapsam sorgulanmaz."""
    if tasima is not None and tasima.engel is not None:
        raise tasima.engel


def _tasima_hatasi(tasima) -> None:
    """Servis taşıması bu isteği doğrulayamadıysa o kapsam düşer (fail-closed); engel ise iş durur."""
    _engel_varsa(tasima)
    h = tasima.hata_al() if tasima is not None else None
    if h is not None:
        raise BeyannameHatasi(str(h))


def belge_istegi(deger) -> BelgeIstegi | None:
    if deger is None or isinstance(deger, BelgeIstegi):
        return deger
    return BelgeIstegi(deger)


def sade(metin: str) -> str:
    """Karşılaştırma için: küçük harf, Türkçe harfler ASCII, aksan yok."""
    s = (metin or '').replace('İ', 'i').replace('I', 'ı').casefold()
    s = s.translate(str.maketrans('çğıöşü', 'cgiosu'))
    return ''.join(c for c in unicodedata.normalize('NFKD', s) if not unicodedata.combining(c))


def aracilik_sozlesmesi(tur: str) -> bool:
    return ' '.join(sade(tur).split()) in ARACILIK


def erisim_kaniti(sozlesmeler: list[dict]) -> dict[str, dict]:
    """Aynı oturumdaki sözleşme listesinden mükellef → {sözleşme numaraları, kimlik eşleri}. Yalnız Aracılık ve Sorumluluk."""
    sonuc: dict[str, dict] = {}
    for s in sozlesmeler:
        if not aracilik_sozlesmesi(s.get('type', '')) or not (s.get('number') or '').strip():
            continue
        kimlikler = [v for v in (s.get('taxNumber'), s.get('identityNumber')) if isinstance(v, str) and re.fullmatch(r'\d{10,11}', v)]
        for k in kimlikler:
            e = sonuc.setdefault(k, {'contractNumbers': set(), 'aliases': set()})
            e['contractNumbers'].add(s['number'].strip())
            e['aliases'].update(kimlikler)
    return {k: {'contractNumbers': sorted(v['contractNumbers']), 'aliases': sorted(v['aliases'])} for k, v in sonuc.items()}


def kaynak_kimligi(deger: str) -> str:
    """GİB'in opak satır kimliği (source_record_id.canonical_source_id): güvenli değilse özetine çevrilir."""
    if not isinstance(deger, str) or not 1 <= len(deger) <= 300:
        raise BeyannameHatasi('Kaynak kayıt kimliği geçersiz.')
    cozulmus = deger
    if '%' in deger:
        if re.search(r'%(?![0-9A-Fa-f]{2})', deger):
            raise BeyannameHatasi('Kaynak kimlik kodlaması geçersiz.')
        cozulmus = unquote(deger, encoding='utf-8', errors='strict')
    if (not 1 <= len(cozulmus) <= 100 or '..' in cozulmus
            or any(c in '\'"\\`' or c.isspace() or unicodedata.category(c)[0] in 'CZ' for c in cozulmus)):
        raise BeyannameHatasi('Kaynak kayıt kimliği karakterleri doğrulanamadı.')
    if re.fullmatch(r'[A-Za-z0-9_-]{1,100}', deger):
        return deger
    return 'encoded-' + hashlib.sha256(cozulmus.encode('utf-8')).hexdigest()


def aylik_kapsam(bas: date, bit: date) -> list[tuple[date, date]]:
    """Sorgu aralığını takvim aylarına böler (GİB formu tek yıl ister; her ay ayrı sorgu)."""
    if bas > bit:
        raise BeyannameHatasi('Tarih aralığı geçersiz.')
    parcalar, imlec = [], bas
    while imlec <= bit:
        son = min(bit, date(imlec.year, imlec.month, calendar.monthrange(imlec.year, imlec.month)[1]))
        parcalar.append((imlec, son))
        imlec = son + timedelta(days=1)
    return parcalar


def satirlari_dogrula(satirlar: list[dict], *, kimlik: str, esler: list[str], bas: date, bit: date) -> list[dict]:
    """declaration_adapter.normalize_declaration_rows: başka mükellefe ait satır, aralık dışı tarih, bozuk dönem → hata."""
    if not re.fullmatch(r'\d{10,11}', kimlik):
        raise BeyannameHatasi('Hedef kimlik geçersiz.')
    kabul = set(esler or [kimlik]) | {kimlik}
    sonuc, gorulen = [], set()
    for r in satirlar:
        if r.get('identity') not in kabul:
            raise BeyannameHatasi('Başka mükellefe ait satır.')
        ham = r.get('sourceRowId', '')
        rid = kaynak_kimligi(ham)
        if rid in gorulen:
            raise BeyannameHatasi('Kaynak satır kimliği mükerrer.')
        gorulen.add(rid)
        tur = r.get('document', '')
        if not re.fullmatch(r'[A-Z0-9_-]{1,30}', tur):
            raise BeyannameHatasi('Beyanname türü doğrulanamadı.')
        d = re.fullmatch(r'(0[1-9]|1[0-2])/(\d{4})-(0[1-9]|1[0-2])/(\d{4})', r.get('period', ''))
        if not d or (int(d[2]), int(d[1])) > (int(d[4]), int(d[3])):
            raise BeyannameHatasi('Vergilendirme dönemi okunamadı.')
        try:
            yuklendi = datetime.strptime(r.get('uploadedAt', ''), '%d.%m.%Y - %H:%M:%S').replace(tzinfo=TR)
        except ValueError:
            raise BeyannameHatasi('Yükleme zamanı okunamadı.') from None
        if not bas <= yuklendi.date() <= bit:
            raise BeyannameHatasi('Yükleme tarihi sorgu aralığı dışında.')
        durum = r.get('taxStatus', '')
        if not isinstance(durum, str) or len(durum) > 200 or any(ord(c) < 32 and c not in '\r\n\t' for c in durum):
            raise BeyannameHatasi('Vergi tahakkuk durumu okunamadı.')
        dosya = r.get('sourceFilename', '')
        if dosya and re.fullmatch(r'[A-Za-z0-9_-]+\.xml', dosya) and kabul.intersection(dosya.split('_')):
            ref, ref_turu = dosya, 'source_filename'
        elif not dosya and len(ham) >= 10:
            ref, ref_turu = ham, 'source_record_id'  # GİB bazı satırlarda XML adı vermez; kalıcı kimlik korunur, ad uydurulmaz
        else:
            raise BeyannameHatasi('Kaynak dosya referansı doğrulanamadı.')
        sonuc.append({
            'recordId': rid, 'type': tur, 'periodStart': f'{d[2]}-{d[1]}', 'periodEnd': f'{d[4]}-{d[3]}',
            'uploadedAt': yuklendi.isoformat(), 'taxStatus': ' '.join(durum.split()) or 'Durum belirtilmedi',
            'sgkStatus': ' '.join((r.get('sgkStatus') or '').split())[:200], 'branch': (r.get('branch') or '')[:20],
            'reference': ref[:200], 'referenceType': ref_turu, '_ham': ham,
        })
    return sonuc


def pdf_dogrula(ham: bytes) -> str:
    """declaration_documents.validate_pdf: başlık, son işaret, boyut, okunabilir sayfa; şifreli PDF kabul edilmez."""
    if not isinstance(ham, bytes) or not 100 <= len(ham) <= PDF_SINIR or not ham.startswith(b'%PDF-') or b'%%EOF' not in ham[-4096:]:
        raise BeyannameHatasi('İndirilen yanıt geçerli PDF değil; belge kaydedilmedi.')
    from pypdf import PdfReader
    try:
        okuyucu = PdfReader(io.BytesIO(ham), strict=False)
        if okuyucu.is_encrypted or not 1 <= len(okuyucu.pages) <= 2000:
            raise ValueError()
        for s in okuyucu.pages:
            s.mediabox  # noqa: B018 — sayfa ağacı gerçekten okunabilir mi
    except Exception:  # noqa: BLE001
        raise BeyannameHatasi('PDF okunamadı; belge kaydedilmedi.') from None
    return hashlib.sha256(ham).hexdigest()


def guvenilir_pdf_kaynagi(url: str) -> bool:
    u = urlsplit(url)
    return u.scheme == 'https' and u.hostname == 'ebeyanname.gib.gov.tr' and u.port in (None, 443) and not u.username and not u.password


async def _beklet(sahip, ad: str, aralik: float):
    """İki kurum isteği arasında asgari süre (GİB: 'İki istek arası en az 1 sn')."""
    kalan = aralik - (time.monotonic() - getattr(sahip, ad, 0.0))
    if kalan > 0:
        await asyncio.sleep(kalan)
    setattr(sahip, ad, time.monotonic())


async def pdf_yakala(context, kontrol, sure_sn: float = 40) -> bytes:
    """Satır içi PDF kontrolünü tıklar; yalnız ebeyanname kökeninden gelen PDF yanıtını ya da indirmesini kabul eder."""
    dongu = asyncio.get_running_loop()
    sonuc: asyncio.Future = dongu.create_future()
    gorevler: set[asyncio.Task] = set()
    once = set(context.pages)

    def koy(deger):
        if not sonuc.done():
            sonuc.set_result(deger)

    async def yanit_govdesi(yanit):
        try:
            if yanit.status >= 400:
                koy(BeyannameHatasi('GİB belge yanıtı alınamadı; dosya kaydedilmedi.'))  # beklemeden düş
            elif yanit.status == 200 and 'pdf' in (yanit.headers.get('content-type') or '').lower():
                koy(await yanit.body())
            elif yanit.status == 200 and 'text/html' in (yanit.headers.get('content-type') or '').lower() and yanit.request.resource_type == 'document':
                metin = sade(re.sub(r'<[^>]+>', ' ', await yanit.text()))
                if 'kayit yok' in metin or 'islem basarisiz' in metin:
                    koy(BeyannameHatasi('GİB belgeyi sunmadı (kayıt yok).'))
        except Exception:  # noqa: BLE001 — gövde indirmeye devredilmiş olabilir
            pass

    async def indirme(ind):
        try:
            if guvenilir_pdf_kaynagi(ind.url):
                yol = await ind.path()
                if yol:
                    koy(await asyncio.to_thread(lambda: open(yol, 'rb').read(PDF_SINIR + 1)))
        except Exception:  # noqa: BLE001
            pass

    def zamanla(coro):
        g = asyncio.ensure_future(coro)
        gorevler.add(g)
        g.add_done_callback(gorevler.discard)

    def yanit_olayi(yanit):
        if guvenilir_pdf_kaynagi(yanit.url):
            zamanla(yanit_govdesi(yanit))

    def indirme_olayi(ind):
        zamanla(indirme(ind))

    def sayfa_olayi(p):
        p.on('download', indirme_olayi)

    context.on('response', yanit_olayi)
    context.on('page', sayfa_olayi)
    for p in once:
        p.on('download', indirme_olayi)
    try:
        await _beklet(context, '_eworks_pdf_son', 1.2)
        await kontrol.click(timeout=5000)
        deger = await asyncio.wait_for(sonuc, sure_sn)
        if isinstance(deger, Exception):
            raise deger
        return deger
    except asyncio.TimeoutError:
        raise BeyannameHatasi('GİB PDF yanıtı alınamadı; dosya kaydedilmedi.') from None
    finally:
        context.remove_listener('response', yanit_olayi)
        context.remove_listener('page', sayfa_olayi)
        for p in context.pages:
            p.remove_listener('download', indirme_olayi)
            if p not in once and not p.is_closed():
                await p.close()
        for g in tuple(gorevler):
            g.cancel()


def _ebyn_cerceveleri(page):
    return [f for f in page.frames if urlsplit(f.url).scheme == 'https' and urlsplit(f.url).hostname == 'ebeyanname.gib.gov.tr']


async def _sorgu_cercevesi(page):
    adaylar = []
    for f in _ebyn_cerceveleri(page):
        alan = f.locator('input[name="vergiNo"]')
        if await alan.count() == 1 and await alan.is_visible():
            adaylar.append(f)
    return adaylar[0] if len(adaylar) == 1 else None


async def ebeyanname_ac(context, ana_adres: str, ilerleme=None, sure_sn: float = 90):
    """Uygulama seçim ekranından e-Beyanname'ye geçer ve "Beyanname Ara" formunu açar → (sayfa, çerçeve)."""
    for p in list(context.pages):
        await p.close()
    sayfa = await context.new_page()
    await sayfa.goto(ana_adres, wait_until='domcontentloaded')
    bitis = time.monotonic() + sure_sn
    kart = onay = ara = False
    while time.monotonic() < bitis:
        sayfalar = [p for p in context.pages if not p.is_closed()]
        ebyn = [p for p in sayfalar if urlsplit(p.url).hostname == 'ebeyanname.gib.gov.tr']
        if ebyn:
            sayfa = ebyn[-1]
            cerceve = await _sorgu_cercevesi(sayfa)
            if cerceve is not None:
                return sayfa, cerceve
            if not ara:
                hedef = await visible_target(context, 'Beyanname Ara')
                if hedef is not None:
                    await hedef.click(timeout=5000)
                    ara = True
                    if ilerleme:
                        await ilerleme('e-Beyanname: Beyanname Ara açıldı.')
        elif not onay and kart and await confirm_transition(context, 'e-Beyanname'):
            onay = True
            if ilerleme:
                await ilerleme('e-Beyanname yönlendirme onayı verildi.')
        elif not kart:
            hedef = await visible_target(context, 'e-Beyanname')
            if hedef is not None:
                await hedef.click(timeout=5000)
                kart = True
        await asyncio.sleep(0.4)
    raise BeyannameHatasi('e-Beyanname sorgu ekranına ulaşılamadı (menü değişmiş olabilir); veri yazılmadı.')


async def _onceki_sonucu_kapat(cerceve):
    for kapat in await cerceve.locator('.alphacube_close').all():
        if not await kapat.is_visible():
            continue
        kimlik = await kapat.get_attribute('id') or ''
        pencere = re.fullmatch(r'(bynList\d+)_close', kimlik)
        if pencere and await kapat.get_attribute('onclick') == f'Windows.close("{pencere[1]}", event)':
            await kapat.click(timeout=3000)


async def _formu_doldur(cerceve, kimlik: str, bas: date, bit: date):
    tc = len(kimlik) == 11
    alan = cerceve.locator(f'input[name="{"tcKimlikNo" if tc else "vergiNo"}"]')
    if await alan.count() != 1:
        raise BeyannameHatasi('Kimlik sorgu alanı tekil değil.')
    etiket = await alan.evaluate("el => (el.closest('td')?.previousElementSibling?.innerText || '').trim()")
    if etiket != ('TC Kimlik Numarası' if tc else 'Vergi Kimlik Numarası'):
        raise BeyannameHatasi('VKN/TCKN alanı doğrulanamadı.')
    for ek in ('N', 'T', 'B', 'P', 'V', 'Z', 'D'):
        if await cerceve.locator(f'input[name="sorguTipi{ek}"]').count() != 1:
            raise BeyannameHatasi('Sorgu türü kutuları doğrulanamadı.')
    await cerceve.locator('input[name="sorguTipiN"]').set_checked(not tc)
    await cerceve.locator('input[name="sorguTipiT"]').set_checked(tc)
    for ek in ('B', 'P', 'V', 'D'):
        await cerceve.locator(f'input[name="sorguTipi{ek}"]').set_checked(False)
    if not await cerceve.locator('input[name="sorguTipiZ"]').is_checked():
        raise BeyannameHatasi('Gönderim zamanı süzgeci etkin değil.')  # canlı formda zorunlu
    await alan.fill(kimlik)
    for onek, gun in (('baslangic', bas), ('bitis', bit)):
        for ek, deger in (('Gun', gun.day), ('Ay', gun.month), ('Yil', gun.year)):
            await cerceve.locator(f'input[name="{onek}Tarihi{ek}"]').fill(str(deger), timeout=2000)
    if await alan.input_value() != kimlik:
        raise BeyannameHatasi('Sorgu kimliği eşleşmedi.')


async def _liste_sayfasi(cerceve):
    """Görünür, başlıkları tam eşleşen tek beyanname tablosu + sayfa sayacı → (satırlar, (ilk, son, toplam), son_mu) | None."""
    tablolar = await cerceve.locator('table').evaluate_all('''(tables, expected) => tables.flatMap(table => {
        if (!table.getClientRects().length || getComputedStyle(table).visibility === 'hidden') return [];
        const rows = Array.from(table.rows || []); if (!rows.length) return [];
        const headers = Array.from(rows[0].cells).map(c => (c.innerText || '').replace(/\\s+/g, ' ').trim());
        if (JSON.stringify(headers) !== JSON.stringify(expected)) return [];
        return [rows.slice(1).filter(r => r.cells.length === 10).map(r => ({
            sourceRowId: (r.id || '').replace(/^row/, ''), title: r.title || '',
            identity: (r.cells[2].innerText || '').replace(/\\D/g, ''), document: r.cells[1].innerText.trim(),
            period: r.cells[5].innerText.trim(), branch: r.cells[6].innerText.trim(), uploadedAt: r.cells[7].innerText.trim(),
            taxStatus: r.cells[8].innerText.trim(), sgkStatus: r.cells[9].innerText.trim()}))];
    })''', HEADERS)
    if not tablolar:
        return None
    if len(tablolar) != 1:
        raise BeyannameHatasi('Beyanname listesi tekil değil.')
    kontroller = [k for k in await cerceve.locator('input[title="Sonraki Sayfa"]').all() if await k.is_visible()]
    if len(kontroller) != 1:
        raise BeyannameHatasi('Sayfalama doğrulanamadı.')
    durum = await kontroller[0].evaluate("el => ({disabled: el.disabled, text: (el.closest('tr')?.innerText || '').trim()})")
    sayac = SAYAC.fullmatch(durum['text'])
    if not sayac:
        raise BeyannameHatasi('Sayfa sayacı okunamadı.')
    satirlar = tablolar[0]
    for s in satirlar:
        ad = re.match(r'^([A-Za-z0-9_-]+\.xml)(?:\s|$)', s.pop('title'))
        s['sourceFilename'] = ad[1] if ad else ''
    return satirlar, tuple(map(int, sayac.groups())), durum['disabled'], kontroller[0]


async def sorgula(context, sayfa, cerceve, kimlik: str, esler: list[str], bas: date, bit: date, belge_kaydet=None,
                  tasima=None) -> list[dict]:
    """Tek mükellef + tek ay. Boş sonuç yalnız GİB'in açık 'bulunamamıştır' yanıtıyla kabul edilir.
    tasima (D38 servis yolu): kapsam açıkken sorgu ve belge istekleri aynı oturumun doğrulanmış HTTP taşımasından geçer."""
    await _onceki_sonucu_kapat(cerceve)
    await _formu_doldur(cerceve, kimlik, bas, bit)
    uyarilar: list[str] = []

    async def diyalog(d):
        uyarilar.append(' '.join(sade(d.message).split()))
        await d.dismiss()
    sayfa.on('dialog', diyalog)
    if tasima is not None:
        tasima.kapsam_ac(Kapsam(kimlik, tuple(esler or [kimlik]), bas, bit))
    try:
        for deneme in (1, 2):
            uyarilar.clear()
            await _beklet(sayfa, '_eworks_sorgu_son', 1.5)
            await cerceve.locator('input[name="sorgulaButon"]').click(timeout=10000)
            for _ in range(120):
                await asyncio.sleep(0.25)
                if uyarilar or (tasima is not None and tasima.hata is not None):
                    break
                try:
                    if await _liste_sayfasi(cerceve) is not None:
                        break
                except BeyannameHatasi:
                    pass  # yanıt gelene kadar ekran yarım olabilir; doğrulanmayan ekran hiçbir zaman sonuç sayılmaz
            _tasima_hatasi(tasima)
            if uyarilar and uyarilar[0] == HIZ_UYARISI and deneme == 1:
                await asyncio.sleep(1.6)
                continue
            break
        if uyarilar:
            if uyarilar[0] in BOS_SONUC:
                return []
            raise BeyannameHatasi('GİB sorguyu tamamlayamadı; boş sonuç sayılmadı.')
        return await _sayfalari_oku(context, cerceve, kimlik, esler, bas, bit, belge_kaydet, tasima)
    finally:
        sayfa.remove_listener('dialog', diyalog)
        if tasima is not None:
            tasima.kapsam_kapat()


async def _sayfalari_oku(context, cerceve, kimlik, esler, bas, bit, belge_kaydet, tasima=None):
    """Yalnız gözlenen 'Sonraki Sayfa' kontrolüyle tam listeyi okur; sayfalar arası toplam değişirse durur."""
    kayitlar, gorulen, toplam = [], set(), None
    while True:
        okunan = await _liste_sayfasi(cerceve)
        if okunan is None:
            raise BeyannameHatasi('Liste kayboldu.' if kayitlar else 'GİB sonucu bekleme süresi doldu.')
        satirlar, (ilk, son, adet), son_sayfa, sonraki = okunan
        if toplam is None:
            toplam = adet
        if ilk != len(kayitlar) + 1 or adet != toplam or son - ilk + 1 != len(satirlar) or toplam > 100000:
            raise BeyannameHatasi('Sayfalama toplamı değişti.')
        dogru = satirlari_dogrula(satirlar, kimlik=kimlik, esler=esler, bas=bas, bit=bit)
        for kayit in dogru:
            if kayit['recordId'] in gorulen:
                raise BeyannameHatasi('Sayfalarda mükerrer kayıt.')
            gorulen.add(kayit['recordId'])
            istek = belge_istegi(belge_kaydet)
            kayit['documents'], kayit['documentWarnings'] = (
                (await belgeleri_indir(context, cerceve, kayit, istek.kaydet, tasima)) if istek and istek.beyanname else ([], []))
            if istek and istek.sgk and kayit['type'] == 'MUHSGK':
                try:
                    kayit['sgk'] = await sgk_bildirimleri(context, cerceve, kayit, istek.kaydet, pdf_yakala, pdf_dogrula, kaynak_kimligi)
                except ValueError as e:
                    # SGK detayı okunamazsa beyanname satırı yine yazılır; SGK kısmı uyarıyla boş kalır
                    kayit['documentWarnings'].append(f'SGK bildirimleri: {str(e)[:200]}')
                _engel_varsa(tasima)
                neden = tasima.hata_al() if tasima is not None else None
                if neden is not None:
                    kayit['documentWarnings'].append(f'SGK belgesi: {neden}')  # servis yanıtı doğrulanamadı; görünür kalsın
            kayit.pop('_ham')
            kayitlar.append(kayit)
        if son == toplam:
            if not son_sayfa:
                raise BeyannameHatasi('Son sayfa doğrulanamadı.')
            return kayitlar
        if son_sayfa:
            raise BeyannameHatasi('Eksik sayfa.')
        onceki = f'{ilk}-{son}'
        await sonraki.click(timeout=5000)
        for _ in range(100):
            await asyncio.sleep(0.1)
            yeni = await _liste_sayfasi(cerceve)
            if yeni is not None and f'{yeni[1][0]}-{yeni[1][1]}' != onceki:
                break
        else:
            raise BeyannameHatasi('Sonraki sayfa yüklenmedi.')


async def belgeleri_indir(context, cerceve, kayit: dict, belge_kaydet, tasima=None) -> tuple[list[dict], list[str]]:
    """Satırdaki beyanname ve tahakkuk PDF'leri. Kontrolün onclick'i satır kimliğiyle eşleşmezse tıklanmaz."""
    ham = kayit['_ham']
    satir = cerceve.locator(f'[id="row{ham}"]')
    if await satir.count() != 1 or not await satir.is_visible():
        raise BeyannameHatasi('Belge satırı görünür değil.')
    belgeler, uyarilar = [], []
    kimlikler = {ham, unquote(ham)}
    for tur, (baslik, islev) in PDF_BASLIK.items():
        kontrol = satir.locator(f'img[title="{baslik}"]')
        if await kontrol.count() == 0:
            continue
        if await kontrol.count() != 1 or not await kontrol.is_visible():
            raise BeyannameHatasi('PDF kontrolü tekil değil.')
        eylem = await kontrol.get_attribute('onclick') or ''
        if not any(re.fullmatch(islev + r"\('" + re.escape(k) + r"'(?:,'[A-Za-z0-9_-]{1,100}')?,\s*(?:true|false),\s*(?:true|false)\)", eylem) for k in kimlikler):
            raise BeyannameHatasi('PDF kontrolünün kaynak kayıt kimliği eşleşmedi.')
        try:
            ham_pdf = await pdf_yakala(context, kontrol)
            ozet = pdf_dogrula(ham_pdf)
            anahtar = await belge_kaydet(ozet, ham_pdf)
            belgeler.append({'kind': tur, 'key': anahtar, 'sha256': ozet, 'size': len(ham_pdf)})
        except BeyannameHatasi as e:
            _engel_varsa(tasima)
            neden = (tasima.hata_al() if tasima is not None else None) or e
            uyarilar.append(f'{"Beyanname" if tur == "declaration" else "Tahakkuk"} PDF: {neden}')
    return belgeler, uyarilar


async def beyanname_tara(context, ana_adres: str, sozlesmeler: list[dict], kapsam: dict, belge_kaydet, ilerleme=None,
                         sure_sn: float = 6600, tasima=None) -> list[dict]:
    """Kapsamdaki her mükellef × ay için sorgu sonucu: {identity, startDate, endDate, outcome, message?, records, access?}.
    tasima verilirse (D38 servis yolu) kurum engelinde tarama durur: biten kapsamlar korunur, kalanlar failed; engel tasima.engel'de."""
    kanit = erisim_kaniti(sozlesmeler)
    bas, bit = date.fromisoformat(kapsam['startDate']), date.fromisoformat(kapsam['endDate'])
    istenen = kapsam.get('identities') or sorted(kanit)
    aylar = aylik_kapsam(bas, bit)
    sonuclar: list[dict] = []
    uygun = [k for k in istenen if k in kanit]
    for k in istenen:
        if k not in kanit:
            sonuclar.append({'identity': k, 'startDate': bas.isoformat(), 'endDate': bit.isoformat(), 'outcome': 'no_access',
                             'message': 'Aynı oturumda geçerli Aracılık ve Sorumluluk sözleşmesi bulunamadı.', 'records': []})
    if not uygun:
        return sonuclar
    sayfa, cerceve = await ebeyanname_ac(context, ana_adres, ilerleme)
    bitis = time.monotonic() + sure_sn
    toplam, tamam, ardisik_hata = len(uygun) * len(aylar), 0, 0
    for i, kimlik in enumerate(uygun, 1):
        for a_bas, a_bit in aylar:
            temel = {'identity': kimlik, 'startDate': a_bas.isoformat(), 'endDate': a_bit.isoformat(),
                     'access': {'method': 'same_session_contract', 'contractNumbers': kanit[kimlik]['contractNumbers']}}
            if time.monotonic() > bitis:
                sonuclar.append({**temel, 'outcome': 'failed', 'message': 'Süre sınırı; bu kapsam sorgulanmadı.', 'records': []})
                continue
            if ilerleme:
                await ilerleme(f'Mükellef {i}/{len(uygun)} · {a_bas.isoformat()} – {a_bit.isoformat()} · {tamam}/{toplam} sorgu tamamlandı.')
            try:
                kayitlar = await sorgula(context, sayfa, cerceve, kimlik, kanit[kimlik]['aliases'], a_bas, a_bit, belge_kaydet, tasima)
                sonuclar.append({**temel, 'outcome': 'ok' if kayitlar else 'empty', 'records': kayitlar})
                ardisik_hata = 0
            except KaynakEngelledi as e:
                # Kurum engeli (D38): biten kapsamlar korunur, bu ve kalan kapsamlar sorgulanmadan düşer; engel tasima.engel'de
                sonuclar.append({**temel, 'outcome': 'failed', 'message': str(e)[:300], 'records': []})
                sonuclar.extend({'identity': k2, 'startDate': b.isoformat(), 'endDate': s.isoformat(), 'outcome': 'failed',
                                 'message': 'Kurum erişimi durdu; sorgulanmadı.', 'records': []}
                                for k2, b, s in _kalan(uygun, aylar, kimlik, a_bas))
                return sonuclar
            except BeyannameHatasi as e:
                sonuclar.append({**temel, 'outcome': 'failed', 'message': str(e)[:300], 'records': []})
                ardisik_hata += 1
                yeni = await _sorgu_cercevesi(sayfa)
                if yeni is None or ardisik_hata >= 8:
                    # Sorgu formu kayboldu ya da kaynak art arda hata veriyor: yeni hedefe geçmek güvenli değil
                    sonuclar.extend({'identity': k2, 'startDate': b.isoformat(), 'endDate': s.isoformat(), 'outcome': 'failed',
                                     'message': 'Önceki sorgu hatası nedeniyle sorgulanmadı.', 'records': []}
                                    for k2, b, s in _kalan(uygun, aylar, kimlik, a_bas))
                    return sonuclar
                cerceve = yeni
            tamam += 1
    return sonuclar


def _kalan(uygun, aylar, kimlik, ay):
    sira = [(k, b, s) for k in uygun for b, s in aylar]
    i = sira.index(next(x for x in sira if x[0] == kimlik and x[1] == ay))
    return sira[i + 1:]


def to_declarations(job_id: str, sozlesmeler: list[dict], kapsam: dict, sorgular: list[dict], sahte: bool) -> dict:
    """Yayımlanmış dil (eworks.gib.declarations.v1)."""
    from .sozlesmeler import to_contract
    s = to_contract(job_id, sozlesmeler, sahte)
    return {'schema': 'eworks.gib.declarations.v1', 'jobId': job_id, 'sourceType': s['sourceType'], 'observedAt': s['observedAt'],
            'contracts': {'count': s['count'], 'contracts': s['contracts']},
            'scope': {'startDate': kapsam['startDate'], 'endDate': kapsam['endDate']}, 'queries': sorgular}
