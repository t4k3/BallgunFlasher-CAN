// Real portal functions, simulated BLE/storage only; never touches hardware.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const root=require('node:path').resolve(__dirname,'..');
const html=fs.readFileSync(root+'/index.html','utf8');
const card=html.slice(html.indexOf('<!-- FTD30 PARAMETRI'),html.indexOf('<!-- COLUMN 3'));
assert.deepEqual([...card.matchAll(/<button[^>]*id="([^"]+)"/g)].map(m=>m[1]),['fparCheckBtn','fparBothBtn','fparRebootBtn']);
assert.match(card,/id="fparBothBtn" hidden/);
assert.match(card,/id="fparVerifyPanel" hidden/);
assert(!/id="fpar(?:SetFile|DiagnosticBtn|RestoreBtn)"/.test(card));
assert(!/id="fparReport"/.test(card),'Reports belong only in the console, not the card');
assert.deepEqual([...html.matchAll(/FQ\('([^']+)'\)\.addEventListener/g)].map(m=>m[1]),['fparCheckBtn','fparBothBtn','fparRebootBtn']);
const names=['fparParsePrm','fparPrep','fparRestoreNode','fparVerifyAll','fparVerifyNode','fparReadParam',
 'fparReport','fparPendingRecords','fparPendingShow','fparPendingStore','fparInvalidateVerification','fparCanonical','fparValue',
 'fparSame','fparCompare','fparEspVersion','fparSnapshot','fparSafeNodes','fparSummary',
 'fparCompleteCheck','fparRestoreBoth','fparVerifyReboot'];
const source=names.map(n=>{const m=html.match(new RegExp(`(?:async )?function ${n}\\([^]*?^}`,'m'));assert(m,n);return m[0];}).join('\n');
const bytes=fs.readFileSync(root+'/FTD30/waz_nodo2.prm');
function harness(){
 const controls={},storage={},calls=[],logs=[];
 const device={id:'casoria-id',name:'wazlley_E56E',gatt:{connected:true,disconnect(){this.connected=false;}}};
 const c={FPAR:{busy:false,char:{},device,checkedDeviceId:device.id,server:{getPrimaryService:async()=>{throw Error('no DIS');}}},
  FPAR_BATCH:24,FPAR_VERIFY_IDX:[1,21,67,78,84,200],
  FPAR_CANONICAL_SHA:'725fc26d36910d6a7e28923003bb234d26189f6957ee7a70bd5a8fcde4e88fa2',
  FPAR_PENDING_KEY:'pending',FIRMWARE_BASE:'https://example.invalid',
  Uint8Array,TextDecoder,Date,AbortSignal,crypto:webcrypto,
  FQ:id=>controls[id]||(controls[id]={checked:false}),confirm:()=>true,
  log:s=>logs.push(s),fparStatus:(ok,s)=>c.status={ok,s},fparProgress:()=>{},
  localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>{storage[k]=v;}},
  fetch:async()=>({ok:true,arrayBuffer:async()=>Uint8Array.from(bytes).buffer}),
  fparConnect:async()=>{c.FPAR.device=device;c.FPAR.char={};device.gatt.connected=true;}
 };
 vm.createContext(c);vm.runInContext(source,c);
 const set=c.fparParsePrm(bytes.toString());
 const data={1:new Map(c.fparPrep(set,1).map(p=>[p.index,p.value>>>0])),2:new Map(c.fparPrep(set,2).map(p=>[p.index,p.value>>>0]))};
 let fail=null,cap=3;
 c.fparCmd=async p=>{
  calls.push(p);if(fail){const response=fail(p);if(response)return response;}
  if(p[1]===1)return [0xfc,1,cap];
  const node=p[2];assert([1,2].includes(node));
  if(p[1]===2){
   for(let o=4;o<p.length;o+=6)data[node].set(p[o]|p[o+1]<<8,(p[o+2]|p[o+3]<<8|p[o+4]<<16|p[o+5]<<24)>>>0);
   return [0xfc,2,p[3],0,0,0];
  }
  if(p[1]===3)return [0xfc,3,0];
  assert.equal(p[1],4,'checks use FC04 only');
  const idx=p[3]|p[4]<<8;
  const value=idx<1024?data[node].get(idx):({[0x123c]:0x308,[0x1218]:0,[0x1217]:420,[0x4041]:0x640,[0x1204]:0,[0x1205]:0}[idx]);
  assert.notEqual(value,undefined,`index ${idx}`);
  return [0xfc,4,0,value&255,value>>>8&255,value>>>16&255,value>>>24,4];
 };
 return {c,calls,controls,storage,data,device,logs,fail:fn=>fail=fn,cap:v=>cap=v};
}
(async()=>{
 let h=harness();await h.c.fparCompleteCheck();
 assert(h.c.status.ok);assert(h.calls.every(p=>p[1]===4));
 assert.match(h.logs.join('\n'),/ESP32: Non esposta/);
 assert.match(h.logs.join('\n'),/3.8.*patch non esposta/);
 assert.equal(h.controls.fparReport,undefined,'No report element accessed');
 assert.equal(h.calls.filter(p=>(p[3]|p[4]<<8)<1024).length,2050);
 h=harness();h.data[2].set(78,0);await h.c.fparCompleteCheck();assert(!h.c.status.ok);
 assert.match(h.logs.join('\n'),/1 diversi/);assert(h.calls.every(p=>p[1]===4));
 h=harness();h.fail(p=>p[1]===4&&p[2]===2?[0xfc,4,1,0,0,0,0,0]:null);
 await h.c.fparCompleteCheck();assert(!h.c.status.ok);assert.match(h.logs.join('\n'),/non prova un nodo assente/);

 h=harness();await h.c.fparRestoreBoth();
 assert(!h.c.status.ok,'SAVE is not completed persistence');
 assert.deepEqual(h.calls.filter(p=>p[1]===3).map(p=>p[2]),[1,2]);
 for(const node of [1,2]){
  const packets=h.calls.filter(p=>p[1]===2&&p[2]===node);
  assert.equal(packets.reduce((sum,p)=>sum+p[3],0),1022);
  for(const p of packets)for(let o=4;o<p.length;o+=6)assert(![994,1012].includes(p[o]|p[o+1]<<8));
  assert.equal(h.data[node].get(1),node);
 }
 for(const [idx,v] of h.data[1])if(idx!==1)assert.equal(v,h.data[2].get(idx),'only ID differs');
 const before=h.calls.length;await h.c.fparVerifyReboot();assert.equal(h.calls.length,before,'checkbox required');
 h.controls.fparRebootConfirmed.checked=true;await h.c.fparVerifyReboot();
 assert(h.c.status.ok);assert(h.calls.slice(before).every(p=>p[1]===4),'post-reboot read only');
 assert.match(JSON.parse(h.storage.pending)['casoria-id'].state,/VERIFI/);
 h.controls.fparRebootConfirmed.checked=true;h.data[2].set(200,6);await h.c.fparVerifyReboot();
 assert(!h.c.status.ok);assert.match(h.logs.join('\n'),/persistenza NON confermata/);
 assert(!JSON.parse(h.storage.pending)['casoria-id'].verifiedAt,'old success invalidated');

 // Partial second-node failure cannot masquerade as success or pass reboot gate.
 h=harness();h.fail(p=>p[1]===2&&p[2]===2?[0xfc,2,0xe1]:null);await h.c.fparRestoreBoth();
 assert.deepEqual(JSON.parse(h.storage.pending)['casoria-id'].saved,[1]);assert(!h.c.status.ok);
 assert.equal(h.calls.filter(p=>p[1]===3).length,1);
 h.controls.fparRebootConfirmed.checked=true;const count=h.calls.length;await h.c.fparVerifyReboot();assert.equal(h.calls.length,count);
 // Exact device identity is checked, not BLE name.
 h=harness();await h.c.fparRestoreBoth();h.device.id='different-id';h.controls.fparRebootConfirmed.checked=true;
 await h.c.fparVerifyReboot();assert(!h.c.status.ok);assert.match(h.logs.join('\n'),/QUESTA macchina/);
 // Storage, hash, unsafe states, wrong ID, unlock and old firmware fail closed.
 for(const setup of [
  h=>h.c.localStorage.setItem=()=>{throw Error('storage full');},
  h=>h.c.FPAR_CANONICAL_SHA='bad',
  h=>h.data[2].set(1,1),
  h=>h.cap(1),
  h=>h.fail(p=>p[1]===4&&(p[3]|p[4]<<8)===0x1218?[0xfc,4,0,1,0,0,0,4]:null),
  h=>h.c.confirm=()=>false
 ]){
  h=harness();setup(h);await h.c.fparRestoreBoth();assert(!h.calls.some(p=>[2,3].includes(p[1])));assert(!h.c.FPAR.busy);
 }
 h=harness();h.fail(p=>p[1]===2?[0xfc,2,0xe1]:null);await h.c.fparRestoreBoth();assert(!h.calls.some(p=>p[1]===3));
 h=harness();h.fail(p=>p[1]===4&&(p[3]|p[4]<<8)===78?[0xfc,4,0,0,0,0,0,4]:null);
 await h.c.fparRestoreBoth();assert(!h.calls.some(p=>p[1]===3),'no save on full readback mismatch');
 h=harness();h.fail(p=>p[1]===3&&p[2]===2?[0xfc,3,1]:null);await h.c.fparRestoreBoth();
 assert.deepEqual(JSON.parse(h.storage.pending)['casoria-id'].saved,[1]);assert(!h.c.status.ok);
 h=harness();h.fail(p=>p[1]===4?[0xfc,4,0xee]:null);await h.c.fparCompleteCheck();
 assert.match(h.logs.join('\n'),/Manutenzione rifiutata/);assert(!h.c.status.ok);
 // A reload retains the expected target; changing the local file cannot change it.
 h=harness();await h.c.fparRestoreBoth();const saved=h.storage.pending;
 h=harness();h.storage.pending=saved;h.c.FPAR.set=[{index:1,value:99}];h.c.FQ('fparRebootConfirmed').checked=true;
 await h.c.fparVerifyReboot();assert(h.c.status.ok);
 // Legacy custom writes invalidate the verified checkpoint before the first write.
 const params=h.c.fparPrep(h.c.fparParsePrm(bytes.toString()),1);params[78].value=123;
 await h.c.fparRestoreNode(1,params,'legacy');
 assert(!JSON.parse(h.storage.pending)['casoria-id'].verifiedAt);
 assert.deepEqual(JSON.parse(h.storage.pending)['casoria-id'].saved,[]);
 // SAVE ACK must survive post-SAVE readback failure and premature checkbox clicks.
 h=harness();let savedAck=false;
 h.fail(p=>{
  if(p[1]===3){savedAck=true;h.c.FQ('fparRebootConfirmed').checked=true;assert(h.controls.fparRebootConfirmed.disabled);}
  return savedAck&&p[1]===4?[0xfc,4,1,0,0,0,0,0]:null;
 });
 await h.c.fparRestoreBoth();assert.deepEqual(JSON.parse(h.storage.pending)['casoria-id'].saved,[1]);
 assert(!h.controls.fparRebootConfirmed.checked);assert(!h.c.status.ok);
 h=harness();h.c.fparCmd=async()=>{throw Error('timeout risposta 0xFC');};
 await h.c.fparCompleteCheck();assert.match(h.logs.join('\n'),/Nodo 1, OD 0x2001: timeout/);
 assert(h.c.FPAR.busy===false && !h.controls.fparCheckBtn.disabled);
 // Read-only check authorizes a separate user action, never an automatic write.
 h=harness();h.c.FPAR.checkedDeviceId=null;await h.c.fparRestoreBoth();assert.equal(h.calls.length,0);
 h=harness();h.data[1].set(78,123);await h.c.fparCompleteCheck();
 assert(!h.controls.fparBothBtn.hidden);assert.equal(h.c.FPAR.checkedDeviceId,h.device.id);
 assert(h.calls.every(p=>p[1]===4));
 h=harness();h.data[1].set(994,99);h.data[2].set(1012,123456);
 await h.c.fparCompleteCheck();assert(h.c.status.ok);assert(h.controls.fparBothBtn.hidden);
 assert.match(h.logs.join('\n'),/P994: 99.*preservato/);
 // Board-specific fields survive a complete restore on both nodes.
 h=harness();h.data[1].set(994,99);h.data[2].set(1012,123456);
 await h.c.fparRestoreBoth();assert.equal(h.data[1].get(994),99);assert.equal(h.data[2].get(1012),123456);
 h=harness();h.cap(0x9f);await h.c.fparRestoreBoth();assert(!h.calls.some(p=>[2,3].includes(p[1])));
 h=harness();h.c.FPAR.checkedDeviceId='other';await h.c.fparRestoreBoth();assert.equal(h.calls.length,0);
 console.log('PASS complete FTD30: both-node exact set, full readback, read-only checks, partial errors, persistence, identity, safety gates');
})().catch(e=>{console.error(e);process.exitCode=1;});
