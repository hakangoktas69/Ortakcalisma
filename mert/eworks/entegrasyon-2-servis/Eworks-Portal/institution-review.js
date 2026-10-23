(function(root){
  'use strict';
  function checkedAttachments(files,owner,identity,recordId){
    if(files===undefined)return [];
    if(!Array.isArray(files)||files.length>30)throw Error('Belge listesi geçersiz.');
    const seen=new Set();
    return files.map(f=>{
      const kinds={declaration:'Beyanname',tax_accrual:'Vergi tahakkuku',sgk_accrual:'SGK tahakkuku',sgk_service:'SGK hizmet listesi'};
      if(!kinds[f.kind]||f.ownerId!==owner||f.identity!==identity||f.recordId!==recordId||f.bucket!=='eworks-declarations'||f.storageVerified!==true||f.contentType!=='application/pdf'||!Number.isInteger(f.size)||f.size<100||f.size>20971520||!/^[a-f0-9]{64}$/.test(f.sha256)||f.key!==owner+'/'+identity+'/'+recordId+'/'+f.kind+'-'+f.sha256+'.pdf'||!Number.isFinite(Date.parse(f.savedAt))||seen.has(f.key))throw Error('Belge hesabı, kayıt kapsamı veya dosya özeti doğrulanamadı.');
      seen.add(f.key);return {...f,label:kinds[f.kind],filename:f.kind+'-'+recordId+'.pdf'};
    });
  }
  function currentAttachments(files){
    const current=new Map();
    for(const f of [...files].sort((a,b)=>a.savedAt.localeCompare(b.savedAt)))current.set(f.kind,f);
    return [...current.values()];
  }
  function compactDocuments(notes,owner){
    let changed=false;
    const compacted=notes.map(row=>{
      if(row.ownerId!==owner||!['gib_live','gib_muhsgk'].includes(row.sourceType)||!Array.isArray(row.attachments))return row;
      const checked=checkedAttachments(row.attachments,owner,row.identity,row.recordId),files=currentAttachments(checked);
      if(files.length===checked.length)return row;
      const keys=new Set(files.map(f=>f.key));changed=true;
      const versions=new Map([...(row.documentVersions||[]),...checked.filter(f=>!keys.has(f.key))].map(f=>[f.key,f]));
      return {...row,attachments:files,documentVersions:[...versions.values()]};
    });
    return {notes:compacted,changed};
  }
  function prepare(batch,firms,owner,existing=[]){
    if(batch?.schema!=='eworks.gib.review.v1'||batch.ownerId!==owner||batch.reviewState!=='pending_authority'||batch.authorizationVerified!==false||!Array.isArray(batch.records)||batch.count!==batch.records.length||!Array.isArray(firms)||!Array.isArray(existing))throw Error('Gözlem kapsamı doğrulanamadı.');
    if(!/^[a-f0-9]{32}$/.test(batch.sourceJobId)||batch.sourceOrigin!=='https://ebeyanname.gib.gov.tr')throw Error('Gözlem kaynağı geçersiz.');
    const next=new Map();
    for(const row of existing){if(row.ownerId!==owner||row.reviewState!=='pending_authority')throw Error('Kayıt hesabı veya inceleme durumu uyuşmuyor.');next.set(row.id,{...row});}
    const seen=new Set();
    for(const row of batch.records){
      if(!/^\d{10,11}$/.test(row.identity)||!/^[A-Za-z0-9_-]{1,100}$/.test(row.recordId))throw Error('Kaynak kimliği geçersiz.');
      const id='gib-review:declarations:'+row.identity+':'+row.recordId;
      if(seen.has(id))throw Error('Mükerrer kaynak kaydı.');seen.add(id);
      const matches=firms.filter(f=>f.taxNumber===row.identity||f.identityNumber===row.identity);
      if(matches.length!==1)throw Error('VKN/TCKN tek bir firma ile eşleşmedi.');
      const firm=matches[0];
      if(firm.contractStatus!=='Geçerli'||!(firm.contracts||[]).some(c=>typeof c.number==='string'&&c.number&&/Aracılık.*Sorumluluk/iu.test(c.type||'')))throw Error('Geçerli aracılık ve sorumluluk sözleşmesi bulunamadı.');
      if(!(batch.uploadYearOnly?/^\d{4}-(0[1-9]|1[0-2])$/:new RegExp('^'+batch.year+'-(0[1-9]|1[0-2])$')).test(row.period)||!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||!batch.uploadMonths.includes(row.uploadMonth)||(batch.uploadYearOnly&&!row.date.startsWith(batch.year+'-'+String(row.uploadMonth).padStart(2,'0')+'-')))throw Error('Gözlem dönemi eşleşmedi.');
      for(const key of ['document','reference','status'])if(typeof row[key]!=='string'||!row[key]||row[key].length>1024)throw Error('Eksik kaynak alanı.');
      next.set(id,{id,ownerId:owner,module:'declarations',firmId:firm.id,firm:firm.name,identity:row.identity,
        recordId:row.recordId,document:row.document,reference:row.reference,period:row.period,date:row.date,
        status:row.status,uploadMonth:row.uploadMonth,metadata:JSON.parse(JSON.stringify(row.metadata||{})),
        sourceOrigin:batch.sourceOrigin,sourceJobId:batch.sourceJobId,reviewState:'pending_authority',authorizationVerified:false});
    }
    return [...next.values()];
  }
  function prepareImport(batch,firms,owner,notes=[],reviews=[]){
    const proof=batch?.accessEvidence;
    if(batch?.reviewState!=='verified_access'||batch.authorizationVerified!==true||proof?.method!=='same_session_contract_and_scoped_query'||!Array.isArray(proof.contractNumbers)||!proof.contractNumbers.length||!Number.isFinite(Date.parse(proof.observedAt)))throw Error('Canlı erişim kanıtı eksik.');
    const checked=prepare({...batch,reviewState:'pending_authority',authorizationVerified:false},firms,owner,[]);
    for(const row of checked){const source=batch.records.find(r=>r.identity===row.identity&&r.recordId===row.recordId);row.attachments=checkedAttachments(source.attachments,owner,row.identity,row.recordId);row.documentStatus=source.documentStatus||'not_downloaded';row.documentError=typeof source.documentError==='string'?source.documentError.slice(0,500):'';}
    if(checked.some(row=>row.metadata?.observedIdentity&&row.metadata.observedIdentity!==row.identity&&(row.metadata.identityMapping!=='same_session_contract'||!/^\d{10,11}$/.test(row.metadata.observedIdentity)||!proof.identityAliases?.includes(row.metadata.observedIdentity))))throw Error('GİB VKN/TCKN sözleşme eşlemesi doğrulanamadı.');
    if(checked.some(row=>row.identity!==proof.identity||!firms.find(f=>f.id===row.firmId).contracts.some(c=>proof.contractNumbers.includes(c.number)&&/Aracılık.*Sorumluluk/iu.test(c.type||''))))throw Error('Sözleşme kanıtı firma ile eşleşmiyor.');
    const next=new Map(notes.map(row=>[row.id,{...row}]));
    const promoted=new Set();
    for(const row of checked){
      promoted.add(row.id);
      const id='gib:declarations:'+row.identity+':'+row.recordId;
      if(next.has(id)&&next.get(id).ownerId!==owner)throw Error('Kayıt başka hesaba ait.');
      next.set(id,{...row,id,page:'declarations-view',reviewState:'verified_access',authorizationVerified:true,
        accessMode:'advisor',accessEvidence:JSON.parse(JSON.stringify(proof)),sourceType:'gib_live',observedAt:proof.observedAt,
        note:row.attachments.length?'GİB belge dosyaları özel depoya kaydedildi.':'GİB liste kaydı; belge dosyası henüz kaydedilmedi.'});
    }
    return {notes:[...next.values()],reviews:reviews.filter(row=>!promoted.has(row.id))};
  }
  function dateSegments(scope){
    const valid=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&!Number.isNaN(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
    if(!valid(scope.startDate)||!valid(scope.endDate)||scope.startDate>scope.endDate||!['period','upload'].includes(scope.mode)||scope.year!==Number(scope.startDate.slice(0,4)))throw Error('Tarih aralığı geçersiz.');
    if(scope.mode==='period'&&(!/^\d{4}-(0[1-9]|1[0-2])$/.test(scope.periodStart||'')||!/^\d{4}-(0[1-9]|1[0-2])$/.test(scope.periodEnd||'')||scope.periodStart>scope.periodEnd))throw Error('Dönem aralığı geçersiz.');
    const segments=[];let cursor=scope.startDate;
    while(cursor<=scope.endDate){
      const year=Number(cursor.slice(0,4)),month=Number(cursor.slice(5,7));
      const last=new Date(Date.UTC(year,month,0,12)).toISOString().slice(0,10),endDate=last<scope.endDate?last:scope.endDate;
      segments.push({year,month,startDate:cursor,endDate});
      const next=new Date(endDate+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);cursor=next.toISOString().slice(0,10);
    }
    return segments;
  }
  function prepareSync(result,firms,owner,jobId,scope,notes=[],reviews=[]){
    const dated=typeof scope.startDate==='string',segments=dated?dateSegments(scope):null;
    const scopeKeys=['year','identities','mode','startDate','endDate','periodStart','periodEnd'];
    if(result?.schema!=='eworks.declarations.sync.v1'||result.requestId!==jobId||result.ownerId!==owner||result.year!==scope.year||JSON.stringify(result.identities)!==JSON.stringify(scope.identities)||!Array.isArray(result.batches)||!Array.isArray(result.failures)||!Array.isArray(result.months)||!result.months.length||result.months.some(m=>!Number.isInteger(m)||m<1||m>12)||new Set(result.months).size!==result.months.length||result.totalScopes!==scope.identities.length*(dated?segments.length:result.months.length)||result.completedScopes!==result.batches.length||result.completedScopes>result.totalScopes||(dated&&(scopeKeys.some(k=>JSON.stringify(result.queryScope?.[k])!==JSON.stringify(scope[k]))||JSON.stringify(result.segments)!==JSON.stringify(segments))))throw Error('Canlı sorgu sonucu kapsamı doğrulanamadı.');
    let nextNotes=[...notes],nextReviews=[...reviews],added=0,existing=0,documentsAdded=0,sgkAdded=0,sgkDocumentsAdded=0;
    const scopes=new Set();
    for(const batch of result.batches){
      const identity=batch.accessEvidence?.identity,month=batch.uploadMonths?.[0],key=identity+':'+batch.year+':'+month;
      const segment=dated?segments.find(s=>s.year===batch.year&&s.month===month):null;
      if(batch.sourceJobId!==jobId||(!dated&&batch.year!==scope.year)||!scope.identities.includes(identity)||batch.uploadYearOnly!==true||batch.uploadMonths.length!==1||!result.months.includes(month)||scopes.has(key)||batch.records.some(r=>r.identity!==identity))throw Error('Canlı sorgu firma/ay kapsamı eşleşmedi.');
      if(dated&&(!segment||['year','month','startDate','endDate'].some(k=>batch.queryRange?.[k]!==segment[k])||['mode','periodStart','periodEnd'].some(k=>batch.queryRange?.[k]!==scope[k])||batch.records.some(r=>r.date<segment.startDate||r.date>segment.endDate||(scope.mode==='period'&&(r.period>scope.periodEnd||(r.metadata?.periodEnd||r.period)<scope.periodStart)))))throw Error('Beyanname seçilen tarih aralığı dışında.');
      scopes.add(key);
      const imported=prepareImport(batch,firms,owner,[],nextReviews);
      const ids=new Set(nextNotes.map(r=>r.id));
      const sources=new Set(nextNotes.filter(r=>r.sourceType==='gib_live').map(r=>r.identity+':'+r.recordId));
      for(const row of imported.notes){
        if(ids.has(row.id)||sources.has(row.identity+':'+row.recordId)){
          const position=nextNotes.findIndex(r=>r.id===row.id||(r.sourceType==='gib_live'&&r.identity===row.identity&&r.recordId===row.recordId));
          const prior=nextNotes[position];
          if(prior.ownerId!==owner)throw Error('Belge başka hesaba ait kayda eklenemez.');
          const attachments=new Map(currentAttachments(checkedAttachments(prior.attachments,owner,row.identity,row.recordId)).map(f=>[f.kind,f]));
          const versions=new Map((prior.documentVersions||[]).map(f=>[f.key,f]));
          for(const f of row.attachments){const before=attachments.get(f.kind);if(!before){documentsAdded++;attachments.set(f.kind,f);}else if(before.key!==f.key&&before.savedAt<f.savedAt){versions.set(before.key,before);attachments.set(f.kind,f);}}
          nextNotes[position]={...prior,attachments:[...attachments.values()],documentStatus:row.documentStatus==='not_downloaded'?(prior.documentStatus||'not_downloaded'):row.documentStatus,documentError:row.documentError,
            ...(versions.size?{documentVersions:[...versions.values()]}:{}),
            note:attachments.size?'GİB belge dosyaları özel depoya kaydedildi.':prior.note};
          existing++;continue;
        }
        documentsAdded+=row.attachments.length;nextNotes.push(row);ids.add(row.id);sources.add(row.identity+':'+row.recordId);added++;
      }
      nextReviews=imported.reviews;
      for(const parent of imported.notes){
        const source=batch.records.find(r=>r.identity===parent.identity&&r.recordId===parent.recordId);
        if(source.sgkRecords===undefined)continue;
        if(parent.document!=='MUHSGK'||!Array.isArray(source.sgkRecords)||source.sgkRecords.length>500)throw Error('SGK kaynak beyanname kapsamı geçersiz.');
        const seenChildren=new Set();
        for(const child of source.sgkRecords){
          if(child.identity!==parent.identity||child.parentRecordId!==parent.recordId||!/^[A-Za-z0-9_-]{1,100}$/.test(child.recordId)||typeof child.workplace!=='string'||!child.workplace||child.workplace.length>100||!/^\d{4}-(0[1-9]|1[0-2])$/.test(child.period)||child.period<parent.period||child.period>(parent.metadata.periodEnd||parent.period)||typeof child.status!=='string'||!child.status||child.status.length>100||seenChildren.has(child.recordId))throw Error('SGK işyeri, dönem veya kaynak kayıt eşlemesi doğrulanamadı.');
          seenChildren.add(child.recordId);
          const files=checkedAttachments(child.attachments,owner,parent.identity,child.recordId);
          if(files.some(f=>!['sgk_accrual','sgk_service'].includes(f.kind)))throw Error('SGK kaydında farklı kuruma ait belge türü.');
          const id='gib:sgk:'+parent.identity+':'+parent.recordId+':'+child.recordId;
          const position=nextNotes.findIndex(r=>r.id===id),prior=position>=0?nextNotes[position]:null;
          if(prior&&(prior.ownerId!==owner||prior.firmId!==parent.firmId||prior.workplace!==child.workplace))throw Error('SGK kaydı farklı hesaba veya işyerine ait.');
          const attached=new Map(currentAttachments(checkedAttachments(prior?.attachments,owner,parent.identity,child.recordId)).map(f=>[f.kind,f]));
          for(const file of files){if(!attached.has(file.kind)){sgkDocumentsAdded++;attached.set(file.kind,file);}}
          const record={...(prior||{}),id,ownerId:owner,page:'sgk-bildirge',sourceType:'gib_muhsgk',sourceOrigin:batch.sourceOrigin,
            sourceJobId:jobId,firmId:parent.firmId,firm:parent.firm,identity:parent.identity,recordId:child.recordId,parentRecordId:parent.recordId,
            workplace:child.workplace,period:child.period,date:parent.date,status:child.status,document:'MUHSGK · SGK tahakkuk ve hizmet listesi',
            reference:child.reference||child.recordId,metadata:JSON.parse(JSON.stringify(child.metadata||{})),accessEvidence:parent.accessEvidence,
            authorizationVerified:true,attachments:[...attached.values()],documentStatus:child.documentStatus||'not_downloaded',note:'GİB MUHSGK SGK detayından alındı.'};
          if(position>=0)nextNotes[position]=record;else{nextNotes.push(record);sgkAdded++;}
        }
      }
    }
    for(const update of result.employeeCountUpdates||[]){
      if(!Number.isInteger(update.employeeCount)||update.employeeCount<0||update.employeeCount>100000||update.method!=='sgk_service_unique_persons'||!/^[a-f0-9]{64}$/.test(update.sourceSha256))throw Error('SGK çalışan sayısı kanıtı geçersiz.');
      for(const row of nextNotes){
        if(row.ownerId===owner&&row.sourceType==='gib_muhsgk'&&row.page==='sgk-bildirge'&&row.identity===update.identity&&row.recordId===update.recordId){
          if(!row.attachments?.some(f=>f.kind==='sgk_service'&&f.sha256===update.sourceSha256))throw Error('Çalışan sayısı hizmet belgesiyle eşleşmedi.');
          row.metadata={...row.metadata,employeeCount:update.employeeCount,employeeCountSource:{...update}};
        }
      }
    }
    return {notes:nextNotes,reviews:nextReviews,added,existing,documentsAdded,sgkAdded,sgkDocumentsAdded};
  }
  function coveredIdentities(result){
    if(result?.documentRetrySourceJobId)return [];
    if(result?.schema!=='eworks.declarations.sync.v1'||!result.queryScope||!Array.isArray(result.segments)||!Array.isArray(result.batches))return [];
    return result.identities.filter(identity=>result.segments.every(segment=>result.batches.some(b=>b.accessEvidence?.identity===identity&&b.queryRange?.startDate===segment.startDate&&b.queryRange?.endDate===segment.endDate)));
  }
  const api={prepare,prepareImport,prepareSync,checkedAttachments,compactDocuments,coveredIdentities};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.EworksInstitutionReview=api;
})(typeof window!=='undefined'?window:globalThis);
