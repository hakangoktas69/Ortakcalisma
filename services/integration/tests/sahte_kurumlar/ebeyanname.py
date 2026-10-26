"""Sahte e-Beyanname (ebeyanname.gib.gov.tr) — demo ve test için, canlı GİB değildir (D33).

Ağ katmanı (D38 servis yolu için): sorgu POST /dispatch form gövdesiyle, belgeler GET /dispatch?cmd=IMAJ (Eworks 2 gözlemi).

Ekran yapısı eski robotun canlıda gözlediği alanları izler: "Beyanname Ara" formu (vergiNo / tcKimlikNo, sorguTipi*
kutuları, gönderim tarihi Gün/Ay/Yıl, Sorgula), "Beyanname Listesi" penceresi (10 sütun, satır kimliği row<oid>, title'da XML
adı), "1 - 2 / 5" sayfalama ve "Sonraki Sayfa" düğmesi, satır içi PDF simgeleri (beyannameGoruntule / tahakkukGoruntule),
MUHSGK için SGK bildirimleri penceresi (#bynGoruntu, #tahakkukTable; sgkTahakkukGoruntule / sgkHizmetGoruntule).
Uyarılar tarayıcı alert'iyle verilir ("İki istek arası en az 1 sn olabilir", "kriterlere uyan beyanname bulunamamıştır").

Veri sentetiktir: mükellef kimliğine ve aya göre tohumlanır; yalnız müşavirin sözleşme listesindeki mükellefler görünür.
Sayfa boyu küçüktür (SAHTE_GIB_BEYANNAME_SAYFA, vars. 2) ki sayfalama her sorguda sınansın.
"""
from __future__ import annotations

import hashlib
import html
import json
import os
import random
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

TR = ZoneInfo('Europe/Istanbul')
SAYFA = int(os.environ.get('SAHTE_GIB_BEYANNAME_SAYFA', '2'))
HEADERS = ('', 'Beyanname Türü', 'TC Kimlik Numarası / Vergi Kimlik Numarası', 'Ad Soyad/Unvan(*)', 'Vergi Dairesi / Malmüdürlüğü',
           'Vergilendirme Dönemi', 'Şube No', 'Yükleme Zamanı', 'Vergi Tahakkuku Durumu', 'SGK Tahakkuku Durumu')
BYN_BASLIK = 'Beyannameyi PDF Formatında görüntülemek için tıklayınız.'
THK_BASLIK = 'Tahakkuku PDF Formatında görüntülemek için tıklayınız.'
HZM_BASLIK = 'Hizmet Dökümünü PDF Formatında görüntülemek için tıklayınız.'
AD = ('AYSE', 'MEHMET', 'FATMA', 'ALI', 'ZEYNEP', 'MUSTAFA', 'ELIF', 'AHMET', 'EMINE', 'HUSEYIN', 'CAN', 'DENIZ')
SOYAD = ('YILMAZ', 'KAYA', 'DEMIR', 'SAHIN', 'CELIK', 'YILDIZ', 'AYDIN', 'OZTURK', 'ARSLAN', 'DOGAN')


def _oid(*parca: str) -> str:
    return hashlib.sha256('|'.join(parca).encode()).hexdigest()[:20]


def _onceki_ay(y: int, a: int) -> tuple[int, int]:
    return (y - 1, 12) if a == 1 else (y, a - 1)


def _tckn(rnd: random.Random) -> str:
    d = [9, 9] + [rnd.randrange(10) for _ in range(7)]
    d.append(((d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7])) % 10)
    d.append(sum(d) % 10)
    return ''.join(map(str, d))


def calisanlar(kimlik: str, sgk_oid: str) -> list[tuple[str, str]]:
    """SGK hizmet listesindeki sentetik çalışanlar (99 önekli sahte TCKN)."""
    rnd = random.Random(f'calisan:{kimlik}:{sgk_oid}')
    return [(_tckn(rnd), f'{rnd.choice(AD)} {rnd.choice(SOYAD)}') for _ in range(rnd.randint(1, 9))]


def beyannameler(kimlik: str, unvan: str, vd: str, bugun: date | None = None) -> list[dict]:
    """2025-01'den bugüne, yükleme ayına göre sentetik beyannameler (bugünden sonra yüklenmiş kayıt yok)."""
    bugun = bugun or datetime.now(TR).date()
    sirket = len(kimlik) == 10
    sonuc = []
    y, a = 2025, 1
    while (y, a) <= (bugun.year, bugun.month):
        rnd = random.Random(f'byn:{kimlik}:{y}-{a:02d}')
        dy, da = _onceki_ay(y, a)
        donem = f'{da:02d}/{dy}-{da:02d}/{dy}'
        turler = []
        if sirket or rnd.random() < .5:
            turler.append(('KDV1', donem))
        turler.append(('MUHSGK', donem))  # her ay: SGK akışı her mükellefte sınanır
        if a in (2, 5, 8, 11):
            bas = da - 2
            turler.append(('KGECICI' if sirket else 'GGECICI', f'{bas:02d}/{dy}-{da:02d}/{dy}'))
        for tur, d in turler:
            gun = rnd.randint(10, 26)
            yuklendi = datetime(y, a, gun, rnd.randint(8, 22), rnd.randint(0, 59), rnd.randint(0, 59), tzinfo=TR)
            if yuklendi.date() > bugun:
                continue
            oid = _oid(kimlik, tur, d)
            kayit = {'oid': oid, 'tahakkukOid': _oid('thk', oid), 'tur': tur, 'kimlik': kimlik, 'unvan': unvan, 'vd': vd, 'donem': d,
                     'sube': '0', 'yuklendi': yuklendi, 'vergiDurum': 'Onaylandı' if rnd.random() < .93 else 'Onay bekliyor',
                     'sgkDurum': '', 'xml': f'{kimlik}_{tur}_{d[3:7]}{d[0:2]}_{oid[:8]}.xml', 'sgk': []}
            if tur == 'MUHSGK':
                kayit['sgkDurum'] = 'Onaylandı'
                for k in range(rnd.randint(1, 2)):
                    isyeri = ''.join(str(rnd.randrange(10)) for _ in range(26))
                    kayit['sgk'].append({'oid': _oid('sgk', oid, str(k)), 'aciklama': f'{da:02d}/{dy}, {isyeri}', 'isyeri': isyeri,
                                         'donem': f'{da:02d}/{dy}', 'durum': 'Onaylandı'})
            sonuc.append(kayit)
        y, a = (y + 1, 1) if a == 12 else (y, a + 1)
    sonuc.sort(key=lambda k: k['yuklendi'])
    return sonuc


def sorgu(kayitlar: list[dict], bas: date, bit: date) -> list[dict]:
    return [k for k in kayitlar if bas <= k['yuklendi'].date() <= bit]


def _metin(s: str) -> str:
    tablo = str.maketrans('çğıöşüÇĞİÖŞÜ', 'cgiosuCGIOSU')
    return s.translate(tablo).encode('ascii', 'replace').decode().replace('\\', '/').replace('(', '[').replace(')', ']')


def pdf(satirlar: list[str]) -> bytes:
    """Tek sayfalı, metni çıkarılabilir geçerli PDF (Helvetica, ASCII)."""
    akis = 'BT /F1 10 Tf 40 800 Td 14 TL ' + ' '.join(f'({_metin(s)}) Tj T*' for s in satirlar) + ' ET'
    nesneler = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
        f'<< /Length {len(akis)} >>\nstream\n{akis}\nendstream',
    ]
    cikti = b'%PDF-1.4\n'
    yerler = []
    for i, n in enumerate(nesneler, 1):
        yerler.append(len(cikti))
        cikti += f'{i} 0 obj\n{n}\nendobj\n'.encode('latin-1')
    xref = len(cikti)
    cikti += f'xref\n0 {len(nesneler) + 1}\n0000000000 65535 f \n'.encode()
    cikti += ''.join(f'{y:010d} 00000 n \n' for y in yerler).encode()
    cikti += f'trailer\n<< /Size {len(nesneler) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode()
    return cikti


def beyanname_pdf(k: dict) -> bytes:
    return pdf(['SAHTE GIB - DEMO BELGESI (gercek beyanname degildir)', f'Beyanname: {k["tur"]}', f'Kimlik: {k["kimlik"]}',
                f'Unvan: {k["unvan"]}', f'Donem: {k["donem"]}', f'Yukleme: {k["yuklendi"].strftime("%d.%m.%Y %H:%M:%S")}'])


def tahakkuk_pdf(k: dict) -> bytes:
    return pdf(['SAHTE GIB - DEMO BELGESI', f'TAHAKKUK FISI {k["tur"]}', f'Kimlik: {k["kimlik"]}', f'Donem: {k["donem"]}',
                f'Tutar: {(int(k["oid"][:4], 16) % 90000) / 100 + 100:.2f} TL'.replace('.', ',')])


def sgk_tahakkuk_pdf(k: dict, s: dict) -> bytes:
    return pdf(['SAHTE SGK - DEMO BELGESI', 'SGK TAHAKKUK FISI', f'Isyeri: {s["isyeri"]}', f'Donem: {s["donem"]}'])


def _tutar(n: int) -> str:
    return f'{n:,}'.replace(',', '.') + ',00'


def hizmet_pdf(k: dict, s: dict) -> bytes:
    """Eski robotun çalışan sayısı okuyucusunun beklediği tablo: başlık 'Sno S.G.K. No ... Meslek Kod', satır 'n TCKN ad tutar tutar'."""
    satirlar = ['SAHTE SGK - DEMO BELGESI', 'AYLIK PRIM VE HIZMET BELGESI', f'Isyeri: {s["isyeri"]}', f'Donem: {s["donem"]}',
                'Sno S.G.K. Sicil No Ad Soyad Gun PEK Meslek Kod']
    for i, (tckn, ad) in enumerate(calisanlar(k['kimlik'], s['oid']), 1):
        satirlar.append(f'{i} {tckn} {ad} 30 {_tutar(20000 + i * 137)} {_tutar(1000 + i)}')
    return pdf(satirlar)


def uygulama_sayfasi(belirtec: str) -> str:
    """Beyanname Ara formu. Ağ biçimi Eworks 2'nin canlıda çalışan akışını izler (Mert, 23.10.2026): sorgu
    POST /dispatch (form gövdesi: TOKEN, cmd, sorguTipiZ, baslangicTarihi, bitisTarihi, sorguTipiN|T + vergiNo|tcKimlikNo),
    yanıt HTML; belgeler GET /dispatch?cmd=IMAJ. Tarih biçimi gözlenmedi (Eworks 2 altı biçimi kabul eder); burada yyyymmdd."""
    return '''
<h1>e-Beyanname</h1>
<nav><a href="#" onclick="document.getElementById('araForm').hidden=false;return false">Beyanname Ara</a></nav>
<form id="araForm" hidden onsubmit="return false">
<table>
<tr><td><input type="checkbox" name="sorguTipiN" checked></td><td>Vergi Kimlik Numarası</td><td><input name="vergiNo" maxlength="10"></td></tr>
<tr><td><input type="checkbox" name="sorguTipiT"></td><td>TC Kimlik Numarası</td><td><input name="tcKimlikNo" maxlength="11"></td></tr>
<tr><td><input type="checkbox" name="sorguTipiB"></td><td>Beyanname Türü</td><td></td></tr>
<tr><td><input type="checkbox" name="sorguTipiP"></td><td>Vergilendirme Dönemi</td><td></td></tr>
<tr><td><input type="checkbox" name="sorguTipiV"></td><td>Vergi Dairesi</td><td></td></tr>
<tr><td><input type="checkbox" name="sorguTipiD"></td><td>Durum</td><td></td></tr>
<tr><td><input type="checkbox" name="sorguTipiZ" checked onclick="return false"></td><td>Gönderim Zamanı</td><td>
<input name="baslangicTarihiGun" size="2"><input name="baslangicTarihiAy" size="2"><input name="baslangicTarihiYil" size="4"> -
<input name="bitisTarihiGun" size="2"><input name="bitisTarihiAy" size="2"><input name="bitisTarihiYil" size="4"></td></tr>
</table>
<input type="button" name="sorgulaButon" value="Sorgula" onclick="ara(1)">
</form>
<div id="sonuc"></div>
<div id="detay"></div>
<script>
const TOKEN = ''' + json.dumps(belirtec) + ''';
let son = 0;
const e = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const v = n => document.querySelector('[name="'+n+'"]').value.trim();
const c = n => document.querySelector('[name="'+n+'"]').checked;
const tarih = o => v(o + 'TarihiYil') + v(o + 'TarihiAy').padStart(2, '0') + v(o + 'TarihiGun').padStart(2, '0');
async function ara(sayfa) {
  let govde;
  if (sayfa === 1) {
    if (Date.now() - son < 1000) { alert('Hata: İki istek arası en az 1 sn olabilir.'); return; }
    son = Date.now();
    const tc = c('sorguTipiT');
    govde = new URLSearchParams({TOKEN, cmd: 'BEYANNAMELISTESI', sorguTipiZ: '1', baslangicTarihi: tarih('baslangic'), bitisTarihi: tarih('bitis')});
    govde.set(tc ? 'sorguTipiT' : 'sorguTipiN', '1');
    govde.set(tc ? 'tcKimlikNo' : 'vergiNo', tc ? v('tcKimlikNo') : v('vergiNo'));
    for (const ek of ['B', 'P', 'V', 'D']) if (c('sorguTipi' + ek)) govde.set('sorguTipi' + ek, '1');
  } else {
    govde = new URLSearchParams({TOKEN, cmd: 'BEYANNAMELISTESI_SAYFA', sayfa: String(sayfa)});
  }
  const r = await fetch('/dispatch', {method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded'}, body: govde.toString()});
  const html = await r.text();
  const hedef = document.getElementById('sonuc');
  if (r.status !== 200) { hedef.innerHTML = ''; alert('Hata: İşleminiz gerçekleştirilemedi.'); return; }
  const kap = document.createElement('div');
  kap.innerHTML = html;
  const hata = kap.querySelector('.hata');
  if (hata) { hedef.innerHTML = ''; alert(hata.textContent); return; }
  hedef.innerHTML = html;
}
const Windows = {close: (id) => { const el = document.getElementById(id); if (el) el.remove(); }};
const belge = q => window.open('/dispatch?cmd=IMAJ&TOKEN=' + encodeURIComponent(TOKEN) + '&' + q);
function beyannameGoruntule(oid) { belge('tur=beyanname&oid=' + encodeURIComponent(oid)); }
function tahakkukGoruntule(oid, toid) { belge('tur=tahakkuk&oid=' + encodeURIComponent(oid) + '&toid=' + encodeURIComponent(toid)); }
function sgkTahakkukGoruntule(oid, soid) { belge('tur=sgk_tahakkuk&oid=' + encodeURIComponent(oid) + '&soid=' + encodeURIComponent(soid)); }
function sgkHizmetGoruntule(oid, soid) { belge('tur=sgk_hizmet&oid=' + encodeURIComponent(oid) + '&soid=' + encodeURIComponent(soid)); }
async function beyannameSGKBildirimleriGoster(oid) {
  const j = await (await fetch('/eyeksite/sgk?oid=' + encodeURIComponent(oid))).json();
  if (j.hata) { alert(j.hata); return; }
  const satir = s => '<tr id="row' + e(s.oid) + '"><td>' + e(s.donem) + '</td><td>' + e(s.aciklama) + '</td><td>' + e(s.durum) + '</td><td>' +
    '<img src="data:," width="12" height="12" title="''' + THK_BASLIK + '''" onclick="sgkTahakkukGoruntule(\\'' + oid + '\\',\\'' + s.oid + '\\',false,false)">' +
    '<img src="data:," width="12" height="12" title="''' + HZM_BASLIK + '''" onclick="sgkHizmetGoruntule(\\'' + oid + '\\',\\'' + s.oid + '\\',false,false)">' +
    '<img src="data:," width="12" height="12" title="Mesaj" onclick="mesajButtonClick(\\'' + s.oid + '\\')"></td></tr>';
  document.getElementById('detay').innerHTML = '<div id="bynGoruntu" class="dialog"><span id="bynGoruntu_close" onclick=\\'Windows.close("bynGoruntu", event)\\'>x</span>' +
    '<table id="tahakkukTable"><tr><td>Vergilendirme Dönemi</td><td>Açıklama</td><td>Vergi Tahakkuku Durumu</td><td></td></tr>' +
    '<tr id="row' + e(oid) + '"><td>' + e(j.donem) + '</td><td>Vergi</td><td>' + e(j.vergiDurum) + '</td><td></td></tr>' + j.satirlar.map(satir).join('') + '</table>' +
    '<table><tr><td>1 - ' + (j.satirlar.length + 1) + ' / ' + (j.satirlar.length + 1) + ' <input type="button" value="&gt;" title="Sonraki Sayfa" disabled></td></tr></table></div>';
}
function mesajButtonClick() {}
</script>'''


def liste_html(yanit: dict) -> str:
    """Sorgu yanıtı (HTML): hata kutusu ya da "Beyanname Listesi" penceresi + sayfa sayacı (eski robotun canlı gözlemi)."""
    e = html.escape
    if 'hata' in yanit:
        return f'<div class="hata">{e(yanit["hata"])}</div>'

    def satir(k: dict) -> str:
        sgk = (f'<img src="data:," width="12" height="12" title="SGK Bildirimleri" onclick="beyannameSGKBildirimleriGoster(\'{e(k["oid"])}\',false)">'
               if k['sgk'] else '')
        hucreler = ''.join(f'<td>{e(str(x))}</td>' for x in (k['tur'], k['kimlik'], k['unvan'], k['vd'], k['donem'], k['sube'], k['yuklendi'],
                                                           k['vergiDurum'], k['sgkDurum']))
        return (f'<tr id="row{e(k["oid"])}" title="{e(k["xml"])} dosyası"><td>'
                f'<img src="data:," width="12" height="12" title="{BYN_BASLIK}" onclick="beyannameGoruntule(\'{e(k["oid"])}\',false,false)">'
                f'<img src="data:," width="12" height="12" title="{THK_BASLIK}" '
                f'onclick="tahakkukGoruntule(\'{e(k["oid"])}\',\'{e(k["tahakkukOid"])}\',false,false)">{sgk}</td>{hucreler}</tr>')

    sonraki = ' disabled' if yanit['son'] >= yanit['toplam'] else f' onclick="ara({yanit["sayfa"] + 1})"'
    return ('<div id="bynList1" class="dialog"><div>Beyanname Listesi</div>'
            '<span id="bynList1_close" class="alphacube_close" onclick="Windows.close(&quot;bynList1&quot;, event)">x</span>'
            '<table id="bynTable"><tr>' + ''.join(f'<td>{h}</td>' for h in HEADERS) + '</tr>' + ''.join(satir(k) for k in yanit['satirlar'])
            + '</table>' + f'<table><tr><td>{yanit["ilk"]} - {yanit["son"]} / {yanit["toplam"]} '
            f'<input type="button" value="&gt;" title="Sonraki Sayfa"{sonraki}></td></tr></table></div>')


def gorunum(k: dict) -> dict:
    return {'oid': k['oid'], 'tahakkukOid': k['tahakkukOid'], 'tur': k['tur'], 'kimlik': k['kimlik'], 'unvan': k['unvan'],
            'vd': k['vd'], 'donem': k['donem'], 'sube': k['sube'], 'yuklendi': k['yuklendi'].strftime('%d.%m.%Y - %H:%M:%S'),
            'vergiDurum': k['vergiDurum'], 'sgkDurum': k['sgkDurum'], 'xml': k['xml'], 'sgk': bool(k['sgk'])}


def tarih(parca: list) -> date | None:
    try:
        return date(int(parca[0]), int(parca[1]), int(parca[2]))
    except (ValueError, TypeError, IndexError):
        return None


def ara(kayitlar_kimlige_gore, istek: dict) -> dict:
    """Sorgu yanıtı: {hata} ya da {satirlar, ilk, son, toplam}. kayitlar_kimlige_gore(kimlik) → list | None (yetki yok)."""
    bas, bit = tarih(istek.get('bas')), tarih(istek.get('bit'))
    kimlik = str(istek.get('kimlik', ''))
    if not bas or not bit or bas > bit or bas.year != bit.year or (bit - bas) > timedelta(days=366):
        return {'hata': 'Hata: Gönderim zamanı aralığı geçersiz.'}
    if not kimlik.isdigit() or len(kimlik) != (11 if istek.get('tip') == 'T' else 10):
        return {'hata': 'Hata: Vergi kimlik numarası / TC kimlik numarası geçersiz.'}
    kayitlar = kayitlar_kimlige_gore(kimlik)
    bulunan = sorgu(kayitlar or [], bas, bit)
    if not bulunan:
        return {'hata': 'Hata: Sorgu yaptığınız kriterlere uyan beyanname bulunamamıştır.'}
    sayfa = max(1, int(istek.get('sayfa') or 1))
    ilk = (sayfa - 1) * SAYFA
    parca = bulunan[ilk:ilk + SAYFA]
    return {'satirlar': [gorunum(k) for k in parca], 'ilk': ilk + 1, 'son': ilk + len(parca), 'toplam': len(bulunan), 'sayfa': sayfa}
