const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {test}=require('node:test');
const html=fs.readFileSync(path.join(__dirname,'../fleet.html'),'utf8');
const source=html.match(/^async function verifyFleetRunningVersion\([^]*?^}/m)[0];
const target='V12.2.34-PDO-FULL';
const turn=()=>new Promise(r=>setImmediate(r));

async function run(scenario, purpose = 'post-update'){
 let now=0,id=0,attempts=0,tokenCounter=123,done=false,result,error;
 const timers=new Map(),deviceListeners=new Set(),chars=[],writes=[];
 const ctx={Uint8Array,Uint16Array,Promise,Error,String,Math,
   OTA_SERVICE_UUID:'service',OTA_CHAR_UUID:'char',nowMs:()=>now,
   crypto:{getRandomValues:b=>{b[0]=++tokenCounter;return b;}},
   setTimeout:(fn,ms)=>{const key=++id;timers.set(key,{fn,at:now+ms});return key;},
   clearTimeout:key=>timers.delete(key)};
 const hang=()=>new Promise(()=>{});
 const disconnect=()=>{device.gatt.connected=false;for(const f of deviceListeners)f();};
 const notify=(char,bytes,other=false)=>{
   // Test byteOffset/byteLength, not the whole backing ArrayBuffer.
   const raw=Uint8Array.from([9,9,...bytes,9,9]);
   char.value=new DataView(raw.buffer,2,bytes.length);
   for(const f of char.listeners)f({target:other?{value:char.value}:char});
 };
 const device={id:'physical-device-1',name:'wazlley_test',
   addEventListener:(event,f)=>{assert.equal(event,'gattserverdisconnected');deviceListeners.add(f);},
   removeEventListener:(event,f)=>deviceListeners.delete(f),
   gatt:{connected:false,disconnect,connect:async()=>{
     attempts++;
     if(scenario==='connectTimeout')return hang();
     if(scenario==='connectFail' || (scenario==='retryConnect' && attempts<3))throw Error('out of range');
     if(scenario==='lateConnect')await new Promise(r=>ctx.setTimeout(r,9000));
     device.gatt.connected=true;
     const char={listeners:new Set(),
       addEventListener:(event,f)=>char.listeners.add(f),
       removeEventListener:(event,f)=>char.listeners.delete(f),
       startNotifications:async()=>scenario==='notificationTimeout'?hang():undefined,
       writeValueWithResponse:async bytes=>{
         writes.push(Array.from(bytes));
         assert.equal(bytes.length,5);assert.deepEqual(Array.from(bytes.slice(0,2)),[0xaa,0x13]);
         if(scenario==='writeTimeout')return hang();
         if(scenario==='writeFail')throw Error('ATT write failed');
         if(scenario==='disconnect'){disconnect();return;}
         if(scenario==='silent')return;
         if(scenario==='wrongIdentity')device.id='another-device';
         if(scenario==='nack'){notify(char,[0xaa,0x13,0xff]);return;}
         const version=scenario==='mismatch'?'V12.2.33-PDO-FULL':scenario==='lithium'?'V12.2.34-LI10S-PDO-FULL':target;
         const offset=bytes[4],text=Array.from(Buffer.from(version)).slice(offset,offset+13);
         const reply=[0xaa,0x13,1,bytes[2],bytes[3],version.length,offset,...text];
         if(scenario==='wrongToken')reply[4]^=1;
         if(scenario==='wrongOffset')reply[6]++;
         if(scenario==='wrongProtocol')reply[2]=2;
         if(scenario==='tooLong')reply[5]=65;
         if(scenario==='empty')reply[5]=0;
         if(scenario==='nonAscii')reply[7]=0;
         if(scenario==='short')reply.pop();
         if(scenario==='long')reply.push(1);
         if(scenario==='inconsistent' && offset)reply[5]++;
         if(scenario==='noise'){notify(char,[0xaa,0x10,1,2,3]);const old=[...reply];old[4]^=1;notify(char,old);}
         notify(char,reply,scenario==='otherCharacteristic');
       }};
     chars.push(char);
     return {disconnect,getPrimaryService:async uuid=>{
       assert.equal(uuid,'service');if(scenario==='serviceTimeout')return hang();
       return {getCharacteristic:async uuid=>{assert.equal(uuid,'char');return char;}};
     }};
   }}};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 ctx.verifyFleetRunningVersion(device,target,purpose==='post-update' && scenario!=='noReboot',purpose).then(r=>{result=r;done=true;},e=>{error=e;done=true;});
 for(let i=0;!done || timers.size;i++){
   assert(i<150,'unbounded verification');await turn();
   if(timers.size){const [key,t]=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];timers.delete(key);now=t.at;t.fn();}
   else assert(done,'promise stranded without timeout');
 }
 await turn();await turn();
 assert.ifError(error);assert.equal(device.gatt.connected,false);
 assert.equal(deviceListeners.size,0);for(const char of chars)assert.equal(char.listeners.size,0);
 assert(attempts<=3);assert(now<=45000,`deadline exceeded: ${now}`);
 return {result,attempts,writes};
}
for(const scenario of ['success','noise','retryConnect'])test(`version proof ${scenario}`,async()=>{
 const r=await run(scenario);assert.equal(r.result.status,'verified');assert.equal(r.result.runningVersion,target);
 assert.equal(r.result.deviceId,'physical-device-1');assert.equal(r.writes.length,2);
 assert.equal(r.attempts,scenario==='retryConnect'?3:1);
});
for(const scenario of ['noReboot','mismatch','lithium','nack','wrongToken','wrongOffset','wrongProtocol',
 'tooLong','empty','nonAscii','short','long','inconsistent','silent','disconnect','connectFail',
 'connectTimeout','serviceTimeout','notificationTimeout','writeTimeout','writeFail','lateConnect','wrongIdentity','otherCharacteristic'])
 test(`unverified and clean ${scenario}`,async()=>{
   const r=await run(scenario);assert.equal(r.result.status,'transferred-unverified');assert(r.result.reason);
   if(scenario==='noReboot')assert.equal(r.attempts,0);
   if(scenario.endsWith('Timeout')||scenario==='lateConnect')assert.equal(r.attempts,1,'hung operation must not start overlapping retries');
 });

test('standalone read verifies current firmware without an OTA or reboot',async()=>{
 const r=await run('success','read-only');
 assert.equal(r.result.status,'verified');assert.equal(r.result.runningVersion,target);
 assert.equal(r.writes.length,2);assert.equal(r.attempts,1);
});
for(const scenario of ['mismatch','lithium','silent','nack','connectTimeout','disconnect'])
 test(`standalone read fails closed: ${scenario}`,async()=>{
  const r=await run(scenario,'read-only');assert.equal(r.result.status,'transferred-unverified');
  if(scenario==='mismatch')assert.equal(r.result.runningVersion,'V12.2.33-PDO-FULL');
 });
test('unknown verification purpose never connects',async()=>{
 const r=await run('success','invalid');assert.equal(r.attempts,0);assert.equal(r.result.status,'transferred-unverified');
});
