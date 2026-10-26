"""Firmaya özel, geçici portal oturumu. Kayıt sorgulamaz veya içe aktarmaz."""
import asyncio
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlsplit

from playwright.async_api import async_playwright
from captcha_assist import CaptchaAssist
from cloud_credentials import fill_gib_credentials
from firm_credentials import fetch_firm_credentials
from institution_scope import observe_readonly_account_identity
from local_files import atomic_json
from navigation_adapter import visible_target, confirm_ivd_transition, focus_requested

TARGETS = {'digital', 'ivd', 'ledger', 'declarations', 'notices'}


def validate_scope(value):
    if not isinstance(value, dict) or value.get('target') not in TARGETS:
        raise ValueError('Geçersiz portal hedefi.')
    firm_id, identity = value.get('firmId'), value.get('identity')
    if (not isinstance(firm_id, str) or not 1 <= len(firm_id.strip()) <= 160
            or not isinstance(identity, str) or not identity.isascii()
            or not identity.isdigit() or len(identity) not in (10, 11)):
        raise ValueError('Geçerli firma ve VKN/TCKN gerekli.')
    return dict(firmId=firm_id, identity=identity, target=value['target'])


async def open_target(context, page, target, credentials_provider):
    if target == 'digital':
        return 'account_verified'
    if target in ('ledger', 'declarations', 'notices'):
        from institution_discovery import inspect_module_screen
        result = await inspect_module_screen(context,
            'ledgers' if target == 'ledger' else target,
            credentials_provider, preferred_page=page, keep_open=True)
        return result if target == 'notices' else result.get('state', 'target_requires_user')
    control = await visible_target(context, 'İnternet Vergi Dairesi')
    if control is None:
        more = await visible_target(context, 'Hepsini gör')
        if more is not None:
            await more.click()
            control = await visible_target(context, 'İnternet Vergi Dairesi')
    if control is None:
        return 'target_requires_user'
    await control.click()
    await confirm_ivd_transition(context)
    return 'transition_requested'


async def run(folder, access_token):
    request = json.loads((folder/'request.json').read_text(encoding='utf-8'))
    scope = validate_scope(request['portalSession'])
    owner = request['ownerId']
    atomic_json(folder/'worker.json', {'pid': os.getpid()})

    def status(state, message):
        atomic_json(folder/'status.json', {'state': state, 'message': message})

    async def credentials_provider():
        return await asyncio.to_thread(fetch_firm_credentials, access_token,
            owner, scope['firmId'], scope['identity'], include_scope=True)

    credentials = await credentials_provider()
    verified_identities = credentials.pop('verifiedIdentities', (scope['identity'],))
    if scope['identity'] not in verified_identities:
        raise ValueError('Firma kimlik kapsamı doğrulanamadı.')
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(channel='chrome', headless=False)
        try:
            context = await browser.new_context()  # Her firma için ayrı çerez deposu.
            if scope['target'] == 'notices':
                from notice_probe import NoticeProbe
                probe = NoticeProbe(folder)
                context.on('response', probe.observe)
            page = await context.new_page()
            context.set_default_timeout(10000)
            await page.goto('https://dijital.gib.gov.tr/portal/login', wait_until='domcontentloaded')
            assistant = CaptchaAssist(auto_login=True)
            status('running', 'Seçilen firmanın GİB giriş ekranı hazırlanıyor.')
            verified = False
            opened = False
            deadline = asyncio.get_running_loop().time() + 7200
            while context.pages and asyncio.get_running_loop().time() < deadline:
                if (folder/'cancel').exists():
                    break
                await focus_requested(context)
                if page.is_closed():
                    if not opened:
                        raise ValueError('Giriş penceresi kapatıldı.')
                    await asyncio.sleep(1)
                    continue
                if not verified:
                    if credentials and await fill_gib_credentials(page, credentials):
                        status('running', 'Firma hesabı dolduruldu; GİB doğrulaması bekleniyor.')
                    url = urlsplit(page.url)
                    if url.hostname == 'dijital.gib.gov.tr' and url.path == '/portal/login':
                        try:
                            notice = await assistant.suggest(page)
                            if notice:
                                status('running', notice)
                        except Exception:
                            status('running', 'GİB doğrulamasını açılan pencerede tamamlayın.')
                    else:
                        account = await observe_readonly_account_identity(page)
                        if account.get('identity'):
                            if account['identity'] not in verified_identities:
                                raise ValueError('Açılan GİB hesabı seçilen mükellefle eşleşmiyor; geçiş durduruldu.')
                            verified = True
                            status('running', 'Mükellef hesabı doğrulandı; seçilen portal açılıyor.')
                if verified and not opened:
                    opened = True  # Geçiş başarısızsa tekrar tekrar tıklanmaz.
                    try:
                        result = await asyncio.wait_for(open_target(context, page,
                            scope['target'], credentials_provider), timeout=100)
                    except Exception:
                        result = 'target_requires_user'
                    atomic_json(folder/'portal-session-result.json', {
                        'schema': 'eworks.portal-session.v1', 'ownerId': owner,
                        'requestId': request['requestId'], 'firmId': scope['firmId'],
                        'target': scope['target'], 'accountVerified': True,
                        'navigationState': result.get('state') if isinstance(result,dict) else result,
                        **({'inspection': result} if isinstance(result,dict) else {}), 'imported': False})
                    status('running', 'Firma hesabı doğrulandı. Portal penceresi açık; hedef uygulama ek giriş/yetki isterse pencerede tamamlayın. Veri aktarımı yapılmıyor.')
                await asyncio.sleep(2)
            return {'schema': 'eworks.portal-session.v1', 'ownerId': owner,
                'requestId': request['requestId'], 'accountVerified': verified,
                'imported': False}
        finally:
            credentials.clear()
            access_token = ''
            await browser.close()


if __name__ == '__main__':
    folder = Path(sys.argv[1]).resolve()
    try:
        startup = json.loads(sys.stdin.buffer.read(8193).decode('utf-8'))
        result = asyncio.run(run(folder, startup.pop('accessToken', '')))
        sys.stdout.buffer.write(json.dumps(result).encode('utf-8'))
    except Exception as exc:
        # Playwright/HTTP hata metinleri URL veya form içeriği taşıyabilir.
        message = str(exc) if isinstance(exc, ValueError) else 'Portal oturumu açılamadı; bağlantıyı ve firma hesabını kontrol edin.'
        atomic_json(folder/'status.json', {'state': 'failed', 'message': message})
        sys.exit(1)
