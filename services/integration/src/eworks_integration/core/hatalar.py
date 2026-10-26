"""Sınıflandırılmış kurum hataları (Eworks 2 integration_errors). Mesajlar sabit Türkçedir; istek gövdesi, belirteç, çerez, URL
sorgusu ya da kurum yanıt içeriği taşımaz (kural 2, 8).

- KaynakEngelledi: kurum oturumu reddetti (401/403) ya da hız sınırı bildirdi (429). İş durur, kalan kapsam sorgulanmaz,
  istek tekrarlanmaz; işçi kurum hızını düşürür (kural 5).
- KaynakYanitHatasi: tek isteğin yanıtı doğrulanamadı (durum, köken, tür, boyut, kapsam, zaman aşımı). O kapsamın sonucu
  yazılmaz (fail-closed, kural 7); iş sonraki kapsamla sürer.
"""
from __future__ import annotations


class KaynakHatasi(Exception):
    def __init__(self, kod: str, mesaj: str, durum: int | None = None):
        super().__init__(mesaj)
        self.kod = kod
        self.durum = durum


class KaynakEngelledi(KaynakHatasi):
    pass


class KaynakYanitHatasi(KaynakHatasi):
    pass
