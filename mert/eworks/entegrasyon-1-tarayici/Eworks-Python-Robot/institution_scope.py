"""Görünür, salt okunur hesap kimliği; sorgu/giriş alanlarından türetilmez."""
from urllib.parse import urlsplit


async def observe_readonly_account_identity(frame):
    parsed=urlsplit(frame.url)
    host=parsed.hostname or ''
    if parsed.scheme!='https' or not host.endswith('.gib.gov.tr') or parsed.username or parsed.password or parsed.port not in (None,443):
        return dict(state='untrusted_source',identity=None)
    values=await frame.locator('body *').evaluate_all('''els=>{
        const result=[];
        for(const el of els){
            // Canlı DVD hesabı semantik header dışında bir profil popupı.
            // Yalnızca salt okunur ad + tek kimlik içeren gerçek tetikleyici.
            if(el.matches('div[aria-haspopup="true"]')&&!el.closest('form,table,[role=grid],[role=table]')
                    &&!el.querySelector('input,select,textarea')&&el.getClientRects().length
                    &&getComputedStyle(el).visibility!=='hidden'){
                const profile=(el.innerText||'').trim().match(/^([A-Za-zÇĞİÖŞÜçğıöşü .'-]{3,120})\\s+(\\d{10,11})$/u);
                if(profile)result.push(profile[2]);
            }
            if(!el.closest('header,nav,[role=banner]'))continue;
            if(el.matches('input,select,textarea,button,script,style')||el.closest('form')||el.querySelector('form,input,select,textarea')||el.children.length>1)continue;
            if(!el.getClientRects().length||getComputedStyle(el).visibility==='hidden')continue;
            const text=(el.innerText||'').replace(/\\s+/g,' ').trim();
            const match=text.match(/^(?:T\\.?C\\.? Kimlik (?:No|Numarası)|Vergi Kimlik (?:No|Numarası)|VKN|TCKN)\\s*[:：]\\s*(\\d{10,11})$/i);
            if(match)result.push(match[1]);
        }return [...new Set(result)];
    }''')
    return dict(state='readonly_identity_observed' if len(values)==1 else 'identity_unavailable' if not values else 'ambiguous_identity',
        identity=values[0] if len(values)==1 else None,sourceOrigin='https://'+host)


def notice_account_scope(account,identity,*,access_mode='firm',observed_taxpayer_identity=None,authorized_identities=()):
    """Hesap kimliği ile hedef mükellefi ayır; sözleşmeden kapsam üretme."""
    if account.get('state')!='readonly_identity_observed':
        return dict(state='account_identity_unavailable',canImport=False)
    if access_mode=='advisor':
        if observed_taxpayer_identity==identity and identity in authorized_identities:
            return dict(state='advisor_taxpayer_scope_verified',canImport=True)
        return dict(state='advisor_taxpayer_scope_required',canImport=False)
    if access_mode!='firm':
        return dict(state='unknown_access_mode',canImport=False)
    if account.get('identity')!=identity:
        return dict(state='account_target_mismatch',canImport=False)
    return dict(state='account_matches_target',canImport=True)
