// Gerçek ağa çıkmadan Edge Function kimlik ve veri sınırları.
import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';

const file = new URL('../Eworks-Portal/supabase/functions/gib-account/index.ts', import.meta.url);
const source = (await fs.readFile(file, 'utf8')).replace(/^import .*?;\s*/m, '');
let handler, calls = [];
const admin = {
  auth: { getUser: async token => token === 'valid' ? {data:{user:{id:'OWNER-A'}}} : {data:{},error:{}} },
  rpc: async (name, args) => {calls.push({name,args});return {data:{configured:true},error:null};},
};
vm.runInNewContext(stripTypeScriptTypes(source), {
  createClient: () => admin, Response, TextDecoder, Uint8Array,
  Deno: {env:{get: name => ({SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic'})[name]},
         serve: fn => {handler=fn;}},
});
async function call(body, token='valid', origin) {
  return handler(new Request('https://example.invalid/functions/v1/gib-account', {
    method:'POST', headers:{Authorization:'Bearer '+token,...(origin ? {Origin:origin} : {})},
    body:JSON.stringify(body),
  }));
}
assert.equal((await call({action:'status'},'invalid')).status,401);
assert.equal((await call({action:'status'},'valid','https://untrusted.invalid')).status,403);
assert.equal((await call({action:'robot'},'valid','http://127.0.0.1:8765')).status,403);
assert.equal((await call({action:'save',username:'',password:'synthetic'})).status,400);
assert.equal(calls.length,0);
assert.equal((await call({action:'save',username:'TEST',password:'synthetic',ownerId:'ATTACKER'},'valid','http://127.0.0.1:8765')).status,200);
assert.equal(calls[0].args.p_owner,'OWNER-A');
assert.equal(calls[0].args.p_credentials.username,'TEST');
assert.equal((await call({action:'robot'})).status,200);
assert.equal(calls[1].args.p_owner,'OWNER-A');
assert.equal(calls[1].args.p_credentials,null);
// Firma isteği müşavir hesabına sessizce düşmemeli; owner JWT'den gelmeli.
for (const firmId of ['', ' ', null, 123, 'x'.repeat(161)]) {
  const before = calls.length;
  assert.equal((await call({action:'status',firmId})).status,400);
  assert.equal(calls.length,before);
}
for (const action of ['status','save','robot']) {
  const before = calls.length;
  assert.equal((await call({action,firmId:'SYNTHETIC-FIRM',ownerId:'ATTACKER',
    username:'TEST',password:'synthetic'})).status,200);
  assert.equal(calls[before].name,'eworks_firm_gib_credential_service');
  assert.equal(calls[before].args.p_owner,'OWNER-A');
  assert.equal(calls[before].args.p_firm_id,'SYNTHETIC-FIRM');
}
const beforeBrowserRobot = calls.length;
assert.equal((await call({action:'robot',firmId:'SYNTHETIC-FIRM'},'valid',
  'http://127.0.0.1:8765')).status,403);
assert.equal(calls.length,beforeBrowserRobot);
assert.equal((await call({action:'status'})).status,200);
assert.equal(calls.at(-1).name,'eworks_gib_credential_service');
assert.equal('p_firm_id' in calls.at(-1).args,false);
console.log('Edge Function: müşavir uyumluluğu, firma yönlendirmesi, JWT owner ve tarayıcı robot engeli geçti (sentetik).');
