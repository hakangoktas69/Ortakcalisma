"""Açıkça istenen aynı kapsamın doğrulanmış ara sonuçlarından devam eder."""
import base64
import json
import re
import time
from pathlib import Path


def token_run_budget(token):
    """JWT'yi yetki doğrulamak için kullanmaz; yalnız çalışma süresini kısaltır."""
    try:
        payload=token.split('.')[1]
        expires=float(json.loads(base64.urlsafe_b64decode(payload+'='*(-len(payload)%4)))['exp'])
        remaining=max(0,int(expires-time.time()))
        return max(0,min(2400,remaining-120)),remaining
    except (ValueError,KeyError,IndexError,TypeError):
        return 0,0


def complete_documents(batch):
    if batch.get('documentRetrySourceJobId'):return False
    for row in batch.get('records',[]):
        if row.get('documentStatus') not in ('saved','unavailable') or row.get('documentError') or row.get('sgkSyncStatus')=='failed':return False
        for child in row.get('sgkRecords',[]):
            warnings=child.get('documentWarnings',[])
            if any(not w.get('sourceUnavailable') for w in warnings):return False
            if child.get('documentStatus') not in ('saved','unavailable') and not (warnings and all(w.get('sourceUnavailable') for w in warnings)):return False
        for current in [row,*row.get('sgkRecords',[])]:
            if any(f.get('storageVerified') is not True or not re.fullmatch('[a-f0-9]{64}',f.get('sha256','')) for f in current.get('attachments',[])):return False
    return True


def load_resume(folder,request,scope,eligible):
    pending=folder.parent.parent/'pending-bulk-resume.json'
    local=folder/'resume-plan.json'
    if not pending.exists() and not local.exists():return []
    plan=json.loads((local if local.exists() else pending).read_text(encoding='utf-8'))
    if (plan.get('ownerId')!=request['ownerId'] or plan.get('scope')!=scope
            or not 0<=time.time()-plan.get('createdAt',0)<86400
            or not re.fullmatch('[a-f0-9]{32}',plan.get('sourceJobId',''))):
        raise ValueError('Devam planının hesabı veya tarih kapsamı eşleşmedi; yeni sorgu başlatılmadı.')
    source=folder.parent/plan['sourceJobId']
    source_scope=plan.get('sourceScope',scope)
    narrowed=source_scope!=scope
    if narrowed:
        from declaration_sync import validate_scope
        if (validate_scope(source_scope)!=source_scope or validate_scope(scope)!=scope
                or scope.get('mode')!='upload' or source_scope.get('mode')!='upload'
                or {k:v for k,v in source_scope.items() if k!='endDate'}!={k:v for k,v in scope.items() if k!='endDate'}
                or scope['endDate']>=source_scope['endDate']):
            raise ValueError('Devam kapsamı yalnız aynı mükelleflerde yükleme bitiş tarihi daraltılarak değiştirilebilir.')
    previous_request=json.loads((source/'request.json').read_text(encoding='utf-8'))
    if (previous_request.get('ownerId')!=request['ownerId'] or previous_request.get('declarationSync')!=source_scope
            or previous_request.get('documentScope','all')!='all' or previous_request.get('downloadDocuments') is not True):
        raise ValueError('Devam kaynağı belge aktarım kapsamıyla eşleşmedi.')
    candidates=[source/'declarations-sync-result.json',*sorted(source.glob('declarations-sync-checkpoint*.json'),key=lambda p:p.stat().st_mtime,reverse=True)]
    path=next((p for p in candidates if p.exists()),None)
    if path is None:raise ValueError('Doğrulanmış ara sonuç bulunamadı.')
    data=json.loads(path.read_text(encoding='utf-8'))
    if (data.get('ownerId')!=request['ownerId'] or data.get('requestId')!=plan['sourceJobId']
            or data.get('queryScope')!=source_scope or data.get('schema')!='eworks.declarations.sync.v1'):
        raise ValueError('Ara sonuç sahipliği veya kapsamı doğrulanamadı.')
    if narrowed:
        from declaration_sync import query_segments
        allowed_ranges={(s['year'],s['month']):{**s,'mode':scope['mode']} for s in query_segments(scope)}
    resumed=[];seen=set()
    for batch in data.get('batches',[]):
        proof=batch.get('accessEvidence',{});identity=proof.get('identity')
        key=(identity,batch.get('year'),tuple(batch.get('uploadMonths',[])))
        if narrowed:
            expected=allowed_ranges.get((batch.get('year'),key[2][0])) if len(key[2])==1 else None
            if (expected is None or batch.get('queryRange')!=expected
                    or any(r.get('identity')!=identity or not isinstance(r.get('date'),str)
                        or not expected['startDate']<=r['date']<=expected['endDate'] for r in batch.get('records',[]))):continue
        if (identity not in eligible or key in seen or not complete_documents(batch)
                or batch.get('authorizationVerified') is not True or batch.get('count')!=len(batch.get('records',[]))
                or proof.get('method')!='same_session_contract_and_scoped_query'
                or not set(proof.get('contractNumbers',[]))&set(eligible[identity])):continue
        batch['sourceObservationJobId']=batch.get('sourceObservationJobId',batch['sourceJobId'])
        batch['sourceJobId']=request['requestId'];batch['resumedFromJobId']=plan['sourceJobId']
        if narrowed:batch['resumeScopeChange']={'previousEndDate':source_scope['endDate'],'endDate':scope['endDate']}
        resumed.append(batch);seen.add(key)
    if not local.exists():pending.replace(local)
    return resumed
