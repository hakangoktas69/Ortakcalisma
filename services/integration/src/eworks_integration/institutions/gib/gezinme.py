"""GİB menü gezintisi — eski robotun canlıda doğrulanmış navigation_adapter.py mantığı (17.10.2026: 274 sözleşmeye kadar).

Yalnız GİB kökenlerinde, ekranda görülen tekil metni hedefler; birden çok aday varsa durur (yanlış tıklamaz).
Değişiklikler: dosya tabanlı odak isteği ve çalışma anında yeniden yükleme kaldırıldı (sunucu robotu; G-08).
"""
from __future__ import annotations

import re

from ...transports.robot.tarayici import gib_alani

TITLE = 'Geçerli E-Beyanname Sözleşmeleri Listesi'


class BelirsizHedef(ValueError):
    pass


async def visible_target(context, label, diagnostics=None):
    """Yalnızca GİB kökenlerinde, ekranda görülen tekil metni hedefler."""
    pattern = re.compile(r'^[^\w]*' + r'\s+'.join(map(re.escape, label.split())) + r'[^\w]*$', re.I)
    matches = {}
    observations = []
    for page in context.pages:
        if not gib_alani(page.url):
            continue
        for frame in page.frames:
            if not gib_alani(frame.url):
                continue
            for candidate in await frame.get_by_text(pattern).all():
                if not await candidate.is_visible():
                    continue
                rendered = await candidate.evaluate('''el => {
                    let r=el.getBoundingClientRect();
                    let left=Math.max(0,r.left),top=Math.max(0,r.top),right=Math.min(innerWidth,r.right),bottom=Math.min(innerHeight,r.bottom);
                    for(let parent=el.parentElement;parent;parent=parent.parentElement){
                        const style=getComputedStyle(parent),box=parent.getBoundingClientRect();
                        if(/hidden|clip|auto|scroll/.test(style.overflowX)){left=Math.max(left,box.left);right=Math.min(right,box.right);}
                        if(/hidden|clip|auto|scroll/.test(style.overflowY)){top=Math.max(top,box.top);bottom=Math.min(bottom,box.bottom);}
                    }
                    return {inView:right>left && bottom>top, horizontalInView:right>left};
                }''')
                target = candidate.locator('xpath=ancestor-or-self::*[self::a or self::button or self::input or @role="button" or @role="link" or @role="menuitem" or @onclick][1]')
                meta = await candidate.evaluate("el => ({tag:el.tagName.toLowerCase(),cursor:getComputedStyle(el).cursor})")
                meta.update(rendered)
                observations.append(meta)
                # Döngüsel karuselde ekran dışında duran kopya hedef değildir
                if label == 'İnternet Vergi Dairesi' and not rendered['horizontalInView']:
                    continue
                if await target.count() == 0 and meta['cursor'] == 'pointer' and meta['tag'] not in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body', 'html'):
                    target = candidate  # React kartında olay DOM @onclick niteliğinde bulunmayabilir
                if await target.count() == 0 and label == 'İnternet Vergi Dairesi' and meta['tag'] in ('p', 'span', 'div'):
                    in_apps = await candidate.evaluate('''el => {
                        for(let parent=el.parentElement,depth=0;parent && depth<8;parent=parent.parentElement,depth++){
                            if(parent.tagName==='BODY')break;
                            if((parent.innerText||'').includes('Geçiş Yapılabilecek Uygulamalar'))return true;
                        }
                        return false;
                    }''')
                    if in_apps:
                        target = candidate
                if await target.count() == 0 and label == 'Tümünü Göster' and meta['tag'] in ('span', 'div'):
                    in_footer = await candidate.evaluate('''el => {
                        for(let parent=el.parentElement,depth=0;parent && depth<6;parent=parent.parentElement,depth++){
                            if(parent.tagName==='BODY')break;
                            if(/listeleniyor\\.?\\s*Toplam\\s*:\\s*\\d+/i.test(parent.innerText||''))return true;
                        }
                        return false;
                    }''')
                    if in_footer:
                        target = candidate
                if await target.count() != 1 or not await target.is_visible() or not await target.is_enabled():
                    continue
                path = await target.evaluate('''el => {
                    const parts=[];
                    while(el && el.nodeType===1){
                        let index=1, sibling=el.previousElementSibling;
                        while(sibling){if(sibling.tagName===el.tagName)index++;sibling=sibling.previousElementSibling;}
                        parts.unshift(el.tagName.toLowerCase()+':nth-of-type('+index+')');
                        el=el.parentElement;
                    }
                    return parts.join(' > ');
                }''')
                matches[(id(frame), path)] = frame.locator(path)
    if diagnostics is not None:
        diagnostics[label] = {'visibleCandidates': observations, 'clickableCount': len(matches)}
    if len(matches) > 1:
        raise BelirsizHedef('Birden fazla tıklanabilir hedef var: ' + label)
    return next(iter(matches.values())) if matches else None


ONAY_METNI = {
    'İnternet Vergi Dairesi': ('İnternet Vergi Dairesi uygulamasına geçiş yapmak üzeresiniz.', 'aktif İnternet Vergi Dairesi oturumlarınız da sonlandırılacaktır.',
                               'Devam etmek istiyor musunuz?'),
    'e-Beyanname': ('e-Beyanname uygulamasına geçiş yapmak üzeresiniz.', 'aktif e-Beyanname oturumlarınız da sonlandırılacaktır.', 'Devam etmek istiyor musunuz?'),
}


async def confirm_ivd_transition(context):
    return await confirm_transition(context, 'İnternet Vergi Dairesi')


async def confirm_transition(context, uygulama: str):
    """Yalnız gözlenen yönlendirme uyarısı (İVD / e-Beyanname); metni tam eşleşmeyen onaylara dokunmaz."""
    targets = []
    for page in context.pages:
        if not gib_alani(page.url):
            continue
        for frame in page.frames:
            if not gib_alani(frame.url):
                continue
            for heading in await frame.get_by_text('Yönlendirmeyi Onaylıyor Musunuz?', exact=True).all():
                if not await heading.is_visible():
                    continue
                panel = heading.locator('xpath=ancestor::*[not(self::body) and not(self::html)][.//button[normalize-space(.)="ONAYLA"]][1]')
                if await panel.count() != 1:
                    continue
                text = ' '.join((await panel.inner_text()).split())
                if not all(part in text for part in ONAY_METNI[uygulama]):
                    continue
                button = panel.get_by_role('button', name='ONAYLA', exact=True)
                cancel = panel.get_by_role('button', name='İPTAL ET', exact=True)
                if await button.count() == 1 and await cancel.count() == 1 and await button.is_visible() and await button.is_enabled():
                    targets.append(button)
    if len(targets) > 1:
        raise BelirsizHedef(f'Birden fazla {uygulama} yönlendirme uyarısı var.')
    if not targets:
        return False
    await targets[0].click(timeout=5000)
    return True


async def advance_navigation(context, visited, diagnostics=None):
    """Bir adım ilerler; ilerlenen menünün adını döner, hedef yoksa None."""
    if 'İVD yönlendirme onayı' not in visited and await confirm_ivd_transition(context):
        visited.update(('İVD yönlendirme onayı', 'İnternet Vergi Dairesi'))
        return 'İVD yönlendirme onayı'
    # Derin menü zaten görünüyorsa üst uygulamayı yeniden açma
    for label in (TITLE, 'E-Beyanname Yetki Bilgileri', 'İnternet Vergi Dairesi'):
        if label in visited:
            continue
        target = await visible_target(context, label, diagnostics)
        if target is not None:
            await target.click(timeout=5000)
            visited.add(label)
            if label == TITLE:
                visited.update(('E-Beyanname Yetki Bilgileri', 'İnternet Vergi Dairesi'))
            elif label == 'E-Beyanname Yetki Bilgileri':
                visited.add('İnternet Vergi Dairesi')
            return label
    return None
