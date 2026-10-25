"""MUHSGK satırının SGK bildirimleri (e-Beyanname içinden) — eski robotun muhsgk_sgk_reader ve sgk_employee_count mantığı.

MUHSGK satırındaki "SGK Bildirimleri" penceresi (#bynGoruntu, #tahakkukTable) işyeri × ay satırlarını listeler; her satırda
SGK tahakkuk fişi ve hizmet dökümü PDF'leri vardır. Hizmet dökümünden yalnız **tekil çalışan sayısı** çıkarılır; TCKN ve ad
ACL'den dışarı çıkmaz (KVKK). Kontrolün onclick'i satır kimlikleriyle tam eşleşmezse hiçbir eylem çalıştırılmaz.
"""
from __future__ import annotations

import asyncio
import io
import re
from urllib.parse import unquote

BASLIKLAR = ['Vergilendirme Dönemi', 'Açıklama', 'Vergi Tahakkuku Durumu', '']
SGK_PDF = (('sgkTahakkukGoruntule', 'sgk_accrual', 'Tahakkuku PDF Formatında görüntülemek için tıklayınız.'),
           ('sgkHizmetGoruntule', 'sgk_service', 'Hizmet Dökümünü PDF Formatında görüntülemek için tıklayınız.'))
SAYAC = re.compile(r'\s*(\d+)\s*-\s*(\d+)\s*/\s*(\d+)\s*')


def calisan_sayisi(ham: bytes) -> int | None:
    """Hizmet dökümü PDF'indeki tablo satırlarından tekil kişi sayısı; tablo tanınmazsa None (sayı uydurulmaz)."""
    from pypdf import PdfReader
    kimlikler, satir = set(), 0
    for sayfa in PdfReader(io.BytesIO(ham), strict=False).pages:
        metin = sayfa.extract_text() or ''
        # GİB PDF yazı tipinde Türkçe glifler bozulabilir; ASCII tablo başlıkları korunur
        baslik = re.search(r'\bSno\s+S\.G[^\n]*\bNo\b[^\n]*Meslek\s+Kod', metin)
        if not baslik:
            return None
        for line in metin[baslik.end():].splitlines():
            m = re.match(r'^\s*(\d{1,6})\s+(\d{11})\s+(.+)$', line)
            if not m:
                continue
            if int(m[1]) < 1 or len(re.findall(r'\b[\d.]+,\d{2}\b', m[3])) < 2:
                return None
            kimlikler.add(m[2])
            satir += 1
    return len(kimlikler) if satir else None


def alt_satir(kaynak: dict, ust: dict, kaynak_kimligi) -> dict | None:
    """normalize_child: 'Vergi' satırı atlanır; açıklamadan tekil işyeri + ay; dönem MUHSGK dönemi içinde olmalı."""
    hucreler = kaynak['cells']
    if len(hucreler) != 4:
        raise ValueError('SGK detay sütunları değişti.')
    if hucreler[1] == 'Vergi':
        return None
    ham = kaynak['id'].removeprefix('row')
    if kaynak['id'] != 'row' + ham or not ham:
        raise ValueError('SGK kaynak satır kimliği eksik.')
    eslesme = re.findall(r'(?:^|,\s*)(0[1-9]|1[0-2])\s*/\s*(20\d{2})\s*,\s*(\d{17,30})(?:,|$)', hucreler[1])
    if len(eslesme) != 1:
        raise ValueError('SGK işyeri ve ay bilgisi tekil değil.')
    ay, yil, isyeri = eslesme[0]
    donem = f'{yil}-{ay}'
    if not ust['periodStart'] <= donem <= ust['periodEnd']:
        raise ValueError('SGK dönemi kaynak MUHSGK dışında.')
    return {'recordId': kaynak_kimligi(ham), 'workplace': isyeri, 'period': donem, 'status': (hucreler[2] or 'Durum belirtilmedi')[:200],
            'documents': [], 'documentWarnings': [], 'employeeCount': None, '_ham': ham}


async def _detayi_kapat(detay):
    kapat = detay.locator('#bynGoruntu_close')
    if await kapat.count() != 1 or await kapat.get_attribute('onclick') != 'Windows.close("bynGoruntu", event)':
        raise ValueError('SGK detay kapatma kontrolü doğrulanamadı.')
    await kapat.click(timeout=5000)


async def sgk_bildirimleri(context, cerceve, ust: dict, belge_kaydet, pdf_yakala, pdf_dogrula, kaynak_kimligi) -> list[dict]:
    """MUHSGK satırının SGK alt satırları + PDF'leri; pencere her durumda kapatılır."""
    detay = cerceve.locator('#bynGoruntu')
    try:
        return await _oku(context, cerceve, detay, ust, belge_kaydet, pdf_yakala, pdf_dogrula, kaynak_kimligi)
    finally:
        if await detay.count() == 1 and await detay.is_visible():
            await _detayi_kapat(detay)


async def _oku(context, cerceve, detay, ust, belge_kaydet, pdf_yakala, pdf_dogrula, kaynak_kimligi):
    ham_ust = ust['_ham']
    ust_kalip = '(?:' + '|'.join(re.escape(v) for v in dict.fromkeys((ham_ust, unquote(ham_ust)))) + ')'
    satir = cerceve.locator(f'[id="row{ham_ust}"]')
    kontroller = [k for k in await satir.locator('img[onclick]').all()
                  if re.fullmatch(r"beyannameSGKBildirimleriGoster\('" + ust_kalip + r"',\s*(?:true|false)\)", await k.get_attribute('onclick') or '')]
    if len(kontroller) != 1:
        raise ValueError('MUHSGK SGK detay kontrolü doğrulanamadı.')
    await kontroller[0].click(timeout=5000)
    await detay.wait_for(state='visible', timeout=15000)
    for _ in range(60):
        if await detay.locator('#tahakkukTable').count() == 1:
            break
        await asyncio.sleep(0.25)
    kaynak = await detay.locator('#tahakkukTable').evaluate('''t => ({headers: Array.from(t.rows[0].cells).map(c => c.innerText.trim()),
        rows: Array.from(t.rows).slice(1).map(r => ({id: r.id, cells: Array.from(r.cells).map(c => c.innerText.trim()),
        controls: Array.from(r.querySelectorAll('img[onclick]')).map(c => ({title: c.title, action: c.getAttribute('onclick')}))}))})''')
    if kaynak['headers'] != BASLIKLAR:
        raise ValueError('SGK detay başlıkları doğrulanamadı.')
    sonraki = detay.locator('input[title="Sonraki Sayfa"]')
    if await sonraki.count() != 1:
        raise ValueError('SGK sayfalama kontrolü eksik.')
    sayfa = await sonraki.evaluate("el => ({text: el.closest('tr').innerText.trim(), disabled: el.disabled})")
    sayac = SAYAC.fullmatch(sayfa['text'])
    # Canlıda gözlenen: tek sayfa. Çok sayfalı SGK listesi doğrulanmadan yarım okunmaz
    if not sayac or int(sayac[1]) != 1 or int(sayac[2]) != len(kaynak['rows']) or int(sayac[3]) != len(kaynak['rows']) or not sayfa['disabled']:
        raise ValueError('SGK listesi tek sayfada tam değil; sayfalama doğrulanmadı.')
    cocuklar, gorulen = [], set()
    for k in kaynak['rows']:
        if k['id'] in gorulen:
            raise ValueError('SGK listesinde mükerrer satır.')
        gorulen.add(k['id'])
        cocuk = alt_satir(k, ust, kaynak_kimligi)
        if cocuk is None:
            continue
        cocuk_kalip = '(?:' + '|'.join(re.escape(v) for v in dict.fromkeys((cocuk['_ham'], unquote(cocuk['_ham'])))) + ')'
        pdfler, bilinmeyen = [], []
        for c in k['controls']:
            if re.fullmatch(r"mesajButtonClick\('" + cocuk_kalip + r"'\)", c['action'] or ''):
                continue
            for islev, tur, baslik in SGK_PDF:
                desen = islev + r"\('" + ust_kalip + r"','" + cocuk_kalip + r"',\s*(?:true|false),\s*(?:true|false)\)"
                if c['title'] == baslik and re.fullmatch(desen, c['action'] or ''):
                    if any(t == tur for t, _ in pdfler):
                        raise ValueError('SGK PDF kontrolü tekil değil.')
                    pdfler.append((tur, c))
                    break
            else:
                bilinmeyen.append(c)
        if bilinmeyen:
            raise ValueError('SGK belge kontrolleri değişti; doğrulanamayan işlem çalıştırılmadı.')
        for tur, c in pdfler:
            hedef = [x for x in await detay.locator(f'#tahakkukTable [id="{k["id"]}"] img[onclick]').all()
                     if await x.get_attribute('onclick') == c['action'] and await x.get_attribute('title') == c['title']]
            if len(hedef) != 1:
                raise ValueError('SGK PDF kaynak satırı değişti.')
            try:
                ham_pdf = await pdf_yakala(context, hedef[0])
                ozet = pdf_dogrula(ham_pdf)
                cocuk['documents'].append({'kind': tur, 'key': await belge_kaydet(ozet, ham_pdf), 'sha256': ozet, 'size': len(ham_pdf)})
                if tur == 'sgk_service':
                    cocuk['employeeCount'] = calisan_sayisi(ham_pdf)
            except ValueError as e:
                cocuk['documentWarnings'].append(f'{"SGK tahakkuk" if tur == "sgk_accrual" else "Hizmet listesi"} PDF: {str(e)[:200]}')
        cocuk.pop('_ham')
        cocuklar.append(cocuk)
    return cocuklar
