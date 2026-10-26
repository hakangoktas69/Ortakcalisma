"""Müşavir vergi levhası erişim keşfi. Mükellef sorgulamaz/belge oluşturmaz.
Önce gözlenen menü ve servis sözleşmesi doğrulanır; token/değer yazılmaz.
"""
import asyncio,json,re
from urllib.parse import urlsplit,parse_qs
from navigation_adapter import visible_target,confirm_ivd_transition
from institution_discovery import safe_origin
from notice_probe import shape
from local_files import atomic_json
PLATE_LABELS=('e-Vergi Levhası','E-Vergi Levhası','Vergi Levhası','Vergi Levhası Sorgulama','Vergi Levhası Sorgula','e-Vergi Levhası Sorgulama','E-Vergi Levhası Sorgulama')

class TaxPlateProbe:
 def __init__(self,folder):self.folder=folder;self.events=[]
 async def observe(self,response):
  try:
   u=urlsplit(response.url);origin=safe_origin(response.url)
   if not origin or not (u.hostname=='gib.gov.tr' or u.hostname.endswith('.gib.gov.tr')):return
   command=parse_qs(u.query).get('cmd',[''])[0]
   if not re.search('levha',u.path+' '+command,re.I):return
   ctype=response.headers.get('content-type','').split(';')[0].lower()
   path='/'.join(part if not part or re.fullmatch('[A-Za-z_-]{1,70}',part) else '[id]' for part in u.path.split('/'))
   event=dict(origin=origin,path=path,status=response.status,contentType=ctype)
   if re.fullmatch('[A-Za-z_]{1,80}',command):event['command']=command
   if 'json' in ctype:
    raw=await asyncio.wait_for(response.body(),timeout=10)
    if len(raw)>2_000_000:return
    event['structure']=shape(json.loads(raw))
    body=response.request.post_data
    if body and len(body)<65536:
     try:event['requestStructure']=shape(json.loads(body))
     except ValueError:pass
   elif ctype!='application/pdf':return
   self.events=(self.events+[event])[-30:]
   atomic_json(self.folder/'taxplate-source-structure.json',dict(schema='eworks.taxplate-structure.v1',events=self.events,downloaded=False,imported=False))
  except Exception:return

async def screen_structure(context):
 result=[]
 for page in context.pages:
  if not safe_origin(page.url):continue
  for frame in page.frames:
   if not safe_origin(frame.url):continue
   controls=[]
   for el in await frame.locator('a,button,[role=menuitem],label').all():
    if not await el.is_visible():continue
    text=' '.join((await el.inner_text()).split())
    if re.search(r'levha|mükellef|vergi kimlik|vergilendirme|takvim yılı',text,re.I) and 0<len(text)<120 and not re.search(r'\d{6}',text):controls.append(text)
   tables=[]
   for table in await frame.locator('table,[role=grid],[role=table]').all():
    if await table.is_visible():
     headers=await table.locator('thead th,[role=columnheader]').all_inner_texts()
     if headers:tables.append([' '.join(x.split())[:120] for x in headers[:30]])
   if controls or tables:result.append(dict(sourceOrigin=safe_origin(frame.url),controls=sorted(set(controls))[:40],tables=tables[:10]))
 return result

async def _inspect_tax_plate_screen(context,diagnostics):
 visited=set();actions=[]
 for attempt in range(12):
  clicked=False
  for label in PLATE_LABELS:
   diagnostics['stage']=label
   if label in visited:continue
   target=await visible_target(context,label,diagnostics)
   if target is not None:
    await target.click(timeout=5000);visited.add(label);actions.append(label);clicked=True
    await asyncio.sleep(1)
    break
  if clicked:
   observed=await screen_structure(context)
   if any(any(re.search(r'kimlik|mükellef|vergilendirme|yılı',x,re.I) for x in item['controls']) for item in observed):
    return dict(module='taxplates',state='tax_plate_form_observed',actions=actions,structure=observed,clientAuthorizationVerified=False,downloaded=False,imported=False)
   continue
  for label in ('İnternet Vergi Dairesi','Hepsini gör','Bilgilerim','Sorgulamalar','Bilgi Girişi'):
   diagnostics['stage']=label
   if label in visited:continue
   target=await visible_target(context,label,diagnostics)
   if target is not None:
    await target.click(timeout=5000);visited.add(label);actions.append(label)
    await confirm_ivd_transition(context);clicked=True;break
  if not clicked:break
  await asyncio.sleep(1)
 return dict(module='taxplates',state='tax_plate_navigation_observed' if any(x in PLATE_LABELS for x in actions) else 'tax_plate_entry_unavailable',actions=actions,structure=await screen_structure(context),clientAuthorizationVerified=False,downloaded=False,imported=False)


async def inspect_tax_plate_screen(context):
 diagnostics={}
 try:
  result=await _inspect_tax_plate_screen(context,diagnostics)
 except Exception as exc:
  result=dict(module='taxplates',state='tax_plate_navigation_error',errorType=type(exc).__name__,stage=diagnostics.get('stage'),clientAuthorizationVerified=False,downloaded=False,imported=False)
  try:result['structure']=await screen_structure(context)
  except Exception:result['structure']=[]
 result['navigationDiagnostics']=diagnostics
 return result
