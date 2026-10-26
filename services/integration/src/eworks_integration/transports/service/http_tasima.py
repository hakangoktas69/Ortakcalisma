"""Servis erişim yolu (D38): aynı kurum oturumunda doğrulanmış HTTP taşıma — Eworks 2 service_transport'un genel uyarlaması.

Robot kuruma tarayıcıyla girer ve formu yine kendisi gönderir. Bu katman, kurum politikasının (ör. institutions/gib/
ebeyanname_servis.py) sorgu ya da belge saydığı isteği tarayıcıdan ÖNCE yakalar:

- istek kapsamla doğrulanır (politika); doğrulanamazsa kuruma GİTMEZ,
- merkezi hız sınırlayıcıdan geçer (kural 5) ve aynı oturumla BİR kez gönderilir (yönlendirme ve yeniden deneme yok),
- yanıt sınıflanır: kurum engeli (401/403/429) kalıcıdır, sonrasında bu bağlamda kuruma hiçbir istek gönderilmez; diğer
  sapmalar yalnız o isteği düşürür,
- doğrulanan yanıt tarayıcıya döner (gövde çözülmüş hâliyle; kodlama/uzunluk başlıkları ayıklanır); tablo, sayfalama ve belge
  denetimleri robot katmanında yine zorunludur,
- üstlenilmeyen istekler (ör. sayfalama) robot yolundan gider; yanıtlarındaki kurum engeli de gözlenir (ek istek yok).

Belirteç, gövde, çerez ve yanıt içeriği loga, hataya, diske yazılmaz. Resmi bir kurum web servisi değildir.
"""
from __future__ import annotations

import asyncio

from ...core.hatalar import KaynakEngelledi, KaynakHatasi, KaynakYanitHatasi
from ..robot.tarayici import sahte_adres, sahte_istek

# Playwright gövdeyi çözülmüş verir; özgün kodlama/uzunluk başlıklarıyla iletmek tarayıcıda gövdeyi bozar
ATILAN_BASLIKLAR = frozenset({'content-encoding', 'content-length', 'transfer-encoding'})


def yanit_basliklari(basliklar: dict[str, str]) -> dict[str, str]:
    return {k: v for k, v in basliklar.items() if k.lower() not in ATILAN_BASLIKLAR}


class ServisTasima:
    """Bağlama eklenen yönlendirme. Kapsam açıkken politikanın sorgu/belge saydığı istekleri üstlenir, kalanını robota bırakır."""

    def __init__(self, context, politika, hiz=None, sahte_kurum: str | None = None):
        self.context = context
        self.politika = politika
        self.hiz = hiz
        self.sahte_kurum = sahte_kurum
        self.kapsam = None
        self.hata: KaynakHatasi | None = None
        self.engel: KaynakEngelledi | None = None
        self.sayac = {'sorgu': 0, 'pdf': 0, 'hata': 0}

    async def bagla(self):
        # Sonra eklenen yönlendirme önce çalışır: robotun '**/*' yönlendirmesi geri dönüş (fallback) olarak kalır
        await self.context.route(self.politika.desen, self._isle)
        self.context.on('response', self._gozle)

    def kapsam_ac(self, kapsam):
        self.kapsam, self.hata = kapsam, None

    def kapsam_kapat(self):
        self.kapsam = None

    def hata_al(self) -> KaynakHatasi | None:
        """Son hata; engel kalıcıdır (temizlenmez, `engel` alanında kalır)."""
        h, self.hata = self.hata, None
        return h or self.engel

    def _hata_koy(self, h: KaynakHatasi):
        if isinstance(h, KaynakEngelledi) and self.engel is None:
            self.engel = h
        self.hata = self.engel or h  # engel sonraki bir yanıt hatasıyla ezilmez

    def _gozle(self, yanit):
        if self.kapsam is not None and self.engel is None and self.politika.kaynak_adresi(yanit.url):
            engel = self.politika.durum_engeli(yanit.status)
            if engel is not None:
                self._hata_koy(engel)

    async def _getir(self, route):
        istek = route.request
        if self.sahte_kurum:
            # Demo/test: kuruma çıkılmaz; aynı istek sahte kuruma gider, köken olarak özgün kurum adresi korunur
            basliklar = await istek.all_headers()
            durum, liste, govde = await asyncio.to_thread(sahte_istek, sahte_adres(self.sahte_kurum, istek.url), istek.method, basliklar,
                                                          istek.post_data_buffer)
            return durum, dict(liste), govde, istek.url
        yanit = await route.fetch(timeout=30000, max_redirects=0, max_retries=0)
        try:
            return yanit.status, yanit.headers, await yanit.body(), yanit.url
        finally:
            await yanit.dispose()

    async def _reddet(self, route):
        self.sayac['hata'] += 1
        await route.fulfill(status=502, content_type='text/plain; charset=utf-8', body='Eworks: kaynak yaniti dogrulanamadi.')

    async def _isle(self, route):
        istek = route.request
        if self.engel is not None:
            return await self._reddet(route)  # kurum engeli: bu bağlamda kuruma başka istek gitmez
        govde = istek.post_data or ''
        tur = self.politika.istek_turu(istek.method, istek.url, govde)
        if self.kapsam is None or tur is None:
            return await route.fallback()
        try:
            try:
                self.politika.dogrula(tur, govde, self.kapsam)
            except ValueError as e:
                raise KaynakYanitHatasi('SOURCE_SCOPE', f'{e} İstek gönderilmedi.') from None
            if self.hiz is not None:
                try:
                    await self.hiz.izin()
                except TimeoutError:
                    raise KaynakEngelledi('LOCAL_BUDGET', 'Kurum istek bütçesi dolu; iş sonra yeniden denenmeli.') from None
            durum, basliklar, ham, son_url = await self._getir(route)
            icerik_turu = next((v for k, v in basliklar.items() if k.lower() == 'content-type'), '')
            self.politika.sinifla(tur, durum, son_url, icerik_turu, len(ham))
            if tur == 'sorgu':
                self.sayac['sorgu'] += 1
            elif ham.startswith(b'%PDF-'):
                self.sayac['pdf'] += 1  # "kayıt yok" HTML'i PDF sayılmaz; robot katmanı sınıflar
            return await route.fulfill(status=durum, headers=yanit_basliklari(basliklar), body=ham)
        except KaynakHatasi as e:
            self._hata_koy(e)
        except Exception as e:  # noqa: BLE001 — URL, belirteç, gövde istisnadan sızmasın
            ad = type(e).__name__.lower()
            self._hata_koy(KaynakYanitHatasi('SOURCE_TIMEOUT', 'Kurum servis isteği zaman aşımına uğradı.') if 'timeout' in ad
                           else KaynakYanitHatasi('SOURCE_TRANSPORT', 'Kurum servis taşıması tamamlanamadı.'))
        await self._reddet(route)
