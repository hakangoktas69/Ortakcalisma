"""GİB Dijital VD e-Tebligat listesi (D45), firmanın kendi hesabıyla (D46: mükellef onayı veritabanında denetlenir).

Mert'in canlıda gözlediği davranış (26.10.2026, Eworks 2 pilotu): girişten sonra profil düğmesinde "Ad Soyad <VKN/TCKN>" görünür;
"E-Tebligat" menüsü listeyi açar; sayfa POST https://dijital.gib.gov.tr/apigateway/etebligat/etebligat/tebligat-listele ile
{data: {tebligatDtoList, count}, pageDetail: {pageNo, pageSize, total, totalPage}} alır; sonraki sayfalar istekteki tekil pageNo
alanı ilerletilerek aynı oturumda alınır. Yalnız liste bilgisi okunur: belge açma ve okundu işaretleme uçlarına gidilmez
(belgeyi açmak tebliğ sonucu doğurabilir). Doğrulama fail-closed: toplam, sayfa sayısı, tekil kimlik, tarih biçimi.
Sayfalama isteği sayfanın içinden atılır: demo/test yönlendirmesi ve merkezi hız sınırlayıcı (tarayıcı yönlendirmesi) uygulanır.
"""
from __future__ import annotations

import asyncio
import copy
import json
import math
from datetime import datetime
from hashlib import sha256
from urllib.parse import urlsplit

LIST_PATH = '/apigateway/etebligat/etebligat/tebligat-listele'
MENU = ('E-Tebligat', 'e-Tebligat', 'E-Tebligat İşlemleri', 'e-Tebligat İşlemleri')
TARIH_BICIMLERI = ('%Y-%m-%dT%H:%M:%S.%f', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d %H:%M:%S', '%d.%m.%Y %H:%M:%S', '%d.%m.%Y %H:%M', '%d.%m.%Y',
                   '%d/%m/%Y %H:%M:%S', '%d/%m/%Y %H:%M', '%d/%m/%Y')
AZAMI_TOPLAM = 10000
GECEN_BASLIKLAR = ('content-type', 'accept', 'authorization')


class EtebligatHatasi(Exception):
    """Sabit Türkçe metin; kurum yanıtı ya da kişisel veri içermez."""


def liste_adresi(url: str) -> bool:
    u = urlsplit(url)
    return u.scheme == 'https' and u.hostname == 'dijital.gib.gov.tr' and u.port in (None, 443) and not u.username and u.path == LIST_PATH and not u.query


def tarih(v, zorunlu=False):
    if v in (None, '', '-', '—'):
        if zorunlu:
            raise EtebligatHatasi('Tebligat gönderim tarihi eksik.')
        return None
    if not isinstance(v, str):
        raise EtebligatHatasi('Tebligat tarih türü değişti.')
    for bicim in TARIH_BICIMLERI:
        try:
            return datetime.strptime(v, bicim).date().isoformat()
        except ValueError:
            pass
    raise EtebligatHatasi('Tebligat tarih biçimi doğrulanamadı.')


def sayfa_verisi(deger) -> tuple[list, dict]:
    if not isinstance(deger, dict) or not isinstance(deger.get('data'), dict) or not isinstance(deger.get('pageDetail'), dict):
        raise EtebligatHatasi('Tebligat liste sözleşmesi değişti.')
    d, p = deger['data'], deger['pageDetail']
    satirlar, toplam, sayi = d.get('tebligatDtoList'), p.get('total'), d.get('count')
    if not isinstance(satirlar, list) or type(toplam) is not int or not 0 <= toplam <= AZAMI_TOPLAM or type(sayi) is not int or sayi != toplam:
        raise EtebligatHatasi('Tebligat toplamı doğrulanamadı.')
    if any(type(p.get(k)) is not int for k in ('pageNo', 'pageSize', 'totalPage')) or not 1 <= p['pageSize'] <= 1000:
        raise EtebligatHatasi('Tebligat sayfalaması doğrulanamadı.')
    if p['totalPage'] != math.ceil(toplam / p['pageSize']) or len(satirlar) > p['pageSize']:
        raise EtebligatHatasi('Tebligat sayfa toplamı tutarsız.')
    return satirlar, p


def kayit(satir) -> dict:
    """Yayımlanmış dil kaydı. Kurum kayıt kimliği (tebligId) açık saklanmaz: SHA-256 özetiyle tekilleşir."""
    if not isinstance(satir, dict):
        raise EtebligatHatasi('Tebligat kaydı geçersiz.')
    for alan in ('tebligId', 'belgeNo', 'belgeTuruAciklama', 'kurumAciklama'):
        if not isinstance(satir.get(alan), str) or not satir[alan].strip() or len(satir[alan]) > 2000:
            raise EtebligatHatasi('Tebligat kimlik alanı eksik.')
    alt = satir.get('altKurum')
    return {
        'noticeKey': sha256(('gib-etebligat|' + satir['tebligId']).encode('utf-8')).hexdigest(),
        'reference': satir['belgeNo'].strip(),
        'documentType': satir['belgeTuruAciklama'].strip(),
        'sender': satir['kurumAciklama'].strip(),
        'department': (alt.strip() if isinstance(alt, str) else '')[:2000],
        'sentOn': tarih(satir.get('gonderimZamani'), True),
        'deliveredOn': tarih(satir.get('tebligZamani')),
        'readOn': tarih(satir.get('mukellefOkumaZamani')),
    }


def _sayfa_alani(govde) -> list[str]:
    bulunan: list[list[str]] = []

    def gez(v, yol):
        if isinstance(v, dict):
            for k, x in v.items():
                if k == 'pageNo' and type(x) is int:
                    bulunan.append(yol + [k])
                elif isinstance(x, dict):
                    gez(x, yol + [k])
    gez(govde, [])
    if len(bulunan) != 1:
        raise EtebligatHatasi('Gözlenen istekte tekil sayfa alanı yok.')
    return bulunan[0]


# Profil düğmesi (Mert'in canlı gözlemi: div[aria-haspopup] içinde "Ad Soyad <VKN/TCKN>") ya da başlıkta "VKN: …" satırı.
KIMLIK_JS = r'''els => {
  const out = [];
  for (const el of els) {
    if (el.matches('div[aria-haspopup="true"]') && !el.closest('form,table') && !el.querySelector('input,select,textarea') && el.getClientRects().length) {
      const m = (el.innerText || '').trim().match(/^([A-Za-zÇĞİÖŞÜçğıöşü .'-]{3,120})\s+(\d{10,11})$/u);
      if (m) out.push(m[2]);
    }
    if (!el.closest('header,nav,[role=banner]') || el.children.length > 1 || el.closest('form')) continue;
    const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
    const m = t.match(/^(?:T\.?C\.? Kimlik (?:No|Numarası)|Vergi Kimlik (?:No|Numarası)|VKN|TCKN)\s*[:：]\s*(\d{10,11})$/i);
    if (m) out.push(m[1]);
  }
  return [...new Set(out)];
}'''


async def hesap_kimligi_oku(page) -> str | None:
    """Açık GİB oturumunun hesap kimliği; tek ve kesin değilse None (çağıran işi durdurur)."""
    u = urlsplit(page.url)
    if u.scheme != 'https' or not (u.hostname or '').endswith('.gib.gov.tr'):
        return None
    degerler = await page.locator('body *').evaluate_all(KIMLIK_JS)
    return degerler[0] if len(degerler) == 1 else None


async def _menu(page):
    for ad in MENU:
        for aday in await page.get_by_text(ad, exact=True).all():
            if await aday.is_visible():
                return aday
    return None


SAYFA_JS = '''async ([u, h, b]) => {
  const r = await fetch(u, { method: 'POST', headers: h, body: b, credentials: 'include' });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { s: r.status, j };
}'''


async def etebligat_listesi_oku(ctx, page, ilerleme=None, bekleme_sn: float = 20.0) -> list[dict]:
    ilk: dict = {}

    async def gozle(yanit):
        if ilk or not liste_adresi(yanit.url) or yanit.status != 200 or yanit.request.method != 'POST':
            return
        try:
            deger = await yanit.json()
            sayfa_verisi(deger)
        except (ValueError, EtebligatHatasi):
            return
        ilk.update(deger=deger, istek=yanit.request)

    page.on('response', gozle)
    menu = await _menu(page)
    if menu is None:
        raise EtebligatHatasi('e-Tebligat menüsü bulunamadı.')
    if ilerleme:
        await ilerleme('e-Tebligat listesi açılıyor (belgeler açılmaz).')
    await menu.click()
    bitis = asyncio.get_running_loop().time() + bekleme_sn
    while not ilk and asyncio.get_running_loop().time() < bitis:
        await asyncio.sleep(0.2)
    if not ilk:
        raise EtebligatHatasi('e-Tebligat listesi alınamadı.')
    satirlar, detay = sayfa_verisi(ilk['deger'])
    hepsi, sayfa_no, toplam = list(satirlar), detay['pageNo'], detay['total']
    if sayfa_no not in (0, 1):
        raise EtebligatHatasi('Tebligat ilk sayfası doğrulanamadı.')
    if len(hepsi) < toplam:
        istek = ilk['istek']
        govde = json.loads(istek.post_data or '{}')
        imlec = _sayfa_alani(govde)
        dugum = govde
        for k in imlec:
            dugum = dugum[k]
        if dugum != sayfa_no:
            raise EtebligatHatasi('Tebligat sayfa isteği ve yanıtı eşleşmedi.')
        basliklar = {k: v for k, v in (await istek.all_headers()).items() if k.lower() in GECEN_BASLIKLAR or k.lower().startswith('x-')}
        for _ in range(1000):
            if len(hepsi) >= toplam:
                break
            sayfa_no += 1
            yeni = copy.deepcopy(govde)
            hedef = yeni
            for k in imlec[:-1]:
                hedef = hedef[k]
            hedef[imlec[-1]] = sayfa_no
            if ilerleme:
                await ilerleme(f'e-Tebligat listesi: sayfa {sayfa_no} / {detay["totalPage"]}.')
            cevap = await page.evaluate(SAYFA_JS, [istek.url, basliklar, json.dumps(yeni)])
            if cevap.get('s') != 200:
                raise EtebligatHatasi('Tebligat sayfası alınamadı.')
            daha, p = sayfa_verisi(cevap.get('j'))
            if p['total'] != toplam or p['pageSize'] != detay['pageSize'] or p['pageNo'] != sayfa_no or not daha:
                raise EtebligatHatasi('Tebligat sayfa kapsamı değişti.')
            hepsi.extend(daha)
        basliklar.clear()
    if len(hepsi) != toplam:
        raise EtebligatHatasi('Tebligat liste toplamı tamamlanamadı.')
    kayitlar = [kayit(s) for s in hepsi]
    if len({k['noticeKey'] for k in kayitlar}) != toplam:
        raise EtebligatHatasi('Tebligat listesi tekrar eden kayıt içeriyor.')
    return kayitlar


def to_notices(job: str, firma: str, kayitlar: list[dict], sahte: bool) -> dict:
    """Yayımlanmış dil: eworks.gib.notices.v1 (hesap kimliği doğrulandıktan sonra çağrılır)."""
    return {'schema': 'eworks.gib.notices.v1', 'jobId': job, 'firmId': firma, 'sourceType': 'sahte_gib' if sahte else 'gib_live',
            'observedAt': datetime.now().astimezone().isoformat(timespec='seconds'), 'accountVerified': True, 'documentsOpened': False,
            'scope': 'observed_list_filter', 'count': len(kayitlar), 'records': kayitlar}
