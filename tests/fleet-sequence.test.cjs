const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(require('node:path').join(__dirname, '../fleet.html'), 'utf8');
const source = html.match(/async function updateSequence\([^]*?^}/m)[0];

async function run(mode, failure, version = 'V12.1.6') {
  const events = [], results = [], elements = {};
  const row = {device:{name:'test'}, retryBtn:{}, reselectBtn:{}, prog:{style:{}}};
  const ctx = {
    fleetMode:mode, firmwareVersion:version, firmwareBytes:new Uint8Array(1), busy:false,
    tftSquare:true, tftCircle:true, tftRoundSmall:true,
    AFTER_FW_REBOOT_MS:11000, INTER_DEVICE_MS:1500, DEVICE_ATTEMPTS:3,
    rows:new Map([['test', row]]), nowMs:()=>0,
    $:id=>elements[id] ||= {},
    setTimeout:(fn, ms)=>{ events.push(`wait:${ms}`); fn(); },
    setState:(r, state)=>r.state=state,
    renderKnownDevices(){}, moveToCurrent(){}, bumpSessionDone(){},
    renderFleetViews(){}, updateEmptyState(){}, log(){},
    leaveCurrent:(r, success)=>events.push(`complete:${success}`),
    addSessionResult:r=>results.push(r),
    loadFleetParameterSet:async()=>{events.push('load');if(failure==='download')throw Error('HTTP 404');},
    runDeviceJob:async(r, type)=>{
      events.push(type);
      return {success:failure!=='firmware' && failure!=='motors', motors:failure==='motors', lastErr:'OTA failed'};
    },
    fleetParametersOne:async()=>{events.push('parameters');if(failure==='parameters')throw Error('Mismatch');}
  };
  vm.createContext(ctx); vm.runInContext(source, ctx);
  await ctx.updateSequence([row]);
  assert.equal(ctx.busy,false);
  return {events,results,elements};
}

(async()=>{
  let r = await run('firmware_parameters');
  assert.deepEqual(r.events,['load','firmware','wait:11000','parameters','complete:true','wait:1500']);
  assert.match(r.results[0].mode,/V12.1.6.*Parametri nodo 1/);
  for(const failure of ['firmware','motors']) {
    r=await run('firmware_parameters', failure);
    assert(!r.events.includes('parameters'));
    assert(!r.events.includes('wait:11000'));
    assert.equal(r.results[0].success,false);
  }
  r=await run('firmware_parameters','parameters');
  assert.equal(r.results[0].success,false);
  assert.equal(r.events.filter(e=>e==='parameters').length,1);
  r=await run('parameters');
  assert.deepEqual(r.events,['load','parameters','complete:true','wait:1500']);
  r=await run('firmware_parameters','download');
  assert.deepEqual(r.events,['load']);
  assert.match(r.elements.selMsg.textContent,/Nessuna macchina modificata/);
  r=await run('both');
  assert.deepEqual(r.events,['firmware','wait:11000','nextion','complete:true','wait:1500']);
  r=await run('firmware_parameters',null,'V12.1.3');
  assert.equal(r.events.length,0);
  assert.match(r.elements.selMsg.textContent,/V12.1.6/);
  console.log('Fleet sequence: firmware + parameters, failure gates, reboot wait, separate modes passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
