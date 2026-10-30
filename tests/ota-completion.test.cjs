// Execute the actual web OTA functions, packet builders, notification parser
// and timers. Only DOM and Bluetooth are simulated; no hardware/network writes.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const assert = require('node:assert/strict');
const immediate = () => new Promise(resolve => setImmediate(resolve));
const unhandled = [];
const onUnhandled = error => unhandled.push(error);
process.on('unhandledRejection', onUnhandled);

async function run(page, scenario) {
  const html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
  const extract = name => {
    const m = html.match(new RegExp('^(?:async )?function ' + name + '\\([^]*?^}', 'm'));
    assert(m, `${page}: ${name}`); return m[0];
  };
  const fleet = page === 'fleet.html';
  let clock = 0, timerId = 0, done = false, failure, result, timersAtFinish;
  let cleanupDisconnects = 0, remoteDisconnects = 0;
  let finalAckAt, cleanupAt, finishedAt;
  let watchSignal;
  const timers = new Map(), listeners = new Map(), deviceListeners = new Map();
  const logs = [], progress = [], sectors = [], counts = new Map();
  let enterWrites = 0, stopWrites = 0;
  const button = {};
  const firmware = new Uint8Array(4097).fill(0xa5);
  const ctx = {
    Uint8Array, Uint16Array, TextDecoder, Date, console, AbortController, crypto:webcrypto,
    OTA_PKT_PAYLOAD:180, OTA_SECTOR_SIZE:4096, OTA_MAX_RETRIES:5, OTA_ACK_TIMEOUT:3000,
    ENTER_RETRIES:3, ENTER_TIMEOUT:7000, OTA_SERVICE_UUID:'service', OTA_CHAR_UUID:'char', IS_ANDROID:false,
    firmwareBytes:firmware,
    document:{getElementById:()=>button},
    log:message=>logs.push(message), otaSetProgress:p=>progress.push(p), otaSetStatus:()=>{},
    setTimeout(fn, ms) { const id=++timerId;timers.set(id,{fn,at:clock+ms});return id; },
    clearTimeout(id) { timers.delete(id); }
  };
  const notify = bytes => {
    const data = Uint8Array.from(bytes);
    const event = {target:{value:new DataView(data.buffer)}};
    listeners.get('characteristicvaluechanged')?.(event);
  };
  const ack = (sector, status=0) => {
    const p=Uint8Array.from([sector&255,sector>>8,status,0,0,0]);
    const crc=ctx.otaCrc16(p.slice(0,4));p[4]=crc>>8;p[5]=crc;return p;
  };
  const disconnect = () => {
    device.gatt.connected=false;
    for(const listener of [...(deviceListeners.get('gattserverdisconnected') || [])]) listener();
  };
  const remoteDisconnect = () => { remoteDisconnects++; disconnect(); };
  const write = async (bytes, response) => {
    if (response) {
      if (bytes.length===5 && bytes[0]===0xAA && bytes[1]===0x13) {
        const version='V12.2.34-PDO-FULL', offset=bytes[4], chunk=[...Buffer.from(version)].slice(offset,offset+13);
        notify([0xaa,0x13,1,bytes[2],bytes[3],version.length,offset,...chunk]);
      } else if (bytes.length===2 && bytes[0]===0xAA && bytes[1]===0x03) {
        stopWrites++;
        notify([0xaa,3,scenario==='stopAckFail'?0xff:0]);
      } else if (bytes.length===2) {
        enterWrites++;
        if(scenario==='enterWriteFail') throw Error('ENTER write failed');
        if(scenario==='motorRunningStuck' || scenario==='recoveryGateStuck' ||
           (scenario==='recoveryGateThenSuccess' && enterWrites<3) ||
           ((scenario==='motorRunningThenStop'||scenario==='stopAckFail') && enterWrites===1))
          notify([0xfe,0xe0,9]);
        else if(scenario==='maintenanceBusy') notify([0xfe,0xe0,0x0A]);
        else notify([0xfe,5,0]);
      } else {
        if(scenario==='startWriteFail') throw Error('START write failed');
        const reply=new Uint8Array(20);reply[1]=3;notify(reply);
      }
      return;
    }
    const sector=bytes[0]|(bytes[1]<<8);
    if(bytes[2]!==255) return;
    sectors.push(sector);counts.set(sector,(counts.get(sector)||0)+1);
    assert(sectors.length<=20,'unbounded resync/retry');
    if(scenario==='resyncLoop') {notify(ack(1-sector,2));return;}
    if(scenario==='resyncOutOfRange') {notify(ack(2,2));return;}
    if(scenario==='resyncSame') {notify(ack(sector,2));return;}
    if(scenario==='resyncForward' && sector===0) {notify(ack(1,2));return;}
    if(sector===1) {
      if(scenario==='writeFailAck') {notify(ack(sector));throw Error('final write failed after notification');}
      if(scenario==='writeFail') throw Error('final write failed');
      if(scenario==='timeout') return;
      if(scenario==='disconnect') {remoteDisconnect();return;}
      if(scenario==='resyncBackward' && counts.get(1)===1) {notify(ack(0,2));return;}
      if(scenario==='nack' || (scenario==='retryThenSuccess' && counts.get(1)===1)) {notify(ack(sector,1));return;}
      if(scenario==='crcWrong') {const p=ack(sector);p[5]^=1;notify(p);return;}
      if(scenario==='indexWrong') {notify(ack(0));return;}
      if(scenario==='shortAck') {notify(ack(sector).slice(0,4));return;}
      if(scenario==='longAck') {notify([...ack(sector),0]);return;}
    }
    if(sector===1) finalAckAt=clock;
    notify(ack(sector));
    if(sector===1 && scenario==='disconnectWithAck') remoteDisconnect();
    if(sector===1 && scenario==='disconnectAfterAck') ctx.setTimeout(remoteDisconnect, 10);
    if(sector===1 && scenario==='delayedReboot') ctx.setTimeout(remoteDisconnect, 7999);
  };
  const characteristic = {
    startNotifications:async()=>{if(scenario==='notificationFail') throw Error('notifications failed');},
    addEventListener:(name,fn)=>listeners.set(name,fn),
    removeEventListener:name=>listeners.delete(name),
    writeValueWithResponse:bytes=>write(bytes,true),
    writeValueWithoutResponse:bytes=>write(bytes,false)
  };
  const device = {
    name:'wazlley_AB12',
    addEventListener:(name,fn)=>{
      if(!deviceListeners.has(name)) deviceListeners.set(name,new Set());
      deviceListeners.get(name).add(fn);
    },
    removeEventListener:(name,fn)=>{
      const group=deviceListeners.get(name);group?.delete(fn);
      if(group?.size===0) deviceListeners.delete(name);
    },
    gatt:{connected:!scenario.startsWith('advert'), disconnect:()=>{cleanupDisconnects++;cleanupAt=clock;disconnect();},
      connect:async()=>{
        if(scenario==='connectFail' || scenario.startsWith('advert')) throw Error('connect failed');
        device.gatt.connected=true;
        return {getPrimaryService:async()=>{
          if(scenario==='serviceFail') throw Error('service failed');
          return {getCharacteristic:async()=>characteristic};
        }};
      }}
  };
  if(scenario.startsWith('advert')) device.watchAdvertisements = async ({signal}) => {
    watchSignal=signal;
    if(scenario==='advertReject') throw Error('watch unsupported');
    if(scenario==='advertEarly') ctx.setTimeout(()=>{
      for(const listener of deviceListeners.get('advertisementreceived') || []) listener();
    },1);
  };
  ctx.navigator={userAgent:'host test',bluetooth:{requestDevice:async()=>device}};
  ctx.ota={char:null,device:null,server:null,waiter:null,cancelWait:null,disconnectListener:null};
  vm.createContext(ctx);
  const names=['otaCrc16','otaBuildSectorPackets',...(fleet?['otaUpdateOne']:
    ['otaOnNotify','otaWaitNotify','otaWrite','otaReleaseConnection','otaWaitForReboot','otaConnect',
     'otaReadInstalledVersion','otaIsMotorRunningReply','otaEnterUpdateMode','otaRunUpdate'])];
  vm.runInContext(names.map(extract).join('\n'),ctx);
  const assertReleased = () => {
    assert.equal(device.gatt.connected,false,`${page}: GATT still connected`);
    assert.equal(listeners.size,0,`${page}: stale notification listener`);
    assert.equal(deviceListeners.size,0,`${page}: stale device listener`);
    if(!fleet) for(const key of ['device','server','char','waiter','cancelWait','disconnectListener'])
      assert.equal(ctx.ota[key],null,`single OTA retained ${key}`);
  };
  const single = async () => {
    if(!await ctx.otaConnect()) throw Error('connect failed');
    const recovery=scenario.startsWith('recovery');
    if(recovery) assert.equal(await ctx.otaReadInstalledVersion(),'V12.2.34-PDO-FULL');
    const result=await ctx.otaRunUpdate(firmware,{recovery34:recovery});
    assertReleased();
    return result;
  };
  const job=fleet?ctx.otaUpdateOne(device,p=>progress.push(p)):(async()=>{
    if(scenario==='repeatSuccess') await single();
    return single();
  })();
  job.then(r=>{result=r;done=true;finishedAt=clock;timersAtFinish=timers.size;},e=>{failure=e;done=true;timersAtFinish=timers.size;});
  // Drain microtasks, then advance to the next production timeout/pacing event.
  // Drain remaining timers after write errors too: their rejection must be handled.
  for(let ticks=0;!done || timers.size;ticks++) {
    assert(ticks<1000,'task/timer did not terminate');
    await immediate();
    if(timers.size) {
      const [id,t]=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];
      timers.delete(id);clock=t.at;t.fn();
    } else assert(done,'unresolved task without timer');
  }
  await immediate();await immediate();
  const success=!failure && result?.status==='transferred-unverified';
  if(!success && !fleet && !['connectFail','serviceFail','notificationFail'].includes(scenario))
    assert(logs.some(s=>s.includes('OTA FAILED')),'missing failure report');
  if(!fleet && button.disabled!==undefined) assert.equal(button.disabled,false);
  assertReleased();
  assert.equal(timersAtFinish,0,`${page}: timer survived completion/cleanup`);
  if(failure) {
    assert.equal(device.gatt.connected,false,`${page}: failed transfer left GATT connected`);
    assert.equal(listeners.size,0,`${page}: stale notification listener`);
    assert.equal(timersAtFinish,0,`${page}: timer survived failure`);
    if(!fleet) {
      if(!['connectFail','serviceFail','notificationFail'].includes(scenario)) assert.equal(failure.status,'failed');
      assert.equal(ctx.ota.waiter,null);
      assert.equal(ctx.ota.char,null);
      assert.equal(ctx.ota.server,null);
    }
  }
  if(fleet) assert.equal(deviceListeners.size,0,'stale disconnect listener');
  if(watchSignal) assert.equal(watchSignal.aborted,true,'advertisement watch not aborted');
  assert(!logs.some(s=>s.includes('OTA COMPLETE')),'transfer presented as installed');
  if(success) assert(!logs.some(s=>s.includes('OTA FAILED')),'cleanup falsely reported transfer failure');
  return {success,sectors,progress,failure,logs,result,cleanupDisconnects,remoteDisconnects,finalAckAt,cleanupAt,finishedAt,enterWrites,stopWrites};
}

(async()=>{
  let cases=0;
  for(const page of ['index.html','fleet.html']) {
    for(const scenario of ['timeout','writeFail','writeFailAck','disconnect','nack','crcWrong','indexWrong',
      'shortAck','longAck','resyncLoop','resyncSame','resyncOutOfRange','enterWriteFail','startWriteFail',
      'motorRunningStuck','stopAckFail','motorRunningThenStop','maintenanceBusy']) {
      const r=await run(page,scenario);
      assert.equal(r.success,false,`${page}: ${scenario} falsely succeeded`);
      assert(r.failure,`${page}: ${scenario} swallowed failure`);
      assert(!r.progress.includes(100),`${page}: ${scenario} reported 100%`);
      if(scenario==='maintenanceBusy') {
        assert.equal(r.stopWrites,0);assert.equal(r.sectors.length,0);
        assert.match(r.failure.message,/Risorse di manutenzione ESP32/);
      }
      if(['motorRunningStuck','stopAckFail','motorRunningThenStop'].includes(scenario)) {
        assert.equal(r.stopWrites,0,'internal OTA must not send motor commands');
        assert.equal(r.enterWrites,1,'legacy refusal must not loop waiting for drivers');
        assert.equal(r.sectors.length,0,'refused firmware must not receive data');
        assert.match(r.failure.message,/firmware installato/);
      }
      if(['timeout','nack','crcWrong','indexWrong','shortAck','longAck'].includes(scenario))
        assert.equal(r.sectors.filter(s=>s===1).length,5,`${page}: bounded final retry`);
      cases++;
    }
    for(const [scenario,expected] of [['success',[0,1]],['retryThenSuccess',[0,1,1]],
      ['resyncBackward',[0,1,0,1]],['resyncForward',[0,1]],['disconnectAfterAck',[0,1]]]) {
      const r=await run(page,scenario);
      assert(r.success,`${page}: ${scenario} failed`);
      assert.deepEqual(r.sectors,expected,`${page}: wrong resync target/increment`);
      assert.equal(r.progress.at(-1),100);cases++;
      assert.equal(r.result.runningVersion,null);
      assert.equal(r.result.status,'transferred-unverified');
      assert.equal(r.result.disconnectObserved,scenario==='disconnectAfterAck');
      assert.equal(r.cleanupDisconnects,scenario==='disconnectAfterAck'?0:1);
      assert.equal(r.finishedAt-r.finalAckAt,scenario==='disconnectAfterAck'?10:8000,
        'preserve reboot grace, bounded at 8 seconds');
      assert.equal(r.stopWrites,0,'internal ESP32 OTA has no motor pre-check or STOP');
    }
    if(page==='fleet.html') {
      for(const scenario of ['connectFail','serviceFail','notificationFail','advertReject','advertEarly','advertTimeout']) {
        const r=await run(page,scenario);
        assert(r.failure,`${scenario}: swallowed failure`);cases++;
      }
    } else {
      for(const scenario of ['connectFail','serviceFail','notificationFail']) {
        const r=await run(page,scenario);assert(r.failure);cases++;
      }
      for(const scenario of ['disconnectWithAck','delayedReboot','repeatSuccess']) {
        const r=await run(page,scenario);assert(r.success);cases++;
        assert.equal(r.result.disconnectObserved,scenario!=='repeatSuccess');
        assert.equal(r.finishedAt-r.finalAckAt,
          scenario==='disconnectWithAck'?0:scenario==='delayedReboot'?7999:8000);
        assert.equal(r.cleanupDisconnects,scenario==='repeatSuccess'?2:0);
        assert.deepEqual(r.sectors,scenario==='repeatSuccess'?[0,1,0,1]:[0,1]);
      }
      const recovery=await run(page,'recoveryGateThenSuccess');cases++;
      assert(recovery.success,'Recovery should transfer after the old gate opens');
      assert.equal(recovery.stopWrites,0,'Recovery must never send STOP');
      assert.equal(recovery.enterWrites,3,'Recovery retries only FE05');
      const stuck=await run(page,'recoveryGateStuck');cases++;
      assert.equal(stuck.success,false);
      assert.equal(stuck.stopWrites,0,'Rejected Recovery must never send STOP');
      assert.equal(stuck.sectors.length,0,'Rejected Recovery must not stream firmware');
      assert(stuck.enterWrites > 1 && stuck.enterWrites <= 30,'Recovery retry bound');
    }
  }
  assert.equal(unhandled.length,0,`unhandled rejection: ${unhandled}`);
  console.log(`PASS ${cases} actual web OTA completion scenarios: strict ACK, propagated failures, GATT/listener/timer cleanup, bounded resync, transfer != verified running version`);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>process.removeListener('unhandledRejection',onUnhandled));
