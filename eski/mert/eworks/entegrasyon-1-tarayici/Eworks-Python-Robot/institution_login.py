"""Kurum uygulamalarının gözlenen GİB girişleri; mevcut portal OCR'ını değiştirmez.

e-Beyan /portal/login için mevcut yardımcıları kullanır. e-Defter /portal/oauth
ayrı, dar kapsamlı bir yardımcıdır. Her uygulamada en fazla bir gönderim yapılır.
"""
import asyncio
import hashlib
import re
from urllib.parse import urlsplit
from captcha_assist import CaptchaAssist, image_content
from cloud_credentials import fill_gib_credentials
from local_ocr import read_local_suggestion


async def application_access_failure(page):
    parsed=urlsplit(page.url)
    if (parsed.scheme!='https' or parsed.hostname!='authebelge.gib.gov.tr'
            or parsed.username or parsed.password or parsed.port not in (None,443)):
        return None
    message=re.compile(r'^User\s+\d{10,11}\s+authenticated with identity provider dijital does not\s+exist\.\s+Please contact your administrator\.$')
    for candidate in await page.get_by_text(message).all():
        if await candidate.is_visible():
            return 'identity_provider_account_missing'
    return None


def official_login_kind(url,module):
    parsed=urlsplit(url)
    if (parsed.scheme!='https' or parsed.hostname!='dijital.gib.gov.tr'
            or parsed.username or parsed.password or parsed.port not in (None,443)):
        return None
    if parsed.path.rstrip('/')=='/portal/login' and module=='declarations':
        return 'portal'
    if parsed.path.rstrip('/')=='/portal/oauth' and module=='ledgers':
        return 'edefter_oauth'
    return None


class EdefterOAuthAssist:
    def __init__(self):
        self.submitted=False
        self.seen=set()

    async def submit_once(self,page,credentials):
        if self.submitted or official_login_kind(page.url,'ledgers')!='edefter_oauth':
            return 'not_submitted'
        marker=page.get_by_text('e-Defter Uygulaması',exact=True)
        markers=[item for item in await marker.all() if await item.is_visible()]
        if not markers:
            return 'application_unverified'
        users=page.get_by_role('textbox',name='T.C. Kimlik No / Vergi Kimlik No / Kullanıcı Kodu',exact=True)
        codes=page.get_by_role('textbox',name='Doğrulama Kodu',exact=True)
        images=page.get_by_role('img',name='captchaImg',exact=True)
        buttons=page.get_by_role('button',name='Giriş Yap',exact=True)
        passwords=page.locator('input[type=password]')
        for locator in (users,codes,images,buttons,passwords):
            if await locator.count()!=1 or not await locator.is_visible():
                return 'ambiguous_login'
        username=credentials.get('username','');password=credentials.get('password','')
        if not username or not password:
            return 'credentials_unavailable'
        current=await users.input_value()
        if current and current!=username:
            return 'account_mismatch'
        if not current: await users.fill(username)
        if not await passwords.input_value(): await passwords.fill(password)
        # Kullanıcı kod girmişse otomatik gönderme; insan girdisini koru.
        if (await codes.input_value()).strip():
            return 'manual_input_present'
        before=page.url
        pixels=await image_content(images)
        digest=hashlib.sha256(pixels).digest()
        if digest in self.seen:
            return 'manual_captcha_required'
        self.seen.add(digest)
        suggestion=await asyncio.to_thread(read_local_suggestion,pixels)
        if not suggestion:
            return 'manual_captcha_required'
        if (page.url!=before or (await codes.input_value()).strip()
                or hashlib.sha256(await image_content(images)).digest()!=digest):
            return 'challenge_changed'
        await codes.fill(suggestion)
        if (page.url!=before or await codes.input_value()!=suggestion
                or await users.input_value()!=username
                or not await passwords.input_value()
                or not await buttons.is_enabled()
                or hashlib.sha256(await image_content(images)).digest()!=digest):
            return 'challenge_changed'
        self.submitted=True
        await buttons.click(timeout=5000)
        return 'submitted'


async def complete_application_login(page,module,credentials_provider,*,timeout=60):
    kind=official_login_kind(page.url,module)
    if kind is None:
        return 'not_required'
    credentials=await credentials_provider()
    portal=CaptchaAssist(auto_login=True)
    oauth=EdefterOAuthAssist()
    deadline=asyncio.get_running_loop().time()+timeout
    state='reauthentication_required'
    try:
        while asyncio.get_running_loop().time()<deadline:
            if official_login_kind(page.url,module) is None:
                for _ in range(3):
                    failure=await application_access_failure(page)
                    if failure:return failure
                    if urlsplit(page.url).hostname!='authebelge.gib.gov.tr':break
                    await asyncio.sleep(.5)
                return 'authentication_transition_observed'
            if kind=='portal':
                if credentials: await fill_gib_credentials(page,credentials)
                await portal.suggest(page)
                if portal.submitted_at is not None: state='submitted'
            elif not oauth.submitted:
                state=await oauth.submit_once(page,credentials)
                if state in ('account_mismatch','application_unverified','ambiguous_login',
                             'manual_input_present','credentials_unavailable'):
                    return state
            await asyncio.sleep(2)
        return state
    finally:
        credentials.clear()
