"""Sahte GİB sunucusu (06 §7.2: sahte kurum sunucusu) — demo ve test için, canlı GİB değildir (D33).

Robot gerçek GİB adreslerine (https://dijital.gib.gov.tr, https://intvrg.gib.gov.tr) gider; demo/test ortamında tarayıcı
bağlamı bu istekleri buraya yönlendirir (/dijital/…, /intvrg/…). Sayfa yapısı eski robotun canlıda gözlenen akışını izler:
giriş + CAPTCHA → "Geçiş Yapılabilecek Uygulamalar" → İnternet Vergi Dairesi + yönlendirme onayı → E-Beyanname Yetki
Bilgileri → Geçerli E-Beyanname Sözleşmeleri Listesi (sayfalı, "Tümünü Göster", alt bilgide toplam); e-Beyanname kartı +
yönlendirme onayı → https://ebeyanname.gib.gov.tr (Beyanname Ara, liste, PDF'ler, MUHSGK SGK bildirimleri; ebeyanname.py).

Veri sentetiktir: kullanıcı koduna göre tohumlanmış, kontrol hanesi geçerli ama sahte VKN/TCKN (99 önekli TCKN).
Hesap kuralı: SAHTE_GIB_SIFRE (vars. demo-gib-sifre) ile her kullanıcı kodu girer; başka şifre "hatalı".
Çalıştırma: python -m tests.sahte_kurumlar.gib  (port SAHTE_GIB_PORT, vars. 8090)
"""
from __future__ import annotations

import html
import io
import json
import os
import random
import secrets
import threading
from collections import Counter
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

from PIL import Image, ImageDraw, ImageFont

from . import ebeyanname as ebyn

TITLE = 'Geçerli E-Beyanname Sözleşmeleri Listesi'
HEADERS = ('Mükellef Vergi Kimlik Numarası', 'Mükellef TC Kimlik Numarası', 'Mükellef Unvanı', 'Mükellef Vergi Dairesi',
           'Sözleşme Numarası', 'Sözleşme Tarihi', 'Hizmet Sözleşmesi Tarih ve No', 'Sisteme Giriş Tarihi', 'Sözleşme Türü')
SAYFA = 20
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

SIFRE = os.environ.get('SAHTE_GIB_SIFRE', 'demo-gib-sifre')
ADET = int(os.environ.get('SAHTE_GIB_SOZLESME_ADEDI', '45'))

_kilit = threading.Lock()
_captcha: dict[str, str] = {}          # oturum çerezi → beklenen kod
_dvd_oturum: dict[str, str] = {}       # dijital oturum → kullanıcı kodu
_ivd_belirtec: dict[str, str] = {}     # tek kullanımlık İVD geçiş belirteci → kullanıcı kodu
_ivd_oturum: dict[str, str] = {}       # intvrg oturum → kullanıcı kodu
_ebyn_belirtec: dict[str, str] = {}    # tek kullanımlık e-Beyanname geçiş belirteci → kullanıcı kodu
_ebyn_oturum: dict[str, str] = {}      # e-Beyanname oturumu → kullanıcı kodu
_ebyn_kayit: dict[tuple[str, str], dict] = {}  # (oturum, oid) → listelenen beyanname (belge/SGK detayı için)
_ebyn_token: dict[str, str] = {}       # e-Beyanname oturumu → sayfaya gömülü TOKEN (sorgu gövdesinde döner)
_ebyn_son: dict[str, dict] = {}        # e-Beyanname oturumu → son sorgu (sayfalama için)

# Yalnız testler için: kurum davranışını zorla (ör. ZORLA['ebeyanname_sorgu'] = 429) ve istekleri say. Demo yığını kullanmaz.
ZORLA: dict[str, int] = {}
SAYAC: Counter = Counter()


def _vkn(rnd: random.Random) -> str:
    d = [rnd.randrange(10) for _ in range(9)]
    toplam = 0
    for i, x in enumerate(d):
        t = (x + 9 - i) % 10
        toplam += 0 if t == 0 else ((t * 2 ** (9 - i)) % 9 or 9)
    return ''.join(map(str, d)) + str((10 - toplam % 10) % 10)


def _tckn(rnd: random.Random) -> str:
    d = [9, 9] + [rnd.randrange(10) for _ in range(7)]
    tek, cift = d[0] + d[2] + d[4] + d[6] + d[8], d[1] + d[3] + d[5] + d[7]
    d.append((tek * 7 - cift) % 10)
    d.append(sum(d) % 10)
    return ''.join(map(str, d))


SEHIR = ('Anadolu', 'Ege', 'Marmara', 'Akdeniz', 'Karadeniz', 'Trakya', 'Kapadokya', 'Toros', 'Fırat', 'Dicle')
ALAN = ('Gıda', 'Tekstil', 'İnşaat', 'Lojistik', 'Yazılım', 'Mobilya', 'Kimya', 'Turizm', 'Otomotiv', 'Tarım')
AD = ('Ayşe', 'Mehmet', 'Fatma', 'Ali', 'Zeynep', 'Mustafa', 'Elif', 'Ahmet', 'Emine', 'Hüseyin')
SOYAD = ('Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Yıldız', 'Aydın', 'Öztürk', 'Arslan', 'Doğan')
VD = ('Kadıköy', 'Beşiktaş', 'Çankaya', 'Konak', 'Nilüfer', 'Seyhan', 'Meram', 'Muratpaşa')


def sozlesmeler(kullanici: str) -> list[dict[str, str]]:
    """Kullanıcı koduna göre tekrarlanabilir sentetik sözleşme listesi."""
    rnd = random.Random(f'eworks-sahte-gib:{kullanici}')
    sonuc = []
    for i in range(ADET):
        sahis = rnd.random() < 0.3
        if sahis:
            vkn, tckn, unvan = '', _tckn(rnd), f'{rnd.choice(AD)} {rnd.choice(SOYAD)}'
        else:
            vkn, tckn = _vkn(rnd), ''
            unvan = f'{rnd.choice(SEHIR)} {rnd.choice(ALAN)} {"Sanayi ve Ticaret Limited Şirketi" if rnd.random() < .7 else "Anonim Şirketi"}'
        tarih = f'{rnd.randint(1, 28):02d}.{rnd.randint(1, 12):02d}.{rnd.randint(2015, 2026)}'
        sonuc.append({
            'taxNumber': vkn, 'identityNumber': tckn, 'name': unvan, 'taxOffice': rnd.choice(VD),
            'number': f'{rnd.randint(100000, 999999)}-{i + 1:03d}', 'date': tarih, 'service': f'{tarih} / {rnd.randint(1, 999)}',
            'registeredAt': tarih, 'type': 'Aracılık ve Sorumluluk Sözleşmesi' if rnd.random() < .85 else 'Yalnız Aracılık Sözleşmesi',
        })
    return sonuc


def _captcha_png(kod: str) -> bytes:
    rnd = random.Random(kod)
    img = Image.new('RGB', (150, 50), 'white')
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT, 30) if os.path.exists(FONT) else ImageFont.load_default()
    for j, ch in enumerate(kod):
        d.text((10 + j * 26, 8 + rnd.randint(-3, 3)), ch, fill=(20, 40, 90), font=font)
    for _ in range(3):
        d.line([(rnd.randint(0, 150), rnd.randint(0, 50)), (rnd.randint(0, 150), rnd.randint(0, 50))], fill=(160, 160, 160), width=1)
    b = io.BytesIO()
    img.save(b, 'PNG')
    return b.getvalue()


def _sayfa(baslik: str, govde: str) -> bytes:
    return (f'<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>{html.escape(baslik)}</title>'
            '<style>body{font-family:sans-serif;margin:16px}.kart{display:inline-block;padding:12px;border:1px solid #ccc;margin:6px;cursor:pointer}'
            'table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px}</style></head><body>' + govde + '</body></html>').encode('utf-8')


def _giris_sayfasi() -> bytes:
    return _sayfa('GİB Dijital Vergi Dairesi', '''
<h1>Dijital Vergi Dairesi</h1>
<label for="kullanici">Kullanıcı Kodu / T.C. Kimlik No</label> <input id="kullanici" type="text">
<label for="sifre">Şifre</label> <input id="sifre" type="password"><br>
<img id="captchaImg" alt="Güvenlik kodu (captcha)" src="/portal/captcha?r=1" width="150" height="50">
<label for="guvenlik">Güvenlik Kodu</label> <input id="guvenlik" type="text"><br>
<button id="giris" type="button">Giriş Yap</button>
<p id="hata" role="alert"></p>
<script>
document.getElementById('giris').addEventListener('click', async () => {
  const v = id => document.getElementById(id).value;
  const r = await fetch('/portal/api/giris', {method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({k: v('kullanici'), s: v('sifre'), g: v('guvenlik')})});
  const j = await r.json();
  if (j.tamam) { location.href = '/portal/anasayfa'; return; }
  document.getElementById('hata').textContent = j.hata;
  document.getElementById('guvenlik').value = '';
  document.getElementById('captchaImg').src = '/portal/captcha?r=' + Math.random();
});
</script>''')


def _anasayfa() -> bytes:
    return _sayfa('GİB Dijital Vergi Dairesi', '''
<h1>Dijital Vergi Dairesi</h1>
<section><h2>Geçiş Yapılabilecek Uygulamalar</h2>
<div class="kart" onclick="document.getElementById('onay').hidden=false"><p>İnternet Vergi Dairesi</p></div>
<div class="kart" onclick="document.getElementById('onayByn').hidden=false"><p>e-Beyanname</p></div></section>
<div id="onayByn" hidden><div>
<h3>Yönlendirmeyi Onaylıyor Musunuz?</h3>
<p>e-Beyanname uygulamasına geçiş yapmak üzeresiniz. Bu işlemle birlikte aktif e-Beyanname oturumlarınız da sonlandırılacaktır. Devam etmek istiyor musunuz?</p>
<button type="button" onclick="document.getElementById('onayByn').hidden=true">İPTAL ET</button>
<button type="button" onclick="fetch('/portal/api/ebyn',{method:'POST'}).then(r=>r.json()).then(j=>{location.href='https://ebeyanname.gib.gov.tr/eyeksite?token='+j.belirtec})">ONAYLA</button>
</div></div>
<div id="onay" hidden><div>
<h3>Yönlendirmeyi Onaylıyor Musunuz?</h3>
<p>İnternet Vergi Dairesi uygulamasına geçiş yapmak üzeresiniz. Bu işlemle birlikte aktif İnternet Vergi Dairesi oturumlarınız da sonlandırılacaktır. Devam etmek istiyor musunuz?</p>
<button type="button" onclick="document.getElementById('onay').hidden=true">İPTAL ET</button>
<button type="button" onclick="fetch('/portal/api/ivd',{method:'POST'}).then(r=>r.json()).then(j=>{location.href='https://intvrg.gib.gov.tr/intvrg_side/main.jsp?token='+j.belirtec})">ONAYLA</button>
</div></div>''')


def _ivd_ana() -> bytes:
    return _sayfa('İnternet Vergi Dairesi', f'''
<nav><ul><li><a href="#" onclick="document.getElementById('alt').hidden=false;return false">E-Beyanname Yetki Bilgileri</a>
<ul id="alt" hidden><li><a href="/intvrg_side/sozlesmeler">{TITLE}</a></li></ul></li></ul></nav>
<main><h1>İnternet Vergi Dairesi</h1></main>''')


def _liste(kullanici: str, tumu: bool) -> bytes:
    kayitlar = sozlesmeler(kullanici)
    gorunen = kayitlar if tumu else kayitlar[:SAYFA]
    satir = ''.join('<tr>' + ''.join(f'<td>{html.escape(v or "-----")}</td>' for v in (
        k['taxNumber'], k['identityNumber'], k['name'], k['taxOffice'], k['number'], k['date'], k['service'], k['registeredAt'], k['type'])) + '<td><a href="#">Görüntüle</a></td></tr>' for k in gorunen)
    dugme = ('<span style="cursor:pointer" onclick="location.href=\'?tumu=0\'">Sayfalı Göster</span>' if tumu
             else '<span style="cursor:pointer" onclick="location.href=\'?tumu=1\'">Tümünü Göster</span>')
    alt = f'<tr><td colspan="{len(HEADERS) + 1}">1 - {len(gorunen)} listeleniyor. Toplam : {len(kayitlar)} {dugme}</td></tr>'
    baslik = '<tr>' + ''.join(f'<th>{h}</th>' for h in HEADERS) + '<th>Görüntüle</th></tr>'
    return _sayfa(TITLE, f'<h1>{TITLE}</h1><table>{baslik}{satir}{alt}</table>')


def _beyannameler(kullanici: str, kimlik: str) -> list[dict] | None:
    """Yalnız müşavirin sözleşme listesindeki mükellefin beyannameleri (yetki yoksa None)."""
    for s in sozlesmeler(kullanici):
        if kimlik in (s['taxNumber'], s['identityNumber']):
            return ebyn.beyannameler(kimlik, s['name'], s['taxOffice'])
    return None


class Isleyici(BaseHTTPRequestHandler):
    server_version = 'SahteGIB/1.0'

    def log_message(self, *a):  # istek günlüğü yazılmaz (gövde/çerez içerebilir)
        pass

    def _cerez(self, ad: str) -> str | None:
        for parca in (self.headers.get('Cookie') or '').split(';'):
            k, _, v = parca.strip().partition('=')
            if k == ad:
                return v
        return None

    def _yanit(self, durum: int, govde: bytes, tur='text/html; charset=utf-8', cerez: str | None = None, yer: str | None = None):
        self.send_response(durum)
        self.send_header('Content-Type', tur)
        self.send_header('Content-Length', str(len(govde)))
        self.send_header('Cache-Control', 'no-store')
        if cerez:
            self.send_header('Set-Cookie', cerez + '; Path=/; HttpOnly; Secure; SameSite=Lax')
        if yer:
            self.send_header('Location', yer)
        self.end_headers()
        self.wfile.write(govde)

    def _json(self, deger: dict, cerez: str | None = None):
        self._yanit(200, json.dumps(deger, ensure_ascii=False).encode('utf-8'), 'application/json; charset=utf-8', cerez)

    def do_GET(self):  # noqa: N802
        u = urlsplit(self.path)
        q = parse_qs(u.query)
        if u.path == '/saglik':
            return self._json({'durum': 'ok'})
        if u.path == '/dijital/portal/login':
            oturum = secrets.token_hex(16)
            with _kilit:
                _captcha[oturum] = ''.join(random.choice('0123456789') for _ in range(5))
            return self._yanit(200, _giris_sayfasi(), cerez=f'DVDGIRIS={oturum}')
        if u.path == '/dijital/portal/captcha':
            oturum = self._cerez('DVDGIRIS')
            with _kilit:
                if not oturum or oturum not in _captcha:
                    return self._yanit(404, b'')
                _captcha[oturum] = ''.join(random.choice('0123456789') for _ in range(5)) if q.get('r', ['1'])[0] != '1' else _captcha[oturum]
                kod = _captcha[oturum]
            return self._yanit(200, _captcha_png(kod), 'image/png')
        if u.path == '/dijital/portal/anasayfa':
            if self._cerez('DVD') not in _dvd_oturum:
                return self._yanit(302, b'', yer='/portal/login')
            return self._yanit(200, _anasayfa())
        if u.path == '/intvrg/intvrg_side/main.jsp':
            belirtec = q.get('token', [''])[0]
            with _kilit:
                kullanici = _ivd_belirtec.pop(belirtec, None)
                if kullanici is None and self._cerez('IVD') not in _ivd_oturum:
                    return self._yanit(403, _sayfa('Yetkisiz', '<p>Oturum bulunamadı.</p>'))
                cerez = None
                if kullanici is not None:
                    oturum = secrets.token_hex(16)
                    _ivd_oturum[oturum] = kullanici
                    cerez = f'IVD={oturum}'
            return self._yanit(200, _ivd_ana(), cerez=cerez)
        if u.path == '/intvrg/intvrg_side/sozlesmeler':
            kullanici = _ivd_oturum.get(self._cerez('IVD') or '')
            if kullanici is None:
                return self._yanit(403, _sayfa('Yetkisiz', '<p>Oturum bulunamadı.</p>'))
            return self._yanit(200, _liste(kullanici, q.get('tumu', ['0'])[0] == '1'))
        if u.path == '/ebeyanname/eyeksite':
            belirtec = q.get('token', [''])[0]
            with _kilit:
                kullanici = _ebyn_belirtec.pop(belirtec, None)
                if kullanici is None and self._cerez('EBYN') not in _ebyn_oturum:
                    return self._yanit(403, _sayfa('Yetkisiz', '<p>Oturum bulunamadı.</p>'))
                cerez = None
                oturum = self._cerez('EBYN') or ''
                if kullanici is not None:
                    oturum = secrets.token_hex(16)
                    _ebyn_oturum[oturum] = kullanici
                    _ebyn_token[oturum] = secrets.token_urlsafe(18)
                    cerez = f'EBYN={oturum}'
                belirtec = _ebyn_token.get(oturum, '')
            return self._yanit(200, _sayfa('e-Beyanname', ebyn.uygulama_sayfasi(belirtec)), cerez=cerez)
        if u.path == '/ebeyanname/eyeksite/sgk':
            oturum = self._cerez('EBYN') or ''
            k = _ebyn_kayit.get((oturum, q.get('oid', [''])[0]))
            if k is None or not k['sgk']:
                return self._json({'hata': 'Hata: SGK bildirimi bulunamadı.'})
            return self._json({'donem': k['donem'], 'vergiDurum': k['vergiDurum'], 'satirlar': k['sgk']})
        if u.path == '/ebeyanname/dispatch' and q.get('cmd', [''])[0] == 'IMAJ':
            oturum = self._cerez('EBYN') or ''
            if oturum not in _ebyn_oturum or q.get('TOKEN', [''])[0] != _ebyn_token.get(oturum):
                return self._yanit(401, _sayfa('Yetkisiz', '<p>Oturum geçersiz.</p>'))
            k = _ebyn_kayit.get((oturum, q.get('oid', [''])[0]))
            tur = q.get('tur', [''])[0]
            if k is None:
                return self._yanit(200, _sayfa('Hata', '<p>Belge bulunamadı.</p>'))
            if tur == 'beyanname':
                govde = ebyn.beyanname_pdf(k)
            elif tur == 'tahakkuk' and q.get('toid', [''])[0] == k['tahakkukOid']:
                govde = ebyn.tahakkuk_pdf(k)
            elif tur in ('sgk_tahakkuk', 'sgk_hizmet'):
                s = next((x for x in k['sgk'] if x['oid'] == q.get('soid', [''])[0]), None)
                if s is None:
                    return self._yanit(200, _sayfa('Hata', '<p>EBIL_GD_BILDIRGE Kayıt Yok</p>'))
                govde = ebyn.sgk_tahakkuk_pdf(k, s) if tur == 'sgk_tahakkuk' else ebyn.hizmet_pdf(k, s)
            else:
                return self._yanit(404, b'')
            return self._yanit(200, govde, 'application/pdf')
        if u.path.startswith('/nager/api/v3/PublicHolidays/') and u.path.endswith('/TR'):
            yil = u.path.split('/')[-2]
            if not yil.isdigit():
                return self._yanit(404, b'')
            return self._yanit(200, json.dumps(_nager(int(yil)), ensure_ascii=False).encode('utf-8'), 'application/json; charset=utf-8')
        return self._yanit(404, _sayfa('Bulunamadı', '<p>Sayfa bulunamadı.</p>'))

    def do_POST(self):  # noqa: N802
        u = urlsplit(self.path)
        uzunluk = min(int(self.headers.get('Content-Length') or 0), 8192)
        govde = self.rfile.read(uzunluk) if uzunluk else b''
        if u.path == '/dijital/portal/api/giris':
            try:
                v = json.loads(govde or b'{}')
            except ValueError:
                return self._json({'tamam': False, 'hata': 'İstek geçersiz.'})
            oturum = self._cerez('DVDGIRIS')
            with _kilit:
                beklenen = _captcha.get(oturum or '')
            if not beklenen or str(v.get('g', '')).strip() != beklenen:
                return self._json({'tamam': False, 'hata': 'Güvenlik kodu hatalı. Lütfen tekrar deneyiniz.'})
            kullanici = str(v.get('k', '')).strip()
            if not kullanici or v.get('s') != SIFRE:
                return self._json({'tamam': False, 'hata': 'Kullanıcı kodu veya şifre hatalı.'})
            yeni = secrets.token_hex(16)
            with _kilit:
                _dvd_oturum[yeni] = kullanici
                _captcha.pop(oturum or '', None)
            return self._json({'tamam': True}, cerez=f'DVD={yeni}')
        if u.path == '/dijital/portal/api/ebyn':
            kullanici = _dvd_oturum.get(self._cerez('DVD') or '')
            if kullanici is None:
                return self._yanit(403, b'{}', 'application/json')
            belirtec = secrets.token_urlsafe(24)
            with _kilit:
                _ebyn_belirtec[belirtec] = kullanici
            return self._json({'belirtec': belirtec})
        if u.path == '/ebeyanname/dispatch':
            return _ebyn_sorgu_isle(self, govde)
        if u.path == '/gib/api/gibportal/vergiTakvimi/specification/listAll':
            return self._json(_vergi_takvimi(govde))
        if u.path == '/dijital/portal/api/ivd':
            kullanici = _dvd_oturum.get(self._cerez('DVD') or '')
            if kullanici is None:
                return self._yanit(403, b'{}', 'application/json')
            belirtec = secrets.token_urlsafe(24)
            with _kilit:
                _ivd_belirtec[belirtec] = kullanici
            return self._json({'belirtec': belirtec})
        return self._yanit(404, b'')


AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']


def _vergi_takvimi(govde: bytes) -> dict:
    """GİB vergi takvimi listAll (2026-10-27'de gözlenen zarf ve süzgeç): stopdate yıl aralığındaki kayıtlar tek yanıtta.
    Veri sentetiktir (her ay KDV 28, muhtasar ve prim hizmet 26, e-defter beratı); canlı takvim değildir."""
    try:
        suzgec = json.loads(govde or b'{}').get('searchRequestListDTOS') or []
        alt = next(f['value'] for f in suzgec if f.get('column') == 'stopdate' and f.get('operation') == 'GREATER_THAN')
        yil = int(alt[:4]) + 1
    except (ValueError, StopIteration, TypeError, KeyError, AttributeError):
        return {'status': 400, 'statusMessage': 'Hatalı istek', 'messages': [], 'resultContainer': []}
    kayitlar = []
    for ay in range(1, 13):
        onceki = f'Aralık {yil - 1}' if ay == 1 else f'{AYLAR[ay - 2]} {yil}'
        for no, (gun, baslik, konu, aciklama) in enumerate([
            (28, 'Katma Değer Vergisinin Beyan ve Ödemesi', 'Beyan ve Ödeme', f'{onceki} Dönemine Ait Katma Değer Vergisinin Beyanı ve Ödemesi'),
            (26, 'Gelir ve Kurumlar Vergisi Tevkifatlarının Beyan ve Ödemesi', 'Beyan ve Ödeme', f'{onceki} Dönemine Ait Tevkifatların Muhtasar ve Prim Hizmet Beyannamesi ile Beyanı ve Ödemesi'),
            (27, 'Elektronik Defter Beratları', 'Berat', f'{onceki} Dönemine Ait Elektronik Defter Beratlarının Yüklenmesi'),
        ]):
            kayitlar.append({'id': yil * 1000 + ay * 10 + no, 'title': baslik, 'description': aciklama, 'startdate': f'{yil}-{ay:02d}-01T00:00:00',
                             'stopdate': f'{yil}-{ay:02d}-{gun:02d}T00:00:00', 'priority': 1, 'taxType': 'SAHTE', 'periodDescription': f'{onceki} Dönemi',
                             'subject': konu, 'startDateBeforeStopDate': True})
    return {'status': 200, 'statusMessage': 'İşlem başarılı', 'messages': [], 'resultContainer': sorted(kayitlar, key=lambda k: k['stopdate'])}


def _nager(yil: int) -> list:
    """Nager.Date (2026-10-27'de gözlenen biçim): sentetik tarihler; dinî bayramlar "(Tentative Date)" ekli."""
    sabit = [('01-01', 'Yılbaşı'), ('04-23', 'Ulusal Egemenlik ve Çocuk Bayramı'), ('05-01', 'İşçi Bayramı'), ('05-19', 'Gençlik ve Spor Bayramı'),
             ('07-15', 'Demokrasi ve Millî Birlik Günü'), ('08-30', 'Zafer Bayramı'), ('10-29', 'Cumhuriyet Bayramı')]
    out = [{'date': f'{yil}-{g}', 'localName': ad, 'name': ad, 'countryCode': 'TR', 'types': ['Public']} for g, ad in sabit]
    out += [{'date': f'{yil}-03-{10 + i:02d}', 'localName': f'Ramazan Bayramı {i + 1}. Gün (Tentative Date)', 'name': 'Eid al-Fitr (Tentative Date)',
             'countryCode': 'TR', 'types': ['Public']} for i in range(3)]
    out += [{'date': f'{yil}-05-{16 + i:02d}', 'localName': f'Kurban Bayramı {i + 1}. Gün (Tentative Date)', 'name': 'Eid al-Adha (Tentative Date)',
             'countryCode': 'TR', 'types': ['Public']} for i in range(4)]
    return sorted(out, key=lambda x: x['date'])


def _tarih_parcasi(deger: str) -> list[str]:
    return [deger[:4], deger[4:6], deger[6:8]] if len(deger) == 8 and deger.isdigit() else []


def _ebyn_sorgu_isle(isleyici: 'Isleyici', govde: bytes):
    """POST /dispatch: ilk sayfa (tarihli sorgu) ya da sonraki sayfa; yanıt HTML (hata kutusu ya da liste)."""
    oturum = isleyici._cerez('EBYN') or ''
    kullanici = _ebyn_oturum.get(oturum)
    alanlar = {k: v[0] for k, v in parse_qs(govde.decode('utf-8', 'replace'), keep_blank_values=True).items()}
    if kullanici is None or alanlar.get('TOKEN') != _ebyn_token.get(oturum):
        return isleyici._yanit(401, _sayfa('Yetkisiz', '<p>Oturum geçersiz.</p>'))
    cmd = alanlar.get('cmd')
    if cmd == 'BEYANNAMELISTESI':
        SAYAC['ebeyanname_sorgu'] += 1
        if ZORLA.get('ebeyanname_sorgu'):
            return isleyici._yanit(ZORLA['ebeyanname_sorgu'], _sayfa('Hata', '<p>İşlem reddedildi.</p>'))
        tc = alanlar.get('sorguTipiT') == '1'
        istek = {'tip': 'T' if tc else 'N', 'kimlik': alanlar.get('tcKimlikNo' if tc else 'vergiNo', ''),
                 'bas': _tarih_parcasi(alanlar.get('baslangicTarihi', '')), 'bit': _tarih_parcasi(alanlar.get('bitisTarihi', '')), 'sayfa': 1}
        with _kilit:
            _ebyn_son[oturum] = istek
    elif cmd == 'BEYANNAMELISTESI_SAYFA' and oturum in _ebyn_son:
        istek = {**_ebyn_son[oturum], 'sayfa': int(alanlar.get('sayfa') or 1)}
    else:
        return isleyici._yanit(400, _sayfa('Hata', '<p>İstek geçersiz.</p>'))
    yanit = ebyn.ara(lambda kimlik: _beyannameler(kullanici, kimlik), istek)
    if 'satirlar' in yanit:
        with _kilit:
            for k in _beyannameler(kullanici, str(istek.get('kimlik'))) or []:
                _ebyn_kayit[(oturum, k['oid'])] = k
    return isleyici._yanit(200, ebyn.liste_html(yanit).encode('utf-8'))



def baslat(port: int = 0) -> ThreadingHTTPServer:
    """Testler için arka planda başlatır; port 0 → boş port."""
    sunucu = ThreadingHTTPServer(('0.0.0.0', port), Isleyici)
    threading.Thread(target=sunucu.serve_forever, daemon=True).start()
    return sunucu


if __name__ == '__main__':
    port = int(os.environ.get('SAHTE_GIB_PORT', '8090'))
    print(f'Sahte GİB {port} portunda (demo/test; canlı GİB değildir)', flush=True)
    ThreadingHTTPServer(('0.0.0.0', port), Isleyici).serve_forever()
