// Execute the actual web OTA functions, packet builders, notification parser
// and timers. Only DOM and Bluetooth are simulated; no hardware/network writes.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
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
  let clock = 0, timerId = 0, done = false, failure;
  const timers = new Map(), listeners = new Map(), deviceListeners = new Map();
  const logs = [], progress = [], sectors = [], counts = new Map();
  const button = {};
  const firmware = new Uint8Array(4097).fill(0xa5);
  const ctx = {
    Uint8Array, Date, console,
    OTA_PKT_PAYLOAD:180, OTA_SECTOR_SIZE:4096, OTA_MAX_RETRIES:5, OTA_ACK_TIMEOUT:3000,
    ENTER_RETRIES:3, ENTER_TIMEOUT:7000, OTA_SERVICE_UUID:'service', OTA_CHAR_UUID:'char', IS_ANDROID:false,
    firmwareBytes:firmware,
    document:{getElementById:()=>button},
    log:message=>logs.push(message), otaSetProgress:p=>progress.push(p),
    setTimeout(fn, ms) { const id=++timerId;timers.set(id,{fn,at:clock+ms});return id; },
    clearTimeout(id) { timers.delete(id); }
  };
  const notify = bytes => {
    const data = Uint8Array.from(bytes);
    const event = {target:{value:new DataView(data.buffer)}};
    if (fleet) listeners.get('characteristicvaluechanged')?.(event);
    else ctx.otaOnNotify(event);
  };
  const ack = (sector, status=0) => {
    const p=Uint8Array.from([sector&255,sector>>8,status,0,0,0]);
    const crc=ctx.otaCrc16(p.slice(0,4));p[4]=crc>>8;p[5]=crc;return p;
  };
  const disconnect = () => {
    device.gatt.connected=false;deviceListeners.get('gattserverdisconnected')?.();
  };
  const write = async (bytes, response) => {
    if (response) {
      if (bytes.length===2) {
        if(scenario==='enterWriteFail') throw Error('ENTER write failed');
        notify([0xfe,5,0]);
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
      if(scenario==='disconnect') {disconnect();return;}
      if(scenario==='resyncBackward' && counts.get(1)===1) {notify(ack(0,2));return;}
      if(scenario==='nack' || (scenario==='retryThenSuccess' && counts.get(1)===1)) {notify(ack(sector,1));return;}
      if(scenario==='crcWrong') {const p=ack(sector);p[5]^=1;notify(p);return;}
      if(scenario==='indexWrong') {notify(ack(0));return;}
      if(scenario==='shortAck') {notify(ack(sector).slice(0,4));return;}
      if(scenario==='longAck') {notify([...ack(sector),0]);return;}
    }
    notify(ack(sector));
  };
  const characteristic = {
    startNotifications:async()=>{},
    addEventListener:(name,fn)=>listeners.set(name,fn),
    removeEventListener:name=>listeners.delete(name),
    writeValueWithResponse:bytes=>write(bytes,true),
    writeValueWithoutResponse:bytes=>write(bytes,false)
  };
  const device = {
    addEventListener:(name,fn)=>deviceListeners.set(name,fn),
    removeEventListener:name=>deviceListeners.delete(name),
    gatt:{connected:true, disconnect,
      connect:async()=>({getPrimaryService:async()=>({getCharacteristic:async()=>characteristic})})}
  };
  ctx.ota={char:characteristic,waiter:null};
  vm.createContext(ctx);
  const names=['otaCrc16','otaBuildSectorPackets',...(fleet?['otaUpdateOne']:['otaOnNotify','otaWaitNotify','otaWrite','otaRunUpdate'])];
  vm.runInContext(names.map(extract).join('\n'),ctx);
  const job=fleet?ctx.otaUpdateOne(device,p=>progress.push(p)):ctx.otaRunUpdate(firmware);
  job.then(()=>{done=true;},e=>{failure=e;done=true;});
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
  const success=fleet?!failure:logs.some(s=>s.includes('OTA COMPLETE'));
  if(!success && !fleet) assert(logs.some(s=>s.includes('OTA FAILED')),'missing failure report');
  if(!fleet) assert.equal(button.disabled,false);
  return {success,sectors,progress,failure,logs};
}

(async()=>{
  let cases=0;
  for(const page of ['index.html','fleet.html']) {
    for(const scenario of ['timeout','writeFail','writeFailAck','disconnect','nack','crcWrong','indexWrong',
      'shortAck','longAck','resyncLoop','resyncSame','resyncOutOfRange','enterWriteFail','startWriteFail']) {
      const r=await run(page,scenario);
      assert.equal(r.success,false,`${page}: ${scenario} falsely succeeded`);
      assert(!r.progress.includes(100),`${page}: ${scenario} reported 100%`);
      if(['timeout','nack','crcWrong','indexWrong','shortAck','longAck'].includes(scenario))
        assert.equal(r.sectors.filter(s=>s===1).length,5,`${page}: bounded final retry`);
      cases++;
    }
    for(const [scenario,expected] of [['success',[0,1]],['retryThenSuccess',[0,1,1]],
      ['resyncBackward',[0,1,0,1]],['resyncForward',[0,1]]]) {
      const r=await run(page,scenario);
      assert(r.success,`${page}: ${scenario} failed`);
      assert.deepEqual(r.sectors,expected,`${page}: wrong resync target/increment`);
      assert.equal(r.progress.at(-1),100);cases++;
    }
  }
  assert.equal(unhandled.length,0,`unhandled rejection: ${unhandled}`);
  console.log(`PASS ${cases} actual web OTA completion scenarios: strict ACK, failures, bounded resync and pending-promise cleanup`);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>process.removeListener('unhandledRejection',onUnhandled));
