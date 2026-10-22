// Host-only contract tests for the real Fleet job, row and session renderer.
// No transport, database or network is contacted.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '../fleet.html'), 'utf8');
const extract = name => html.match(new RegExp('^(?:async )?function ' + name + '\\([^]*?^}', 'm'))[0];
const target = 'V12.2.49-PDO-FULL';

async function run(result, kind = 'firmware', verification = result) {
  let calls = 0;
  const events = [], logs = [];
  const row = { device:{name:'test'}, prog:{style:{}}, dot:{}, stateLabel:{}, msg:{}, retryBtn:{}, reselectBtn:{} };
  const original = {serial:'test', current_firmware:'V12.2.27-PDO-FULL', marker:'preserve'};
  const ctx = {
    firmwareVersion:target, busy:true, DEVICE_ATTEMPTS:3, RETRY_PAUSE_MS:100,
    dbRoster:new Map([['test', original]]), nowMs:()=>0,
    logEvent:(...args)=>events.push(args), log:message=>logs.push(message),
    setTimeout:fn=>fn(),
    otaUpdateOne:async()=>{calls++;if(result instanceof Error) throw result;return result;},
    verifyFleetRunningVersion:async()=>{if(verification instanceof Error)throw verification;return verification;},
    nextionUpdateOne:async()=>{calls++;},
  };
  vm.createContext(ctx);
  vm.runInContext(['setState','runDeviceJob'].map(extract).join('\n'), ctx);
  const outcome = await ctx.runDeviceJob(row, kind);
  return {outcome,events,logs,row,calls,roster:ctx.dbRoster.get('test'),original};
}

function render(status, success, motors = false) {
  const element = () => ({children:[], append(...items){this.children.push(...items);}, appendChild(item){this.children.push(item);}});
  const list = element();
  const ctx = {sessionResults:[], Date, $:()=>list, document:{createElement:element}};
  vm.createContext(ctx);vm.runInContext(extract('addSessionResult'),ctx);
  ctx.addSessionResult({serial:'test', status, success, motors, mode:'Firmware', duration_s:0, message:'result'});
  return list.children[0].children[0];
}

(async()=>{
  for(const disconnectObserved of [false,true]) {
    const r = await run({status:'transferred-unverified',runningVersion:null,disconnectObserved});
    assert.equal(r.calls,1,'unverified transfer must not auto-reflash');
    assert.equal(r.outcome.status,'transferred-unverified');
    assert.equal(r.outcome.success,false);
    assert.equal(r.roster,r.original,'unverified transfer mutated installed firmware');
    assert.deepEqual(r.events.map(e=>e[1]),['ota_started'],'unverified transfer emitted completed/failed');
    assert.equal(r.row.state,'unverified');
    assert.match(r.row.stateLabel.textContent,/non verificato/);
    assert.match(r.row.dot.className,/warn/);
  }
  for(const result of [Error('write failed'),undefined,{status:'verified',runningVersion:null},
    {status:'verified',runningVersion:'V12.2.27-PDO-FULL'}]) {
    const r = await run(result);
    assert.equal(r.outcome.success,false);
    assert.equal(r.outcome.status,'failed');
    assert.equal(r.roster,r.original);
    assert.equal(r.calls,3);
    assert.deepEqual(r.events.map(e=>e[1]),['ota_started','ota_failed']);
  }
  // Only an explicit verified-running contract with matching readback can
  // reach this branch; ACK/disconnect alone remain insufficient.
  const verified = await run({status:'verified',runningVersion:target});
  assert.equal(verified.outcome.success,true);
  assert.equal(verified.roster.current_firmware,target);
  assert.equal(verified.roster.marker,'preserve');
  assert.deepEqual(verified.events.map(e=>e[1]),['ota_started','ota_completed']);
  const postReboot=await run({status:'transferred-unverified',disconnectObserved:true},'firmware',
    {status:'verified',runningVersion:target,deviceId:'same'});
  assert.equal(postReboot.calls,1);assert.equal(postReboot.outcome.success,true);
  assert.equal(postReboot.roster.current_firmware,target);
  assert.deepEqual(postReboot.events.map(e=>e[1]),['ota_started','ota_completed']);
  for(const verification of [Error('readback failed'),{status:'transferred-unverified',reason:'old version'}]){
    const r=await run({status:'transferred-unverified',disconnectObserved:true},'firmware',verification);
    assert.equal(r.calls,1,'verification failure must never repeat transfer');
    assert.equal(r.outcome.status,'transferred-unverified');assert.equal(r.roster,r.original);
    assert.deepEqual(r.events.map(e=>e[1]),['ota_started']);
  }
  const display = await run(undefined,'nextion');
  assert.equal(display.outcome.success,true);
  assert.equal(display.roster,display.original);
  assert.deepEqual(display.events.map(e=>e[1]),['nextion_started','nextion_completed']);
  assert.equal(render('transferred-unverified',false).textContent,'NON VERIFICATA');
  assert.equal(render('transferred-unverified',false).className,'result-badge warn');
  assert.equal(render('failed',false).textContent,'ERRORE');
  assert.equal(render('verified',true).textContent,'COMPLETATA');
  assert.equal(render('failed',false,true).textContent,'MOTORI ACCESI');
  console.log('PASS 8 Fleet job contracts + 5 session badge checks: no inferred install, no unverified retry/event/roster mutation; explicit verified-running gate');
})().catch(error=>{console.error(error);process.exitCode=1;});
