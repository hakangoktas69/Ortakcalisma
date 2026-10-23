"""Sahibine bağlı kaynak gözlemleri; nihai kurum yetkisi onayı üretmez."""
import json
import re
from uuid import UUID
from declaration_adapter import normalize_declaration_rows


def load_declaration_review(root,owner):
    owner=str(UUID(owner))
    config=json.loads((root/'declaration-review-source.json').read_text(encoding='utf-8-sig'))
    job=config.get('jobId','')
    if not re.fullmatch(r'[a-f0-9]{32}',job):raise ValueError('Geçersiz kaynak işi.')
    folder=root/'jobs'/job
    request=json.loads((folder/'request.json').read_text(encoding='utf-8-sig'))
    if request.get('ownerId')!=owner:raise PermissionError('Kaynak farklı portal hesabına ait.')
    shape=json.loads((folder/'institution-live-structure.json').read_text(encoding='utf-8-sig'))
    months=config.get('uploadMonths')
    year=config.get('year');identity=config.get('identity')
    if not isinstance(months,list) or not months or len(months)!=len(set(months)):
        raise ValueError('Kaynak ayları geçersiz.')
    candidates=[f.get('declarationResults') for f in shape.get('frames',[])
        if f.get('sourceOrigin')=='https://ebeyanname.gib.gov.tr'
        and all(str(m) in f.get('declarationResults',{}) for m in months)]
    if not candidates:raise ValueError('Doğrulanmış kaynak gözlemi bulunamadı.')
    results=candidates[0]
    if any(candidate!=results for candidate in candidates):raise ValueError('Çelişkili kaynak gözlemleri.')
    rows=[];seen=set()
    for month in months:
        batch=results[str(month)]
        if (batch.get('schema')!='eworks.declaration.observation.v1'
                or batch.get('sourceOrigin')!='https://ebeyanname.gib.gov.tr'
                or batch.get('year')!=year or batch.get('uploadMonth')!=month
                or batch.get('singlePageVerified') is not True
                or batch.get('imported') is not False or batch.get('authorizationVerified') is not False):
            raise ValueError('Kaynak gözlem kapsamı geçersiz.')
        records=batch.get('records',[])
        if batch.get('pageRange','').replace(' ','')!=f'1-{len(records)}/{len(records)}':
            raise ValueError('Kaynak toplamı doğrulanamadı.')
        raw=[]
        for row in records:
            metadata=row.get('metadata',{})
            raw.append(dict(identity=row.get('identity'),sourceRowId=row.get('recordId'),
                document=row.get('document'),period=metadata.get('originalPeriod'),
                uploadedAt=metadata.get('uploadedAt',''),taxStatus=row.get('status'),
                sgkStatus=metadata.get('sgkStatus',''),sourceFilename=row.get('reference')))
        from datetime import datetime
        for row in raw:
            row['uploadedAt']=datetime.fromisoformat(row['uploadedAt']).strftime('%d.%m.%Y - %H:%M:%S')
        checked=normalize_declaration_rows(raw,identity=identity,year=year,
            upload_month=month,expected_count=batch.get('observedCount'))
        if checked!=records:raise ValueError('Kaynak alanları eşleşmiyor.')
        for row in checked:
            if row['recordId'] in seen:raise ValueError('Mükerrer kaynak kaydı.')
            seen.add(row['recordId'])
            rows.append(dict(row,uploadMonth=month))
    evidence_path=folder/'advisor-contract-evidence.json'
    access=None
    if evidence_path.exists():
        from datetime import datetime
        from advisor_records import normalized
        evidence=json.loads(evidence_path.read_text(encoding='utf-8'))
        if (evidence.get('schema')!='eworks.advisor.contract-evidence.v1'
                or evidence.get('ownerId')!=owner or evidence.get('requestId')!=job
                or evidence.get('sourceOrigin')!='https://intvrg.gib.gov.tr'
                or evidence.get('sourceType')!='gib_live'
                or evidence.get('observedCount')!=len(evidence.get('contracts',[]))
                or datetime.fromisoformat(evidence['observedAt']).tzinfo is None):
            raise ValueError('Canlı sözleşme kanıtı eşleşmiyor.')
        contracts=[c for c in evidence['contracts'] if identity in (c.get('taxNumber'),c.get('identityNumber'))
            and normalized(c.get('type','')) in {'aracilik ve sorumluluk sozlesmesi','elektronik beyanname aracilik ve sorumluluk sozlesmesi'}
            and isinstance(c.get('number'),str) and c['number'].strip()]
        if not contracts:raise ValueError('Aynı oturumda hedef firmanın geçerli sözleşmesi bulunamadı.')
        access=dict(method='same_session_contract_and_scoped_query',identity=identity,
            contractNumbers=sorted({c['number'] for c in contracts}),observedAt=evidence['observedAt'])
    notice_scopes=[f['noticeStructure']['targetScope'] for f in shape.get('frames',[])
        if f.get('sourceOrigin')=='https://dijital.gib.gov.tr' and f.get('noticeStructure')
        and isinstance(f['noticeStructure'].get('targetScope'),dict)]
    notice_scope=None
    if access and notice_scopes and all(s==notice_scopes[0] for s in notice_scopes):
        scope=notice_scopes[0]
        if scope.get('state') in ('account_target_mismatch','account_identity_unavailable','account_matches_target','advisor_taxpayer_scope_required','advisor_taxpayer_scope_verified'):
            notice_scope=dict(state=scope['state'],identity=identity,sourceOrigin='https://dijital.gib.gov.tr',
                observedAt=access['observedAt'],imported=False)
    return dict(schema='eworks.gib.review.v1',ownerId=owner,sourceJobId=job,
        sourceOrigin='https://ebeyanname.gib.gov.tr',year=year,uploadMonths=months,
        reviewState='verified_access' if access else 'pending_authority',
        authorizationVerified=bool(access),accessEvidence=access,noticeScope=notice_scope,count=len(rows),records=rows)
