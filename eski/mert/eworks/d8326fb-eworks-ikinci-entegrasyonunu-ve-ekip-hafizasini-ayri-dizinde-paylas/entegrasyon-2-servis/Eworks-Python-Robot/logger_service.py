"""Supabase işlem logları. Her robot işi kendi LoggerService örneğini kullanır."""
from __future__ import annotations

import logging
import os
import re
from pathlib import Path
from uuid import UUID

from dotenv import load_dotenv
from supabase import Client, create_client
from supabase.client import ClientOptions

_console = logging.getLogger(__name__)


def _safe_message(value: str) -> str:
    # Ek koruma: çağıran kod yine de şifre, çerez ve ham mükellef verisi vermemeli.
    value = re.sub(r"(?i)Bearer\s+\S+", "Bearer [GİZLENDİ]", str(value))
    value = re.sub(r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", "[TOKEN]", value)
    value = re.sub(
        r"(?i)\b(password|şifre|sifre|access_token|refresh_token|apikey|cookie)\s*[:=]\s*\S+",
        r"\1=[GİZLENDİ]", value,
    )
    value = re.sub(r"(?<!\d)\d{10,11}(?!\d)", "[KİMLİK GİZLENDİ]", value)
    return value.replace("\r", " ").replace("\n", " ")[:2000]


class LoggerService:
    def __init__(self, client: Client):
        """Kimliği doğrulanmış, bu işe ait Supabase istemcisini alın."""
        self.client = client

    @classmethod
    def from_access_token(cls, access_token: str) -> LoggerService:
        """Kısa ömürlü kullanıcı tokenını bellekte alın; diske kaydetmeyin."""
        load_dotenv(Path(__file__).with_name(".env"), override=False)
        url = os.environ.get("SUPABASE_URL", "").strip()
        key = os.environ.get("SUPABASE_KEY", "").strip()
        if not url.startswith("https://") or not key or not access_token.strip():
            raise ValueError("Supabase URL, publishable key ve kullanıcı oturumu gerekli.")
        if key.startswith("sb_secret_"):
            raise ValueError("Yerel robotta secret anahtarı kullanmayın.")
        client = create_client(url, key, options=ClientOptions(
            headers={"Authorization": f"Bearer {access_token}"},
            persist_session=False, auto_refresh_token=False,
            postgrest_client_timeout=10,
        ))
        return cls(client)

    def write_log(self, musavir_id: str, islem_adi: str, durum: str, mesaj: str) -> bool:
        """Başarıda True; kaydedilemeyen logda False döndürür. Otomatik tekrar yok."""
        try:
            owner_id = str(UUID(str(musavir_id)))
            record = {
                "musavir_id": owner_id,
                "islem_adi": _safe_message(islem_adi)[:120],
                "durum": _safe_message(durum)[:40],
                "mesaj": _safe_message(mesaj),
            }
            if not record["islem_adi"] or not record["durum"]:
                raise ValueError("İşlem adı ve durum boş olamaz.")
            self.client.table("sistem_loglari").insert(record).execute()
        except Exception as exc:
            # Ham istisna metni istek gövdesi veya kimlik bilgisi içerebilir.
            _console.warning("Log veritabanına kaydedilemedi (%s).", type(exc).__name__)
            return False
        _console.info("[%s] %s: %s", record["durum"], record["islem_adi"], record["mesaj"])
        return True


_default_service: LoggerService | None = None


def configure_logger(client: Client) -> None:
    """Tek müşavirli süreçlerde mevcut oturum istemcisini bağlayın.

    Eşzamanlı farklı müşavir işleri kendi LoggerService örneğini kullanmalıdır.
    """
    global _default_service
    _default_service = LoggerService(client)


def write_log(musavir_id: str, islem_adi: str, durum: str, mesaj: str) -> bool:
    """Kullanıcının verdiği dört parametreli arayüz korunur."""
    if _default_service is None:
        _console.warning("Logger yapılandırılmadı; kayıt veritabanına yazılmadı.")
        return False
    return _default_service.write_log(musavir_id, islem_adi, durum, mesaj)
