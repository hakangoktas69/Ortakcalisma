"""e-Beyanname servis yolu politikası (D38; Eworks 2 service_transport + declaration_service): hangi istek sorgu ya da belge sayılır,
sorgu gövdesi kapsamla nasıl doğrulanır, yanıt nasıl sınıflanır. Genel taşıma `transports/service/http_tasima.py`'dedir.

Uçlar ve alanlar Eworks 2'den gelir; Eworks 2 bunlarla 23.10.2026'da canlıda çalıştı (Mert, VALIDATION.md). Doğrulama yalnız
alan adlarına, oturum belirtecinin varlığına, tarih biçim kümesine ve kimliğe dayanır; `cmd` değerine ve sayfalama alanına
bağlı değildir (bunlar gözlenmedi). Bu uyarlamanın canlı kaydı ayrıca girilir (D33).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from urllib.parse import parse_qsl, urlsplit

from ...core.hatalar import KaynakEngelledi, KaynakYanitHatasi

KAYNAK_HOST = 'ebeyanname.gib.gov.tr'
SORGU_ALANLARI = frozenset({'TOKEN', 'cmd', 'sorguTipiZ', 'baslangicTarihi', 'bitisTarihi', 'sorguTipiN', 'sorguTipiT', 'vergiNo',
                            'tcKimlikNo', 'sorguTipiP', 'donemBasAy', 'donemBasYil', 'donemBitAy', 'donemBitYil', 'sorguTipiB',
                            'beyannameTanim', 'sorguTipiV', 'vdKodu', 'sorguTipiD', 'durum'})
ACIK = frozenset({'on', 'true', '1'})
TARIH_BICIMLERI = ('%d%m%Y', '%Y%m%d', '%d.%m.%Y', '%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y')
GOVDE_SINIRI = 65536
SORGU_YANIT_SINIRI = 2_000_000
PDF_YANIT_SINIRI = 20 * 1024 * 1024


@dataclass(frozen=True)
class Kapsam:
    """Tek mükellef × tek aralık. esler: aynı mükellefin sözleşme listesindeki diğer kimliği (VKN ↔ TCKN)."""
    kimlik: str
    esler: tuple[str, ...]
    bas: date
    bit: date


def kaynak_adresi(url: str) -> bool:
    p = urlsplit(url)
    return (p.scheme == 'https' and p.hostname == KAYNAK_HOST and p.port in (None, 443) and not p.username and not p.password
            and p.path == '/dispatch')


def sorgu_istegi_mi(yontem: str, url: str, govde: str) -> bool:
    return yontem == 'POST' and kaynak_adresi(url) and 'baslangicTarihi=' in govde and 'bitisTarihi=' in govde


def pdf_istegi_mi(yontem: str, url: str) -> bool:
    return yontem == 'GET' and kaynak_adresi(url) and dict(parse_qsl(urlsplit(url).query)).get('cmd') == 'IMAJ'


def tarih_bicimi(deger: str, beklenen: date) -> str:
    for b in TARIH_BICIMLERI:
        if beklenen.strftime(b) == deger:
            return b
    raise ValueError('Servis sorgusunun tarih kapsamı doğrulanamadı.')


def sorgu_dogrula(govde: str, kapsam: Kapsam) -> dict[str, str]:
    """Sorgu gövdesi kapsamın birebir karşılığı değilse ValueError (mesaj sabit; gövde ve belirteç içermez)."""
    if len(govde) > GOVDE_SINIRI:
        raise ValueError('Servis sorgu kapsamı aşıldı.')
    try:
        ciftler = parse_qsl(govde, keep_blank_values=True, strict_parsing=True, max_num_fields=35)
    except ValueError:
        raise ValueError('Servis sorgu alanları değişti.') from None
    alanlar = dict(ciftler)
    if len(ciftler) != len(alanlar) or not set(alanlar) <= SORGU_ALANLARI:
        raise ValueError('Servis sorgu alanları değişti.')
    if not alanlar.get('TOKEN') or not alanlar.get('cmd') or alanlar.get('sorguTipiZ') not in ACIK:
        raise ValueError('Servis sorgu oturumu veya gönderim zamanı süzgeci doğrulanamadı.')
    tarih_bicimi(alanlar.get('baslangicTarihi', ''), kapsam.bas)
    tarih_bicimi(alanlar.get('bitisTarihi', ''), kapsam.bit)
    etkin = [a for a in ('sorguTipiN', 'sorguTipiT') if alanlar.get(a) in ACIK]
    if len(etkin) != 1:
        raise ValueError('Servis VKN/TCKN filtresi doğrulanamadı.')
    vkn = etkin[0] == 'sorguTipiN'
    secilen = alanlar.get('vergiNo' if vkn else 'tcKimlikNo', '')
    if secilen not in {kapsam.kimlik, *kapsam.esler} or len(secilen) != (10 if vkn else 11):
        raise ValueError('Servis mükellef kapsamı eşleşmedi.')
    if any(alanlar.get(a) in ACIK for a in ('sorguTipiB', 'sorguTipiV', 'sorguTipiD')):
        raise ValueError('Servis sorgusunda beklenmeyen ek filtre var.')
    if alanlar.get('sorguTipiP') in ACIK:
        # Dönem süzgecinin servis değerleri gözlenmedi; robot yalnız gönderim zamanıyla sorgular
        raise ValueError('Servis dönem filtresi eşleşmedi.')
    return alanlar


def yanit_sinifla(durum: int, url: str, tur: str, boyut: int, *, sorgu: bool) -> None:
    engel = durum_engeli(durum)
    if engel is not None:
        raise engel
    if durum != 200:
        raise KaynakYanitHatasi('SOURCE_HTTP', f'GİB servis yanıtı başarısız (HTTP {durum}).', durum)
    if not kaynak_adresi(url):
        raise KaynakYanitHatasi('SOURCE_ORIGIN', 'GİB servis yanıtının kaynağı doğrulanamadı.')
    if boyut > (SORGU_YANIT_SINIRI if sorgu else PDF_YANIT_SINIRI):
        raise KaynakYanitHatasi('SOURCE_SIZE', 'GİB servis yanıtı boyut sınırını aştı.')
    if sorgu and not tur.lower().startswith('text/html'):
        raise KaynakYanitHatasi('SOURCE_FORMAT', 'GİB sorgu yanıt türü değişti.')


def durum_engeli(durum: int) -> KaynakEngelledi | None:
    """Kurumun işi durduran yanıtı: oturum reddi ya da hız sınırı (sayfalama gibi üstlenilmeyen isteklerde de gözlenir)."""
    if durum in (401, 403):
        return KaynakEngelledi('SOURCE_AUTH', 'GİB oturumu geçersiz; kalan kapsam sorgulanmadı.', durum)
    if durum == 429:
        return KaynakEngelledi('SOURCE_RATE_LIMIT', 'GİB hız sınırı bildirdi; istek tekrarlanmadı, kalan kapsam sorgulanmadı.', durum)
    return None


class EbeyannamePolitikasi:
    """ServisTasima'ya verilen kurum politikası."""
    desen = 'https://ebeyanname.gib.gov.tr/dispatch*'
    kaynak_adresi = staticmethod(kaynak_adresi)
    durum_engeli = staticmethod(durum_engeli)

    @staticmethod
    def istek_turu(yontem: str, url: str, govde: str) -> str | None:
        if sorgu_istegi_mi(yontem, url, govde):
            return 'sorgu'
        if pdf_istegi_mi(yontem, url):
            return 'pdf'
        return None

    @staticmethod
    def dogrula(tur: str, govde: str, kapsam: Kapsam) -> None:
        if tur == 'sorgu':
            sorgu_dogrula(govde, kapsam)

    @staticmethod
    def sinifla(tur: str, durum: int, url: str, icerik_turu: str, boyut: int) -> None:
        yanit_sinifla(durum, url, icerik_turu, boyut, sorgu=tur == 'sorgu')


EBEYANNAME = EbeyannamePolitikasi()
