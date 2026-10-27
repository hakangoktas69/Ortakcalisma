"""GİB vergi takvimi (kamuya açık, kimlik doğrulaması yok): gib.gov.tr/vergi-takvimi sayfasının kullandığı listAll ucu.

Gözlem (2026-10-27): POST /api/gibportal/vergiTakvimi/specification/listAll?page=0&size=10&sortFieldName=stopdate&sortType=ASC,
gövde {globalOperator, searchRequestListDTOS:[{column, value, joinTable, operation, formatDate, formatBoolean}]}, yanıt
{status, statusMessage, messages, resultContainer:[{id, title, description, startdate, stopdate, priority, taxType,
periodDescription, subject, startDateBeforeStopDate}]}. stopdate yıl aralığı süzgeci 2026 için tek yanıtta 466 tekil kayıt
döndürdü (Mert'in 26.10 anlık görüntüsüyle aynı); sayfalama uygulanmıyor, toplam alanı yok. Doğrulama fail-closed: durum,
şema, tekillik, yıl ve zorunlu alanlar; biri tutmazsa liste hiç kullanılmaz. Kuruma giden istek hız sınırlayıcıdan geçer.
"""
from __future__ import annotations

import asyncio
import json
import urllib.error
import urllib.request

KAYNAK = 'https://gib.gov.tr/vergi-takvimi'
YOL = '/api/gibportal/vergiTakvimi/specification/listAll?page=0&size=10&sortFieldName=stopdate&sortType=ASC'
AZAMI_KAYIT = 3000
ALANLAR = ('id', 'title', 'description', 'stopdate', 'periodDescription', 'subject')


class TakvimHatasi(Exception):
    """Kod: kurum_yaniti | sema | alan | tekrar | yil_disi | bos (kullanıcıya sabit metin, kurum yanıtı içermez)."""


def istek_govdesi(yil: int) -> dict:
    def suzgec(deger: str, islem: str) -> dict:
        return {'column': 'stopdate', 'value': deger, 'joinTable': 'subject', 'operation': islem, 'formatDate': True, 'formatBoolean': False}
    return {'globalOperator': 'AND', 'searchRequestListDTOS': [suzgec(f'{yil - 1}-12-31T23:59:59', 'GREATER_THAN'), suzgec(f'{yil + 1}-01-01T00:00:00', 'LESS_THAN')]}


def liste_adresi(sahte_kok: str | None) -> str:
    """Canlıda gib.gov.tr; demo/test'te sahte GİB'in /gib önekli yolu (tarayıcı yönlendirmesiyle aynı eşleme)."""
    return f"{sahte_kok.rstrip('/')}/gib{YOL}" if sahte_kok else f'https://gib.gov.tr{YOL}'


def _metin(v, bos_olabilir=False) -> bool:
    return isinstance(v, str) and len(v) <= 4000 and (bos_olabilir or bool(v.strip()))


def yil_kayitlari(yanit: dict, yil: int) -> list[dict]:
    if not isinstance(yanit, dict) or yanit.get('status') != 200:
        raise TakvimHatasi('kurum_yaniti')
    kayitlar = yanit.get('resultContainer')
    if not isinstance(kayitlar, list) or len(kayitlar) > AZAMI_KAYIT:
        raise TakvimHatasi('sema')
    if not kayitlar:
        raise TakvimHatasi('bos')
    out = []
    for k in kayitlar:
        if not isinstance(k, dict) or type(k.get('id')) is not int or not all(_metin(k.get(a)) for a in ('title', 'description', 'stopdate', 'subject')) \
                or not (k.get('periodDescription') is None or _metin(k.get('periodDescription'), True)):
            raise TakvimHatasi('alan')
        if not k['stopdate'].startswith(f'{yil}-'):
            raise TakvimHatasi('yil_disi')
        out.append({'id': k['id'], 'title': k['title'].strip(), 'description': k['description'].strip(), 'stopdate': k['stopdate'][:19],
                    'periodDescription': (k.get('periodDescription') or '').strip(), 'subject': k['subject'].strip()})
    if len({k['id'] for k in out}) != len(out):
        raise TakvimHatasi('tekrar')
    return sorted(out, key=lambda k: (k['stopdate'], k['id']))


def to_snapshot(kayitlar: list[dict], yil: int, kontrol: str) -> dict:
    """Yayımlanmış dil: eworks.gib.tax-calendar.v1 (workspace takviminin GİB kaynağı)."""
    return {'schema': 'eworks.gib.tax-calendar.v1', 'year': yil, 'checkedAt': kontrol, 'sourceUrl': KAYNAK, 'count': len(kayitlar), 'records': kayitlar}


def _post(adres: str, govde: dict) -> tuple[int, bytes]:
    istek = urllib.request.Request(adres, data=json.dumps(govde).encode('utf-8'), method='POST',
                                   headers={'Content-Type': 'application/json', 'Accept': 'application/json', 'Origin': 'https://gib.gov.tr', 'Referer': KAYNAK})
    try:
        with urllib.request.urlopen(istek, timeout=20) as y:  # noqa: S310 — sabit kurum adresi ya da yapılandırılmış sahte sunucu
            return y.status, y.read(2_000_001)
    except urllib.error.HTTPError as h:
        return h.code, b''


async def vergi_takvimi_oku(yil: int, hiz, sahte_kok: str | None) -> list[dict]:
    if hiz is not None:
        await hiz.izin()
    durum, ham = await asyncio.to_thread(_post, liste_adresi(sahte_kok), istek_govdesi(yil))
    if durum != 200 or len(ham) > 2_000_000:
        raise TakvimHatasi('kurum_yaniti')
    try:
        yanit = json.loads(ham)
    except ValueError:
        raise TakvimHatasi('sema') from None
    return yil_kayitlari(yanit, yil)
