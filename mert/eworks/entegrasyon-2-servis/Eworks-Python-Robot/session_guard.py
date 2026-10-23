"""JWT süre bilgisini yalnız işi erken durdurmak için kullanır; yetki doğrulamaz."""
import base64
import json
import math
import time
from integration_errors import SessionBudgetExceeded


def expiry_hint(token):
    try:
        payload=token.split('.')[1]
        value=json.loads(base64.urlsafe_b64decode(payload+'='*(-len(payload)%4)))['exp']
        if type(value) not in (int,float) or not math.isfinite(value):return None
        return float(value)
    except (ValueError,KeyError,IndexError,TypeError,AttributeError):return None


class SessionGuard:
    def __init__(self,token):
        self.expires_at=expiry_hint(token)
        self.run_deadline=None

    def check_source(self):
        if (self.run_deadline is not None and time.monotonic()>=self.run_deadline
                or self.expires_at is not None and self.expires_at-time.time()<=150):
            raise SessionBudgetExceeded()

    def check_storage(self):
        # Upload + geri okuma en fazla 45+45 saniye sürebilir.
        if self.expires_at is not None and self.expires_at-time.time()<=100:
            raise SessionBudgetExceeded()
