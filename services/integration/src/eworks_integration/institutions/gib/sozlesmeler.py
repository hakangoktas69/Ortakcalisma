"""Geçerli E-Beyanname Sözleşmeleri Listesi okuyucusu — eski robotun canlıda doğrulanmış mantığı (portal_worker.discover,
prepare_list, footer_counts; gib_automation.scrape_contract_table, validate_contracts). Fail-closed: başlık, sayfa veya
toplam tutmazsa sonuç üretilmez. Çıktı yayımlanmış dildir: contracts/integration/eworks.gib.contracts.v1.
"""
from __future__ import annotations

import asyncio
import re
import time
from datetime import datetime, timezone

from ...transports.robot.tarayici import gib_alani
from .gezinme import TITLE, advance_navigation, visible_target

HEADERS = ('Mükellef Vergi Kimlik Numarası', 'Mükellef TC Kimlik Numarası', 'Mükellef Unvanı', 'Mükellef Vergi Dairesi',
           'Sözleşme Numarası', 'Sözleşme Tarihi', 'Hizmet Sözleşmesi Tarih ve No', 'Sisteme Giriş Tarihi', 'Sözleşme Türü')
FIELDS = ('taxNumber', 'identityNumber', 'name', 'taxOffice', 'number', 'date', 'service', 'registeredAt', 'type')


class ListeHatasi(ValueError):
    pass


def normalized(text):
    return ' '.join((text or '').split()).casefold()


def footer_counts(text):
    values = re.findall(r'(\d+)\s*-\s*(\d+)\s+listeleniyor\.?\s*Toplam\s*:\s*(\d+)', text, re.I)
    unique = set(tuple(map(int, v)) for v in values)
    if len(unique) > 1:
        raise ListeHatasi('Birden fazla toplam kayıt sayısı görüldü; liste belirsiz.')
    if not unique:
        return None
    first, last, total = unique.pop()
    if not 1 <= first <= last <= total <= 100000:
        raise ListeHatasi('GİB toplam kayıt bilgisi geçersiz.')
    return first, last, total


async def discover(context):
    """Yalnız gözlenen başlıkları eşleşen görünür tabloyu tanır → (frame, tablo_indeksi, gözlenen_başlıklar) | None."""
    matches = []
    expected = tuple(map(normalized, HEADERS))
    for page in context.pages:
        if not gib_alani(page.url):
            continue
        for frame in page.frames:
            if not gib_alani(frame.url):
                continue
            heading = frame.get_by_text(TITLE, exact=True)
            if await heading.count() != 1 or not await heading.is_visible():
                continue
            tables = frame.locator('table')
            for index in range(await tables.count()):
                table = tables.nth(index)
                if not await table.is_visible():
                    continue
                observed = tuple(t.strip() for t in await table.locator('tr').first.locator('th,td').all_inner_texts())
                # Canlı ekranda son sütun "Görüntüle" eylemidir; başka bilinmeyen sütun kabul edilmez
                if tuple(map(normalized, observed)) not in (expected, expected + ('görüntüle',)):
                    continue
                matches.append((frame, index, observed))
    if len(matches) > 1:
        raise ListeHatasi('Birden fazla sözleşme listesi açık.')
    return matches[0] if matches else None


async def prepare_list(context, frame, index, headers):
    """Tümünü Göster'i açar; toplamı bağımsız alt bilgiden okur. Tüm satırlar görününce toplamı döner."""
    clicked = False
    row_count = total = 0
    for _ in range(80):
        totals = footer_counts(await frame.locator('body').inner_text())
        if totals is None:
            raise ListeHatasi('Liste toplam bilgisi tanınmadı; sonuç kaydedilmedi.')
        first, last, total = totals
        table = frame.locator('table').nth(index)
        widths = [await row.locator('td').count() for row in (await table.locator('tr').all())[1:]]
        row_count = sum(w == len(headers) for w in widths)
        if first == 1 and last == total and row_count == total:
            return total
        if not clicked:
            target = await visible_target(context, 'Tümünü Göster')
            if target is not None:
                await target.click(timeout=5000)
                clicked = True
        await asyncio.sleep(0.25)
    raise ListeHatasi(f'Tablo: {row_count} veri satırı; GİB toplamı: {total}. Liste tamamlanamadı; veri yazılmadı.')


async def scrape(frame, index, headers, expected_count):
    table = frame.locator('table').nth(index)
    actual = tuple(t.strip() for t in await table.locator('tr').first.locator('th,td').all_inner_texts())
    if actual != headers:
        raise ListeHatasi('Tablo başlıkları değişti; sütun eşlemesi yeniden doğrulanmalı.')
    contracts = []
    for row in (await table.locator('tr').all())[1:]:
        cells = await row.locator('td').all_inner_texts()
        if not cells:
            continue
        if len(cells) != len(headers):
            paging = re.search(r'\d+\s*-\s*\d+\s+listeleniyor\.?\s*Toplam\s*:\s*\d+', ' '.join(cells), re.I)
            colspan = await row.locator('td').first.get_attribute('colspan')
            if len(cells) == 1 and colspan == str(len(headers)) and paging:
                continue  # sayfalama alt bilgisi veri değildir
            raise ListeHatasi('Beklenmeyen tablo satırı veya sütun sayısı.')
        record = {field: cells[i].strip() for i, field in enumerate(FIELDS)}
        for field in ('taxNumber', 'identityNumber'):
            if record[field] in ('-', '-----'):
                record[field] = ''
        contracts.append(record)
    validate_contracts(contracts, expected_count)
    return contracts


def validate_contracts(contracts, expected_count):
    if type(expected_count) is not int or expected_count <= 0 or len(contracts) != expected_count:
        raise ListeHatasi('GİB toplamı ile satır sayısı uyuşmuyor veya liste boş.')
    seen = set()
    for r in contracts:
        if any(not isinstance(r.get(k), str) for k in FIELDS):
            raise ListeHatasi('Sözleşme alanları geçersiz.')
        vkn, tckn = r['taxNumber'], r['identityNumber']
        if (not vkn and not tckn) or (vkn and not re.fullmatch(r'[0-9]{10}', vkn)) or (tckn and not re.fullmatch(r'[0-9]{11}', tckn)):
            raise ListeHatasi('Geçersiz VKN/TCKN.')
        if not r['name'].strip() or not r['number'].strip():
            raise ListeHatasi('Unvan veya sözleşme numarası eksik.')
        key = (vkn or tckn, r['number'])
        if key in seen:
            raise ListeHatasi('Tekrarlanan sözleşme; aktarım durduruldu.')
        seen.add(key)


def to_contract(job_id: str, contracts: list[dict], sahte: bool) -> dict:
    """Yayımlanmış dil (eworks.gib.contracts.v1). Uzunluklar şema sınırına kırpılır."""
    sinir = {'name': 300, 'taxOffice': 120, 'number': 100, 'date': 40, 'service': 200, 'registeredAt': 40, 'type': 200}
    temiz = [{k: (v[:sinir[k]] if k in sinir else v) for k, v in c.items()} for c in contracts]
    return {'schema': 'eworks.gib.contracts.v1', 'jobId': job_id, 'sourceType': 'sahte_gib' if sahte else 'gib_live',
            'observedAt': datetime.now(timezone.utc).isoformat(), 'count': len(temiz), 'contracts': temiz}


async def sozlesme_listesi_oku(context, ilerleme=None, sure_sn: float = 120) -> list[dict]:
    """Girişten sonra menüleri izleyip listeyi bulur, tümünü açar, doğrular ve okur."""
    visited: set[str] = set()
    bitis = time.monotonic() + sure_sn
    while time.monotonic() < bitis:
        found = await discover(context)
        if found is not None:
            frame, index, headers = found
            if ilerleme:
                await ilerleme('Sözleşme listesi bulundu; toplam doğrulanıyor.')
            total = await prepare_list(context, frame, index, headers)
            return await scrape(frame, index, headers, total)
        moved = await advance_navigation(context, visited)
        if moved and ilerleme:
            await ilerleme(f'GİB menüsünde ilerleniyor: {moved}.')
        await asyncio.sleep(0.5 if moved else 1)
    raise ListeHatasi('Sözleşme listesine ulaşılamadı (menü değişmiş olabilir); veri yazılmadı.')
