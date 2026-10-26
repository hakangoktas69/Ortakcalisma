"""Salt gözlem: e-Tebligat JSON alan yapısını kaydeder; değer/token/belge saklamaz."""
import asyncio
import re
from urllib.parse import urlsplit
from local_files import atomic_json

def shape(value, depth=0):
    if depth>4:return {'type':'nested'}
    if isinstance(value,dict):
        return {k:shape(v,depth+1) for k,v in list(value.items())[:50]
                if isinstance(k,str) and re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]{0,60}',k)}
    if isinstance(value,list):return {'type':'array','length':len(value),'item':shape(value[0],depth+1) if value else None}
    return {'type':'null' if value is None else 'boolean' if isinstance(value,bool) else 'number' if isinstance(value,(int,float)) else 'string'}

class NoticeProbe:
    def __init__(self,folder):self.folder=folder;self.events=[]
    async def observe(self,response):
        try:
            u=urlsplit(response.url)
            if (u.scheme!='https' or u.hostname!='dijital.gib.gov.tr' or u.username or u.password
                or u.port not in (None,443) or not re.search(r'tebligat|teblig',u.path,re.I)):
                return
            if 'json' not in response.headers.get('content-type','').lower():return
            raw=await asyncio.wait_for(response.body(),timeout=10)
            if len(raw)>2_000_000:return
            import json
            value=json.loads(raw)
            path='/'.join(part if re.fullmatch(r'[A-Za-z_-]{1,70}',part) else '[id]' for part in u.path.split('/'))
            event=dict(origin='https://dijital.gib.gov.tr',path=path,status=response.status,structure=shape(value))
            self.events=(self.events+[event])[-20:]
            atomic_json(self.folder/'notice-service-structure.json',dict(schema='eworks.notice-structure.v1',events=self.events,imported=False))
        except Exception:
            return
