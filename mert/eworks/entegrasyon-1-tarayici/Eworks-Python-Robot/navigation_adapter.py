"""GİB menü adaptörü; geliştirme sırasında oturum kaybetmeden yenilenebilir."""
import re
import os
import time
from pathlib import Path
from urllib.parse import urlsplit
TITLE = 'Geçerli E-Beyanname Sözleşmeleri Listesi'

def trusted(url):
    parsed=urlsplit(url)
    host=(parsed.hostname or '').lower()
    return parsed.scheme=='https' and (host=='gib.gov.tr' or host.endswith('.gib.gov.tr'))

class AmbiguousTarget(ValueError):
    pass


async def visible_target(context, label, diagnostics=None):
    """Yalnızca GİB kökenlerinde, ekranda görülen tekil metni hedefler."""
    # Görsel simgeleri ayır; başka kelimeler içeren metinler eşleşmez.
    pattern = re.compile(r'^[^\w]*' + r'\s+'.join(map(re.escape, label.split())) + r'[^\w]*$', re.I)
    matches = {}
    observations = []
    for page in context.pages:
        if not trusted(page.url):
            continue
        for frame in page.frames:
            if not trusted(frame.url):
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
                # Aynı bağlantının iç içe metin öğelerini tek hedefe indir.
                # Başlık ve açıklama metinleri tıklanabilir hedef sayılmaz.
                target = candidate.locator('xpath=ancestor-or-self::*[self::a or self::button or self::input or @role="button" or @role="link" or @role="menuitem" or @onclick][1]')
                meta = await candidate.evaluate("el => ({tag:el.tagName.toLowerCase(),cursor:getComputedStyle(el).cursor})")
                meta.update(rendered)
                observations.append(meta)
                # Döngüsel karuselde ekran dışında duran kopya hedef değildir.
                # Dikeyde aşağıda kalan gerçek kart click ile kaydırılabilir.
                # Yatayda karuselin dışında kalan kopyaları ele.
                if label == 'İnternet Vergi Dairesi' and not rendered['horizontalInView']:
                    continue
                if await target.count() == 0 and meta['cursor'] == 'pointer' and meta['tag'] not in ('h1','h2','h3','h4','h5','h6','body','html'):
                    # React kartında olay DOM @onclick niteliğinde bulunmayabilir.
                    target = candidate
                if await target.count() == 0 and label == 'İnternet Vergi Dairesi' and meta['tag'] in ('p','span','div'):
                    in_apps = await candidate.evaluate('''el => {
                        for(let parent=el.parentElement,depth=0;parent && depth<8;parent=parent.parentElement,depth++){
                            if(parent.tagName==='BODY')break;
                            if((parent.innerText||'').includes('Geçiş Yapılabilecek Uygulamalar'))return true;
                        }
                        return false;
                    }''')
                    if in_apps:
                        target = candidate
                if await target.count() == 0 and label == 'Tümünü Göster' and meta['tag'] in ('span','div'):
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
        raise AmbiguousTarget('Birden fazla tıklanabilir hedef var: '+label+'. İlgili menüyü Chrome’da elle seçebilirsiniz; robot listeyi bekliyor.')
    return next(iter(matches.values())) if matches else None


async def confirm_ivd_transition(context):
    """Sadece gözlenen İVD yönlendirme uyarısı; başka onaylara dokunmaz."""
    targets = []
    for page in context.pages:
        if not trusted(page.url):
            continue
        for frame in page.frames:
            if not trusted(frame.url):
                continue
            for heading in await frame.get_by_text('Yönlendirmeyi Onaylıyor Musunuz?', exact=True).all():
                if not await heading.is_visible():
                    continue
                panel = heading.locator('xpath=ancestor::*[not(self::body) and not(self::html)][.//button[normalize-space(.)="ONAYLA"]][1]')
                if await panel.count() != 1:
                    continue
                text = ' '.join((await panel.inner_text()).split())
                if not all(part in text for part in (
                    'İnternet Vergi Dairesi uygulamasına geçiş yapmak üzeresiniz.',
                    'aktif İnternet Vergi Dairesi oturumlarınız da sonlandırılacaktır.',
                    'Devam etmek istiyor musunuz?',
                )):
                    continue
                button = panel.get_by_role('button', name='ONAYLA', exact=True)
                cancel = panel.get_by_role('button', name='İPTAL ET', exact=True)
                if (await button.count() == 1 and await cancel.count() == 1
                        and await button.is_visible() and await button.is_enabled()):
                    targets.append(button)
    if len(targets) > 1:
        raise AmbiguousTarget('Birden fazla İVD yönlendirme uyarısı var; tek GİB oturumu bırakın.')
    if not targets:
        return False
    await targets[0].click(timeout=5000)
    return True


async def advance_navigation(context, visited, diagnostics=None):
    await focus_requested(context)
    if 'İVD yönlendirme onayı' not in visited and await confirm_ivd_transition(context):
        visited.update(('İVD yönlendirme onayı', 'İnternet Vergi Dairesi'))
        return 'İVD yönlendirme onayı'
    # Derin menü zaten görünüyorsa üst uygulamayı yeniden açma.
    for label in (TITLE, 'E-Beyanname Yetki Bilgileri', 'İnternet Vergi Dairesi'):
        if label in visited:
            continue
        target = await visible_target(context, label, diagnostics)
        if target is not None:
            await target.click(timeout=5000)
            visited.add(label)
            # Daha derin menüye ulaştıktan sonra üst uygulamayı tekrar açma.
            if label == TITLE:
                visited.update(('E-Beyanname Yetki Bilgileri', 'İnternet Vergi Dairesi'))
            elif label == 'E-Beyanname Yetki Bilgileri':
                visited.add('İnternet Vergi Dairesi')
            return label
    return None


async def focus_requested(context):
    """Yerel arayüzün isteğiyle aynı robotun GİB penceresini öne getirir."""
    folder = Path(__file__).resolve().parents[1]/'Eworks-Portal'/'jobs'
    marker = folder/f'focus-{os.getpid()}.request'
    if not marker.exists():
        return False
    if time.time()-marker.stat().st_mtime > 30:
        marker.unlink(missing_ok=True)
        return False
    pages = [page for page in context.pages if not page.is_closed() and trusted(page.url)]
    if not pages:
        return False
    await pages[-1].bring_to_front()
    marker.unlink(missing_ok=True)
    (folder/f'focus-{os.getpid()}.ack').write_text('focused',encoding='utf-8')
    return True

