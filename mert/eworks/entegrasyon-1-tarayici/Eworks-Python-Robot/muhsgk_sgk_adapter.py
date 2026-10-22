"""MUHSGK SGK okuyucusunun yerel adaptör giriş noktası."""
import importlib
import muhsgk_sgk_reader

async def live_aliases(frame,folder):
    import json
    from local_files import atomic_json
    path=folder/'live-contract-aliases.json'
    if path.exists():return json.loads(path.read_text(encoding='utf-8')).get('aliases',{})
    from portal_worker import discover,ProgressLogger
    from gib_automation import scrape_contract_table
    from advisor_records import normalized
    request=json.loads((folder/'request.json').read_text(encoding='utf-8'))
    found=await discover(frame.page.context)
    aliases={}
    if found:
        source,config=found
        count=json.loads((folder/'ready.json').read_text(encoding='utf-8'))['expectedCount']
        records=await scrape_contract_table(source,request['ownerId'],selectors=config,expected_count=count,logger=ProgressLogger())
        for row in records:
            if normalized(row.get('type','')) not in {'aracilik ve sorumluluk sozlesmesi','elektronik beyanname aracilik ve sorumluluk sozlesmesi'}:continue
            ids=[v for v in (row.get('taxNumber'),row.get('identityNumber')) if isinstance(v,str) and __import__('re').fullmatch(r'\d{10,11}',v)]
            for value in ids:aliases[value]=sorted(set(aliases.get(value,[])+ids))
    atomic_json(path,dict(ownerId=request['ownerId'],aliases=aliases))
    return aliases

async def collect_sgk(frame,row,folder,report,existing_provider=None):
    from local_files import atomic_json
    atomic_json(folder/'adapter-version.json',dict(version='scope-reader-2'))
    if not (folder/'query-form-structure.json').exists():
        structure=await frame.locator('input[name],select[name]').evaluate_all("els=>els.map(el=>({name:el.name,type:el.type,tag:el.tagName,maxLength:el.maxLength}))")
        atomic_json(folder/'query-form-structure.json',structure)
    frame.page._eworks_diagnostic_folder=folder
    # Uzun taramalarda okuyucu düzeltmeleri bir sonraki listeye güvenle uygulanır.
    import declaration_reader,declaration_adapter,source_record_id
    importlib.reload(source_record_id)
    importlib.reload(declaration_adapter)
    importlib.reload(declaration_reader)
    declaration_reader._DIAGNOSTIC_FOLDER=folder
    import declaration_sync,institution_discovery
    navigation=importlib.reload(institution_discovery)
    try:navigation._LIVE_QUERY_ALIASES=await live_aliases(frame,folder)
    except Exception:navigation._LIVE_QUERY_ALIASES={}
    declaration_sync.declaration_pilot_query=navigation.declaration_pilot_query
    return await importlib.reload(muhsgk_sgk_reader).collect_sgk(frame,row,folder,report,existing_provider)
