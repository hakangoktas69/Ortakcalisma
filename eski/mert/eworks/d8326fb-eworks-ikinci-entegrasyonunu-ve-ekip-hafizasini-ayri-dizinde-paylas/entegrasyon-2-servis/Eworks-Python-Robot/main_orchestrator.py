"""Tek kullanıcı isteğiyle çalışan yönetici; zamanlayıcı ve sabit şifre içermez."""
from __future__ import annotations

import asyncio
import argparse
import getpass
import json
import os
from pathlib import Path
from uuid import UUID

from dotenv import load_dotenv
from playwright.async_api import Page, async_playwright
from supabase import create_client
from supabase.client import ClientOptions

from gib_automation import (
    ConfirmCaptcha, GibSelectors, scrape_contract_table,
    solve_captcha_and_login, validate_contracts,
)
from logger_service import LoggerService


def save_contracts_to_supabase(
    contracts_data: list[dict], musavir_id: str, *,
    expected_count: int, logger: LoggerService,
) -> int:
    """Tek upsert isteği; firma, müşavir ve sözleşme birlikte benzersizdir."""
    owner = str(UUID(musavir_id))
    validate_contracts(contracts_data, expected_count, owner)
    records = [{
        "musavir_id": owner,
        "mukellef_vkn_tckn": item["taxNumber"] or item["identityNumber"],
        "mukellef_unvan": item["name"],
        "sozlesme_no": item["number"],
        "durum": "Geçerli",
        "veriler": {k: v for k, v in item.items() if k != "musavir_id"},
    } for item in contracts_data]
    logger.write_log(owner, "Supabase Aktarım", "BİLGİ", "Doğrulanmış sözleşmeler kaydediliyor.")
    try:
        # Farklı müşavirlerin kayıtları aynı VKN yüzünden birbirini ezmez.
        logger.client.table("gib_sozlesmeler").upsert(
            records, on_conflict="musavir_id,mukellef_vkn_tckn,sozlesme_no",
        ).execute()
    except Exception as exc:
        logger.write_log(owner, "Supabase Aktarım", "HATA",
                         f"Kaydetme tamamlanamadı ({type(exc).__name__}).")
        raise RuntimeError("Supabase kaydı doğrulanamadı; işlem başarılı sayılmadı.") from None
    logger.write_log(owner, "Supabase Aktarım", "BAŞARILI", f"{len(records)} sözleşme kaydedildi.")
    return len(records)


async def start_robot_flow(
    vkn: str, sifre: str, musavir_id: str, *,
    access_token: str, selectors: GibSelectors, expected_count: int,
    confirm_captcha: ConfirmCaptcha,
    open_contract_list,  # async callback: doğru sözleşme Page'ini döndürmeli
    use_ocr: bool = False, existing_page: Page | None = None,
) -> int:
    """Token/şifre yalnızca bellekte. Mevcut Page verilirse giriş tekrarlanmaz.

    existing_page Playwright'ın zaten yönettiği oturumdan gelmelidir. Rastgele
    açık Chrome sekmesine kendiliğinden bağlanmaz; kullanıcı tarayıcısını kapatmaz.
    """
    selectors.validate(require_login=existing_page is None)
    owner = str(UUID(musavir_id))
    if type(expected_count) is not int or expected_count <= 0:
        raise ValueError("Güncel toplam sözleşme sayısını sağlayın.")
    logger = LoggerService.from_access_token(access_token)
    user = await asyncio.to_thread(logger.client.auth.get_user, access_token)
    if user.user is None or str(user.user.id) != owner:
        raise ValueError("Supabase oturumu ile müşavir UUID'si eşleşmiyor.")

    async def collect_and_save(page: Page, already_logged_in: bool) -> int:
        if not already_logged_in:
            ok = await solve_captcha_and_login(
                page, vkn, sifre, owner, selectors=selectors, logger=logger,
                confirm_captcha=confirm_captcha, use_ocr=use_ocr,
            )
            if not ok:
                raise RuntimeError("GİB girişi tamamlanmadı; aktarım iptal edildi.")
        # GİB menü/popup geçişinin gerçek uygulaması callback'te sağlanmalıdır.
        contracts_page = await open_contract_list(page)
        data = await scrape_contract_table(
            contracts_page, owner, selectors=selectors,
            expected_count=expected_count, logger=logger,
        )
        return await asyncio.to_thread(
            save_contracts_to_supabase, data, owner,
            expected_count=expected_count, logger=logger,
        )

    if existing_page is not None:
        return await collect_and_save(existing_page, True)
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(channel="chrome", headless=False)
        try:
            context = await browser.new_context()
            page = await context.new_page()
            return await collect_and_save(page, False)
        finally:
            await browser.close()  # yalnızca bu fonksiyonun açtığı tarayıcı


def load_selectors(path: Path) -> GibSelectors:
    if not path.is_file():
        raise ValueError("gib-selectors.json eksik: gerçek tablo seçicileri ve başlık eşlemesi gerekli.")
    raw = json.loads(path.read_text(encoding="utf-8-sig"))
    raw["headers"] = tuple(raw.get("headers", []))
    config = GibSelectors(**raw)
    config.validate(require_login=False)
    return config


async def _interactive_run(config: GibSelectors) -> int:
    """GİB şifresi kaynak koda veya .env'ye alınmaz; giriş Chrome'da yapılır."""
    url, key = os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"]
    email = (await asyncio.to_thread(input, "Eworks/Supabase hesabınızın e-postası: ")).strip()
    password = await asyncio.to_thread(getpass.getpass, "Eworks/Supabase şifresi (gizli): ")
    client = create_client(url, key, options=ClientOptions(
        persist_session=False, auto_refresh_token=False, postgrest_client_timeout=10,
    ))
    try:
        auth = await asyncio.to_thread(client.auth.sign_in_with_password,
                                       {"email": email, "password": password})
    except Exception:
        raise RuntimeError("Supabase girişi tamamlanamadı. Hesap bilgilerini kontrol edin.") from None
    finally:
        password = ""
    if auth.user is None or auth.session is None:
        raise RuntimeError("Supabase kullanıcı oturumu oluşmadı.")
    owner = str(UUID(str(auth.user.id)))
    logger = LoggerService(client)
    # Yalnızca şema/yetki kontrolü: mevcut mükellef kayıtları okunmaz.
    for table in ("sistem_loglari", "gib_sozlesmeler"):
        try:
            await asyncio.to_thread(lambda: client.table(table).select("musavir_id").limit(0).execute())
        except Exception:
            raise RuntimeError(f"{table} tablosu veya erişim yetkisi hazır değil; SQL kurulumunu kontrol edin.") from None
    async with async_playwright() as p:
        browser = await p.chromium.launch(channel="chrome", headless=False)
        try:
            context = await browser.new_context()
            page = await context.new_page()
            await page.goto("https://dijital.gib.gov.tr/portal/login", wait_until="domcontentloaded")
            print("Açılan Chrome'da müşavir hesabıyla giriş yapıp güvenlik kodunu kendiniz girin.")
            print("Geçerli E-Beyanname Sözleşmeleri Listesi'ni açın. Bu oturum ayrı Chrome penceresindedir.")
            await asyncio.to_thread(input, "Liste hazır olduğunda burada Enter'a basın: ")
            candidates = []
            for current in context.pages:
                from urllib.parse import urlsplit
                host = (urlsplit(current.url).hostname or "").lower()
                if not (host == "gib.gov.tr" or host.endswith(".gib.gov.tr")):
                    continue
                root = current.frame_locator(config.frame) if config.frame else current
                if await root.locator(config.list_heading).count() == 1:
                    candidates.append(current)
            if len(candidates) != 1:
                raise ValueError("Tek bir sözleşme listesi ekranı bulunamadı; tablo seçicilerini ve açık sekmeleri kontrol edin.")
            count_text = await asyncio.to_thread(input, "GİB ekranındaki toplam sözleşme sayısı: ")
            count = int(count_text.strip())
            records = await scrape_contract_table(candidates[0], owner, selectors=config,
                                                  expected_count=count, logger=logger)
            saved = await asyncio.to_thread(save_contracts_to_supabase, records, owner,
                                            expected_count=count, logger=logger)
            print(f"Supabase'e {saved} sözleşme kaydedildi.")
            return 0
        finally:
            await browser.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Eworks GİB sözleşme aktarımı")
    parser.add_argument("--check", action="store_true", help="Yalnızca yerel yapılandırmayı kontrol et")
    parser.add_argument("--config", type=Path, default=Path(__file__).with_name("gib-selectors.json"))
    args = parser.parse_args()
    load_dotenv(Path(__file__).with_name(".env"), override=False)
    try:
        if (not os.environ.get("SUPABASE_URL", "").startswith("https://")
                or not os.environ.get("SUPABASE_KEY", "")):
            raise ValueError(".env dosyasında Supabase URL ve publishable key gerekli.")
        config = load_selectors(args.config)
        if args.check:
            print("Yerel ayarlar hazır. Canlı GİB hedefleri ve Supabase yetkileri henüz test edilmedi.")
            return 0
        return asyncio.run(_interactive_run(config))
    except (KeyboardInterrupt, EOFError):
        print("İşlem kullanıcı tarafından durduruldu.")
        return 1
    except (ValueError, RuntimeError) as exc:
        print(f"Başlatılamadı: {exc}")
        return 2
    except Exception as exc:
        # Ham ağ/tarayıcı hatalarında URL, token veya mükellef verisi bulunabilir.
        print(f"Aktarım tamamlanamadı ({type(exc).__name__}).")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
