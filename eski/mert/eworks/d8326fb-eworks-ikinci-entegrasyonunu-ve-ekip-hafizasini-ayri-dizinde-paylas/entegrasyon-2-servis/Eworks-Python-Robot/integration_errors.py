"""Gizli istek/gövde içermeyen, sınıflandırılmış entegrasyon hataları."""

class SessionBudgetExceeded(RuntimeError):
    code='SESSION_RENEWAL_REQUIRED'

    def __init__(self):
        super().__init__('Oturum çalışma süresi azalıyor; yeni belge isteği başlatılmadı. Ara sonuçlar korunuyor.')


class SourceResponseError(ValueError):
    def __init__(self,code,message,status=None):
        super().__init__(message)
        self.code=code
        self.status=status


class SourceBlockedError(RuntimeError):
    def __init__(self,code,message,status=None):
        super().__init__(message)
        self.code=code
        self.status=status


class StorageResponseError(ValueError):
    def __init__(self,code,message,status=None):
        super().__init__(message)
        self.code=code
        self.status=status
