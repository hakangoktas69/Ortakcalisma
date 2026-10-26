"""Önceki işe ait belge hatalarını aynı hesap ve kesin kayıt kimlikleriyle sınırlar."""
import json
import re
from declaration_sync import validate_scope


def retry_plan(portal,owner,source_job):
    if not isinstance(source_job,str) or not re.fullmatch('[a-f0-9]{32}',source_job):
        raise ValueError('Belge hata kaynağı geçersiz.')
    folder=portal/'jobs'/source_job
    source=json.loads((folder/'declarations-sync-result.json').read_text(encoding='utf-8'))
    request=json.loads((folder/'request.json').read_text(encoding='utf-8'))
    if (source.get('ownerId')!=owner or request.get('ownerId')!=owner or source.get('requestId')!=source_job
            or source.get('schema')!='eworks.declarations.sync.v1' or source.get('queryScope')!=request.get('declarationSync')):
        raise ValueError('Belge hata kaynağının hesap ve sorgu kanıtı eşleşmedi.')
    targets={}
    failures=source.get('documentFailures',[])
    if not failures:raise ValueError('Yeniden denenecek belge hatası yok.')
    for failure in failures:
        matches=[(b,r) for b in source['batches'] for r in b['records']
            if r.get('identity')==failure.get('identity') and (r.get('recordId')==failure.get('recordId')
                or any(c.get('recordId')==failure.get('recordId') for c in r.get('sgkRecords',[])))]
        if len(matches)!=1:raise ValueError('Hatalı belgenin kaynak kaydı tekil değil.')
        batch,row=matches[0];proof=batch.get('accessEvidence',{})
        if (batch.get('authorizationVerified') is not True or proof.get('identity')!=row['identity']
                or proof.get('method')!='same_session_contract_and_scoped_query'
                or not proof.get('contractNumbers')):raise ValueError('Kaynak kaydın erişim kanıtı eksik.')
        key=(row['identity'],row['recordId'])
        target=targets.setdefault(key,dict(identity=key[0],recordId=key[1],date=row['date'],modules=[]))
        module=failure.get('module','declaration')
        if module not in ('declaration','sgk'):raise ValueError('Belge hata türü geçersiz.')
        if module not in target['modules']:target['modules'].append(module)
    identities=sorted({t['identity'] for t in targets.values()})
    scope=validate_scope({**source['queryScope'],'identities':identities})
    return dict(sourceJobId=source_job,scope=scope,targets=list(targets.values()),failureCount=len(failures),recordCount=len(targets))


def apply_retry_plan(collector,folder,request):
    plan=retry_plan(folder.parent.parent,request['ownerId'],request['documentRetrySourceJobId'])
    if plan['scope']!=request['declarationSync']:raise ValueError('Belge tekrar kapsamı kaynak hatalarla eşleşmedi.')
    collector.retry_targets={(t['identity'],t['recordId']):set(t['modules']) for t in plan['targets']}
    return plan
