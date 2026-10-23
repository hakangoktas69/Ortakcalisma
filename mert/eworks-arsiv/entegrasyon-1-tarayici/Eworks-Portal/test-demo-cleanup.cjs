const assert=require('node:assert/strict');
const {clean,restore}=require('./demo-cleanup.js');
const real=Array.from({length:274},(_,i)=>({id:'GIB-'+i,name:'REAL-'+i,sourceType:'gib_export',taxNumber:String(1000000000+i),contracts:[{number:'CONTRACT-'+i}]}));
// Aynı demo unvanı olan gerçek firma da korunmalı.
real[0].name='Mavi Atlas Danışmanlık Ltd. Şti.';
const original={firms:[...real,{id:'F1',name:real[0].name}],tasks:[
  {id:'T-1',title:'Eylül dönemi e-Defter dosyaları',firm:'Kuzey Rota Teknoloji A.Ş.',due:'2026-10-14',status:'Bekliyor',owner:'Ofis'},
  {id:'T-2',title:'Kullanıcının değiştirdiği görev',firm:'REAL',due:'2026-10-17',status:'Bekliyor',owner:'User'},
],notes:[{id:'SIM-1',sourceType:'simulation'},{id:'real-note',sourceType:'gib_live',page:'notices'}],
uploaded:[{id:'real-file',name:'file.xml'}],ledgers:{'GIB-0:8':'Kontrol Edildi'},
overrides:{'sgk-check-1':{status:'Tamamlandı'},'real-note':{status:'Okundu'}}};
const before=structuredClone(original),result=clean(original);
assert.deepEqual(original,before,'Kaynak veri yerinde değiştirilmemeli');
assert.deepEqual(result.data.firms,real,'274 gerçek firma ve sözleşmeleri birebir korunmalı');
assert.equal(result.total,4);
assert.equal(result.data.tasks.length,1);
assert.equal(result.data.tasks[0].id,'T-2');
assert.equal(result.data.notes[0].id,'real-note');
assert.deepEqual(result.data.uploaded,original.uploaded);
assert.deepEqual(result.data.ledgers,original.ledgers);
assert.deepEqual(clean(result.data).data,result.data,'Tekrar giriş yeni temizlik oluşturmamalı');
const undo=restore(result.data);
assert.equal(undo.restored,4);
assert.equal(undo.data.firms.length,275);
assert.equal(restore(undo.data).restored,0);
assert.equal(clean(undo.data).changed,false,'Geri alınan veriler tekrar otomatik silinmemeli');
console.log('Demo temizliği: gerçek kayıtlar, kullanıcı düzenlemeleri, tekrar çalıştırma ve geri alma geçti.');
