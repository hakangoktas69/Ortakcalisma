"""Merkezi hız sınırlayıcı (02 §4, D7/D11/D25): Redis'te GCRA. Paralel işçilerin hepsi aynı kurum bütçesini paylaşır.
Bağlantı hatasında hız yarıya iner (çarpan, 10 dk sonra kendiliğinden düzelir); başarı çarpanı yavaşça geri getirir."""
from __future__ import annotations

import asyncio
import time

LUA = """
local tat = tonumber(redis.call('GET', KEYS[1]) or ARGV[1])
local now, interval, burst = tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])
if tat < now then tat = now end
local allow_at = tat - burst
if now < allow_at then return allow_at - now end
redis.call('SET', KEYS[1], tat + interval, 'PX', math.ceil(tat + interval - now + 1000))
return 0
"""


def gcra(tat: float | None, simdi: float, aralik: float, tolerans: float) -> tuple[float, float]:
    """Saf GCRA (Lua betiğinin aynısı; birim testli). Dönüş: (bekleme_ms, yeni_tat). Bekleme > 0 ise istek ertelenir."""
    tat = simdi if tat is None or tat < simdi else tat
    izin = tat - tolerans
    if simdi < izin:
        return izin - simdi, tat
    return 0.0, tat + aralik


class HizSinirlayici:
    def __init__(self, redis, kurum: str, dakikada: int, tolerans_istek: int = 3):
        self.redis = redis
        self.anahtar = f'hiz:{kurum}'
        self.carpan_anahtari = f'hiz:{kurum}:carpan'
        self.dakikada = dakikada
        self.tolerans_istek = tolerans_istek
        self._betik = redis.register_script(LUA)

    async def _carpan(self) -> float:
        v = await self.redis.get(self.carpan_anahtari)
        return max(0.25, min(1.0, float(v))) if v else 1.0

    async def izin(self, en_cok_sn: float = 120.0) -> None:
        bitis = time.monotonic() + en_cok_sn
        while True:
            hiz = max(1.0, self.dakikada * await self._carpan())
            aralik = 60_000.0 / hiz
            bekle_ms = float(await self._betik(keys=[self.anahtar], args=[int(time.time() * 1000), int(aralik), int(aralik * self.tolerans_istek)]))
            if bekle_ms <= 0:
                return
            if time.monotonic() + bekle_ms / 1000 > bitis:
                raise TimeoutError('Kurum istek bütçesi dolu; iş sonra yeniden denenmeli.')
            await asyncio.sleep(bekle_ms / 1000)

    async def baglanti_hatasi(self) -> None:
        yeni = max(0.25, await self._carpan() / 2)
        await self.redis.set(self.carpan_anahtari, yeni, ex=600)
