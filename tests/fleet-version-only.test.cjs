const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {test}=require('node:test');
const html=fs.readFileSync(path.join(__dirname,'../fleet.html'),'utf8');
const extract=name=>html.match(new RegExp('^(?:async )?function '+name+'\\([^]*?^}', 'm'))[0];
const target='V12.2.51-PDO-FULL';
async function run(outcomes,initialBusy=false){
 const ids=new Map(),results=[],calls=[],logs=[],states=[];
 const rows=new Map(outcomes.map((_,i)=>[String(i),{device:{id:String(i),name:'wazlley_'+i},
  chk:{checked:true},prog:{style:{}},dot:{},stateLabel:{},msg:{},retryBtn:{},reselectBtn:{}}]));
 let active=0,maxActive=0;
 const forbidden=()=>{throw Error('write/update path invoked by read-only verification');};
 const ctx={busy:initialBusy,rows,FLEET_TARGET_VERSION:target,firmwareBytes:null,firmwareVersion:null,
  $:id=>{if(!ids.has(id))ids.set(id,{});return ids.get(id);},nowMs:()=>1000,
  updateEmptyState(){ctx.$('verifyVersionBtn').disabled=ctx.busy;ctx.$('updateAllBtn').disabled=ctx.busy;},
  renderKnownDevices(){},renderFleetViews(){},moveToCurrent(){},
  leaveCurrent(row,remove){assert.equal(remove,false);row.chk.checked=false;states.push(row.state);},
  log:m=>logs.push(m),addSessionResult:r=>results.push(r),
  otaUpdateOne:forbidden,runDeviceJob:forbidden,nextionUpdateOne:forbidden,
  fleetParametersOne:forbidden,downloadFirmware:forbidden,logEvent:forbidden,bumpSessionDone:forbidden,
  verifyFleetRunningVersion:async(device,expected,reboot,purpose)=>{
   assert.equal(expected,target);assert.equal(reboot,false);assert.equal(purpose,'read-only');
   assert.equal(ctx.busy,true);assert.equal(ctx.$('verifyVersionBtn').disabled,true);
   assert.equal(ctx.$('addBtn').disabled,true);
   calls.push(device.id);maxActive=Math.max(maxActive,++active);await Promise.resolve();active--;
   const outcome=outcomes[Number(device.id)];if(outcome instanceof Error)throw outcome;
   return outcome;
  }};
 vm.createContext(ctx);vm.runInContext(extract('setState')+'\n'+extract('verifyVersionSequence'),ctx);
 await ctx.verifyVersionSequence([...rows.values()]);
 return {ctx,rows,results,calls,states,maxActive};
}
test('four already-updated machines: sequential reads, no binary, flash or OTA event',async()=>{
 const r=await run(Array.from({length:4},(_,i)=>({status:'verified',runningVersion:target,deviceId:String(i)})));
 assert.deepEqual(r.calls,['0','1','2','3']);assert.equal(r.maxActive,1);assert.equal(r.rows.size,4);
 assert.equal(r.ctx.busy,false);assert.equal(r.ctx.$('addBtn').disabled,false);
 assert.equal(r.ctx.$('verifyVersionBtn').disabled,false);
 assert.match(r.ctx.$('selMsg').textContent,/4\/4/);
 for(const row of r.rows.values()){
  assert.equal(row.state,'version-verified');assert.equal(row.chk.checked,false);
  assert.equal(row.retryBtn.hidden,true);assert.equal(row.reselectBtn.hidden,true);
 }
 assert(r.results.every(r=>r.success&&r.status==='version-verified'));
});
test('mismatch, timeout and unexpected reader failure do not prevent the next machine read',async()=>{
 const r=await run([{status:'transferred-unverified',runningVersion:'V12.2.28-PDO-FULL',reason:'Versione avviata V12.2.28-PDO-FULL; attesa '+target},
  {status:'transferred-unverified',reason:'Timeout verifica BLE'},Error('disconnected'),
  {status:'verified',runningVersion:target,deviceId:'3'}]);
 assert.deepEqual(r.states,['version-mismatch','version-unread','version-unread','version-verified']);
 assert.equal(r.results.length,4);assert.equal(r.ctx.busy,false);assert.match(r.ctx.$('selMsg').textContent,/1\/4/);
 assert.match(r.results[0].message,/V12.2.28/);
 for(const row of r.rows.values()){assert.equal(row.retryBtn.hidden,true);assert.equal(row.reselectBtn.hidden,true);}
});
test('wrong device identity cannot confirm an installation',async()=>{
 const r=await run([{status:'verified',runningVersion:target,deviceId:'other-device'}]);
 assert.equal(r.results[0].success,false);assert.equal(r.states[0],'version-unread');
});
test('busy gate prevents concurrent verification',async()=>{
 const r=await run([{}],true);assert.equal(r.calls.length,0);assert.equal(r.ctx.busy,true);
});
test('empty selection performs no operations',async()=>{
 const r=await run([]);assert.equal(r.calls.length,0);assert.equal(r.ctx.busy,false);
});
test('button uses only checked rows and verification path',()=>{
 const handler=html.match(/\$\('verifyVersionBtn'\)\.addEventListener\('click', \(\) => \{[^]*?\n\}\);/)[0];
 assert.match(handler,/filter\(r => r.chk.checked\)/);assert.match(handler,/verifyVersionSequence\(selected\)/);
 assert.doesNotMatch(handler,/updateSequence|runDeviceJob|downloadFirmware/);
 assert.match(html,/Verifica versione selezionate · senza flash/);
});
test('verify button does not require a downloaded firmware binary',()=>{
 const ids=new Map();
 const ctx={rows:new Map([['1',{}]]),busy:false,fleetMode:'firmware',firmwareBytes:null,
  $:id=>{if(!ids.has(id))ids.set(id,{querySelectorAll:()=>[{}],querySelector:()=>null});return ids.get(id);}};
 vm.createContext(ctx);vm.runInContext(extract('updateEmptyState'),ctx);ctx.updateEmptyState();
 assert.equal(ctx.$('updateAllBtn').disabled,true);assert.equal(ctx.$('verifyVersionBtn').disabled,false);
 ctx.busy=true;ctx.updateEmptyState();assert.equal(ctx.$('verifyVersionBtn').disabled,true);
 ctx.busy=false;ctx.rows.clear();ctx.updateEmptyState();assert.equal(ctx.$('verifyVersionBtn').disabled,true);
});
test('standalone history never labels a verification as a transfer or update',()=>{
 const element=()=>({children:[],append(...items){this.children.push(...items);},appendChild(item){this.children.push(item);}});
 for(const [status,success,label] of [['version-verified',true,'VERIFICATA'],['version-mismatch',false,'DIVERSA'],['version-unread',false,'NON LETTA']]){
  const list=element(),ctx={sessionResults:[],Date,$:()=>list,document:{createElement:element}};
  vm.createContext(ctx);vm.runInContext(extract('addSessionResult'),ctx);
  ctx.addSessionResult({serial:'test',status,success,mode:'Verifica versione',duration_s:0});
  const badge=list.children[0].children[0];assert.equal(badge.textContent,label);
  assert.equal(badge.className,'result-badge '+(success?'ok':'warn'));
 }
});
