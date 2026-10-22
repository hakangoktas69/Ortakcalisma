"""Supabase Vault aracı; gizli bilgileri yalnızca bellekte döndürür."""
from uuid import UUID
import requests

URL = 'https://YOUR_PROJECT.supabase.co'
PUBLISHABLE_KEY = 'YOUR_SUPABASE_PUBLISHABLE_KEY'


def verify_owner(access_token, owner):
    if not isinstance(access_token, str) or not access_token:
        return False
    try:
        result = requests.get(URL+'/auth/v1/user', headers={
            'apikey': PUBLISHABLE_KEY, 'Authorization': 'Bearer '+access_token,
        }, timeout=15, allow_redirects=False)
        return result.status_code == 200 and result.json().get('id') == str(UUID(owner))
    except (requests.RequestException, ValueError, TypeError):
        return False


def fetch_credentials(access_token, owner):
    try:
        result = requests.post(URL+'/functions/v1/gib-account', json={'action': 'robot'},
                               headers={'apikey': PUBLISHABLE_KEY, 'Authorization': 'Bearer '+access_token},
                               timeout=15, allow_redirects=False)
        if result.status_code != 200:
            raise ValueError()
        value = result.json()
        if (value.get('ownerId') != str(UUID(owner)) or
                not isinstance(value.get('username'), str) or
                not 1 <= len(value['username']) <= 256 or
                not isinstance(value.get('password'), str) or
                not 1 <= len(value['password']) <= 1024):
            raise ValueError()
        return {'username': value['username'], 'password': value['password']}
    except (requests.RequestException, ValueError, TypeError, AttributeError):
        raise ValueError('Supabase GİB hesabı alınamadı. Vault/Edge Function kurulumu ve hesap kaydı gerekli.') from None


async def fill_gib_credentials(page, credentials):
    # Yalnızca resmî giriş adresine doldur; başka sekmeye/iframe'e gönderme.
    from urllib.parse import urlsplit
    import re
    url = urlsplit(page.url)
    if (url.scheme, url.hostname, url.path.rstrip('/')) != ('https', 'dijital.gib.gov.tr', '/portal/login'):
        return False
    passwords = [p for p in await page.locator('input[type="password"]').all() if await p.is_visible()]
    users = []
    for field in await page.locator('input').all():
        if not await field.is_visible():
            continue
        kind = (await field.get_attribute('type') or 'text').lower()
        if kind not in ('text', 'tel', 'number'):
            continue
        label = await field.evaluate("el => [...(el.labels||[])].map(x=>x.innerText).join(' ')+' '+(el.getAttribute('aria-label')||'')+' '+(el.getAttribute('placeholder')||'')")
        if re.search(r'kimlik|kullanıcı|kullanici', label, re.I) and not re.search(r'captcha|doğrulama|güvenlik', label, re.I):
            users.append(field)
    if len(users) != 1 or len(passwords) != 1:
        return False
    await users[0].fill(credentials['username'])
    await passwords[0].fill(credentials['password'])
    credentials.clear()
    return True
