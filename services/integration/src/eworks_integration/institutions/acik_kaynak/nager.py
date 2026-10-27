"""Nager.Date (açık kaynak, MIT) Türkiye resmî tatilleri: GET https://date.nager.at/api/v3/PublicHolidays/{yıl}/TR.

Biçim (2026-10-27'de 2027 için gözlendi): [{date, localName, name, types, …}]; Ramazan (3 gün) ve Kurban (4 gün) Bayramı
"<Ad> Bayramı N. Gün" adıyla, ilan edilmemiş yıllarda "(Tentative Date)" ekiyle gelir; arifeler yoktur (takvim kuralı ekler).
Yalnız bayramların ilk günleri ve kesinlik çıkarılır; sabit tatiller yasadan hesaplanır (2429 sayılı Kanun). Fail-closed:
günlerden biri eksikse ya da ardışık değilse sonuç kullanılmaz.
"""
from __future__ import annotations

import asyncio
import json
import re
import urllib.error
import urllib.request
from datetime import date, timedelta

KAYNAK = 'https://date.nager.at'
GUNLER = {'Ramazan': 3, 'Kurban': 4}


class BayramHatasi(Exception):
    pass


def adres(yil: int, sahte_kok: str | None) -> str:
    yol = f'/api/v3/PublicHolidays/{yil}/TR'
    return f"{sahte_kok.rstrip('/')}/nager{yol}" if sahte_kok else f'{KAYNAK}{yol}'


def bayramlari_ayristir(liste, yil: int) -> dict:
    if not isinstance(liste, list) or len(liste) > 100:
        raise BayramHatasi('sema')
    gunler: dict[tuple[str, int], tuple[date, bool]] = {}
    for x in liste:
        if not isinstance(x, dict) or not isinstance(x.get('localName'), str) or not isinstance(x.get('date'), str):
            raise BayramHatasi('alan')
        m = re.match(r'^(Ramazan|Kurban) Bayramı (\d)\. Gün', x['localName'])
        if not m:
            continue
        try:
            g = date.fromisoformat(x['date'])
        except ValueError:
            raise BayramHatasi('tarih') from None
        gunler[(m.group(1), int(m.group(2)))] = (g, 'Tentative' in x['localName'])
    out: dict = {'certain': True}
    for ad, adet in GUNLER.items():
        ilk = gunler.get((ad, 1))
        if ilk is None or ilk[0].year != yil:
            raise BayramHatasi('eksik')
        for i in range(2, adet + 1):
            g = gunler.get((ad, i))
            if g is None or g[0] != ilk[0] + timedelta(days=i - 1):
                raise BayramHatasi('ardisik_degil')
        out['ramazan' if ad == 'Ramazan' else 'kurban'] = ilk[0].isoformat()
        out['certain'] = out['certain'] and not any(gunler[(ad, i)][1] for i in range(1, adet + 1))
    return {'ramazan': out['ramazan'], 'kurban': out['kurban'], 'certain': out['certain']}


def _get(url: str) -> tuple[int, bytes]:
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={'Accept': 'application/json'}), timeout=20) as y:  # noqa: S310 — sabit adres
            return y.status, y.read(200_001)
    except urllib.error.HTTPError as h:
        return h.code, b''


async def resmi_tatilleri_oku(yil: int, hiz, sahte_kok: str | None) -> dict:
    if hiz is not None:
        await hiz.izin()
    durum, ham = await asyncio.to_thread(_get, adres(yil, sahte_kok))
    if durum != 200 or len(ham) > 200_000:
        raise BayramHatasi('yanit')
    try:
        return bayramlari_ayristir(json.loads(ham), yil)
    except ValueError:
        raise BayramHatasi('sema') from None
