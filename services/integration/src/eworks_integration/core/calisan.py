"""Entegrasyon işçisi (Python ACL): robot.gib kuyruğundan iş alır, kurumdan okur, sonucu yayımlanmış dilde S3'e yazar ve
entegrasyon.sonuc kuyruğuna kimlik mesajı gönderir. Alan tablolarına yazmaz (06 §4); yalnız işi sahiplenen ve o işin kurum
hesabı sırrını okuyan veritabanı fonksiyonlarını çağırır. Günlüğe kişisel veri, şifre ve kurum yanıtı yazılmaz.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from datetime import datetime, timezone

import aio_pika
import boto3
import psycopg
from playwright.async_api import async_playwright
from redis import asyncio as aioredis

from ..institutions.gib.giris import GirisBasarisiz, YanlisSifre, giris_yap
from ..institutions.gib.sozlesmeler import ListeHatasi, sozlesme_listesi_oku, to_contract
from ..transports.robot.tarayici import Tarayici
from .ayarlar import Ayarlar, yukle
from .captcha import CaptchaCozucu
from .hiz import HizSinirlayici

EXCHANGE, DLX = 'eworks', 'eworks.dlx'
ROBOT_GIB, SONUC, DLQ = 'robot.gib', 'entegrasyon.sonuc', 'eworks.dlq'
ARGUMANLAR = {'x-queue-type': 'quorum', 'x-dead-letter-exchange': DLX, 'x-delivery-limit': 5}
UUID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')

log = logging.getLogger('eworks.entegrasyon')


def gunluk(olay: str, **ek):
    log.info(json.dumps({'zaman': datetime.now(timezone.utc).isoformat(), 'olay': olay, **ek}, ensure_ascii=False))


class HesapKullanilamaz(Exception):
    pass


def isi_sahiplen(url: str, org: str, job: str):
    with psycopg.connect(url, autocommit=True) as c:
        return c.execute('select sync.claim_job(%s, %s)', (org, job)).fetchone()[0]


def is_sirri(url: str, org: str, job: str) -> dict:
    try:
        with psycopg.connect(url, autocommit=True) as c:
            return c.execute('select credentials.secret_for_job(%s, %s)', (org, job)).fetchone()[0]
    except psycopg.Error as e:
        if getattr(e, 'sqlstate', None) in ('55000', 'P0002'):
            raise HesapKullanilamaz() from None
        raise


class Calisan:
    def __init__(self, a: Ayarlar):
        self.a = a
        self.redis = aioredis.from_url(a.redis_url)
        self.hiz = HizSinirlayici(self.redis, 'GIB', a.gib_istek_dk)
        self.cozucu = CaptchaCozucu()
        self.s3 = boto3.client('s3', endpoint_url=a.s3_endpoint, aws_access_key_id=a.s3_erisim, aws_secret_access_key=a.s3_gizli, region_name=a.s3_bolge)
        self.kanal = None
        self.exchange = None

    async def yayimla(self, mesaj: dict):
        await self.exchange.publish(
            aio_pika.Message(json.dumps(mesaj, ensure_ascii=False).encode('utf-8'), content_type='application/json', delivery_mode=aio_pika.DeliveryMode.PERSISTENT),
            routing_key=SONUC)

    async def isle(self, ham: bytes):
        m = json.loads(ham)
        org, job, shard, kind = m.get('orgId', ''), m.get('jobId', ''), m.get('shard', ''), m.get('kind', '')
        if not UUID.match(org) or not UUID.match(job) or shard not in self.a.shardlar or kind != 'gib.sozlesmeler':
            gunluk('gecersiz_mesaj')
            return
        url = self.a.shardlar[shard]
        if await asyncio.to_thread(isi_sahiplen, url, org, job) is None:
            gunluk('is_zaten_islenmis')  # en az bir kez teslim: tekrar gelen mesaj etkisiz
            return

        async def ilerleme(metin: str):
            await self.yayimla({'orgId': org, 'jobId': job, 'outcome': 'progress', 'message': metin})

        try:
            kimlik = await asyncio.to_thread(is_sirri, url, org, job)
        except HesapKullanilamaz:
            return await self.yayimla({'orgId': org, 'jobId': job, 'outcome': 'failed', 'message': 'Kurum hesabı kullanılamaz durumda (hatalı şifre ya da kilit).'})
        try:
            async with async_playwright() as p, Tarayici(p, self.hiz, self.a.sahte_gib) as t:
                ctx = await t.baglam()
                try:
                    await ilerleme('GİB girişi yapılıyor (güvenlik kodu otomatik).')
                    await giris_yap(await ctx.new_page(), kimlik, self.cozucu, ilerleme)
                    await ilerleme('Giriş yapıldı; sözleşme listesine gidiliyor.')
                    kayitlar = await sozlesme_listesi_oku(ctx, ilerleme)
                finally:
                    await ctx.close()
            anahtar = f'org/{org}/sonuc/{job}.json'
            govde = json.dumps(to_contract(job, kayitlar, bool(self.a.sahte_gib)), ensure_ascii=False).encode('utf-8')
            await asyncio.to_thread(self.s3.put_object, Bucket=self.a.s3_bucket, Key=anahtar, Body=govde, ContentType='application/json')
            await self.yayimla({'orgId': org, 'jobId': job, 'outcome': 'ok', 'resultKey': anahtar})
            gunluk('is_tamam', adet=len(kayitlar))
        except YanlisSifre:
            await self.yayimla({'orgId': org, 'jobId': job, 'outcome': 'wrong_password'})
            gunluk('hatali_sifre')
        except (GirisBasarisiz, ListeHatasi) as e:
            await self.yayimla({'orgId': org, 'jobId': job, 'outcome': 'failed', 'message': str(e)[:500]})
            gunluk('is_basarisiz', tur=type(e).__name__)
        except Exception as e:  # noqa: BLE001 — kurum yanıtı/şifre metni dışarı sızmasın diye sabit metin
            await self.hiz.baglanti_hatasi()
            await self.yayimla({'orgId': org, 'jobId': job, 'outcome': 'failed', 'message': f'Kurum işi tamamlanamadı ({type(e).__name__}).'})
            gunluk('is_hatasi', tur=type(e).__name__)
        finally:
            kimlik.clear()

    async def calis(self):
        await asyncio.to_thread(self._kova_hazirla)
        baglanti = await aio_pika.connect_robust(self.a.rabbitmq_url, client_properties={'connection_name': 'eworks-entegrasyon'})
        async with baglanti:
            self.kanal = await baglanti.channel()
            await self.kanal.set_qos(prefetch_count=1)
            ex = self.exchange = await self.kanal.declare_exchange(EXCHANGE, aio_pika.ExchangeType.TOPIC, durable=True)
            dlx = await self.kanal.declare_exchange(DLX, aio_pika.ExchangeType.FANOUT, durable=True)
            dlq = await self.kanal.declare_queue(DLQ, durable=True, arguments={'x-queue-type': 'quorum'})
            await dlq.bind(dlx, '')
            kuyruklar = {}
            for ad in (ROBOT_GIB, SONUC):
                kuyruklar[ad] = await self.kanal.declare_queue(ad, durable=True, arguments=ARGUMANLAR)
                await kuyruklar[ad].bind(ex, ad)
            gunluk('entegrasyon_basladi', sahte_gib=bool(self.a.sahte_gib), hiz=self.a.gib_istek_dk)
            async with kuyruklar[ROBOT_GIB].iterator() as it:
                async for msg in it:
                    async with msg.process(requeue=False):
                        try:
                            await asyncio.wait_for(self.isle(msg.body), timeout=self.a.is_zaman_asimi_sn)
                        except asyncio.TimeoutError:
                            gunluk('is_zaman_asimi')

    def _kova_hazirla(self):
        try:
            self.s3.head_bucket(Bucket=self.a.s3_bucket)
        except Exception:  # noqa: BLE001
            try:
                self.s3.create_bucket(Bucket=self.a.s3_bucket)
            except Exception:  # noqa: BLE001 — başka süreç aynı anda açmış olabilir
                pass


def main():
    logging.basicConfig(level=logging.INFO, format='%(message)s')
    asyncio.run(Calisan(yukle()).calis())


if __name__ == '__main__':
    main()
