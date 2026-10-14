const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../fleet.html'),'utf8');
new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
const loader=html.match(/async function loadFleetParameterSet\([^]*?^}/m)[0];
const source='let fleetParameterSet=null;\n'+loader+'\n'+html.match(/async function fleetParametersOne\([^]*?^}/m)[0];
const prm=fs.readFileSync(require('node:path').join(__dirname,'../FTD30/waz_nodo2.prm'),'utf8');
async function run(fail){
 const calls=[],values=new Map();let notify;
 const chr={addEventListener:(t,f)=>notify=f,removeEventListener(){},startNotifications:async()=>{},
  writeValueWithResponse:async p=>{
   calls.push([...p]);let r;
   if(p[1]===1)r=[0xFC,1,fail==='old'?1:3];
   if(p[1]===2){for(let j=0;j<p[3];j++){const o=4+j*6;values.set(p[o]|p[o+1]<<8,(p[o+2]|p[o+3]<<8|p[o+4]<<16|p[o+5]<<24)>>>0);}r=fail==='unlock'?[0xFC,2,0xE1]:[0xFC,2,p[3],0,0,0];}
   if(p[1]===4){const i=p[3]|p[4]<<8,v=fail==='mismatch'&&i===78?0:values.get(i);r=[0xFC,4,0,v&255,(v>>>8)&255,(v>>>16)&255,v>>>24,fail==='zero-width'?0:4];}
   if(p[1]===3)r=[0xFC,3,0];
   notify({target:{value:new DataView(Uint8Array.from(r).buffer)}});
  }};
 const dev={name:'test',gatt:{connected:true,connect:async()=>({getPrimaryService:async()=>({getCharacteristic:async()=>chr})}),disconnect(){this.connected=false;}}};
 const c={Uint8Array,AbortController,URL,TextDecoder,crypto:require('node:crypto').webcrypto,OTA_SERVICE_UUID:'s',OTA_CHAR_UUID:'c',log(){},fetch:async()=>({ok:true,arrayBuffer:async()=>Uint8Array.from(Buffer.from(prm)).buffer}),
  setTimeout:(f,n)=>n===1200?setTimeout(f,0):setTimeout(f,n),clearTimeout};
 vm.createContext(c);vm.runInContext(source,c);
 let error;try{await c.fleetParametersOne(dev,()=>{});}catch(e){error=e;}
 assert(calls.every(p=>p[1]===1||p[2]===1),'node 2 must not be touched');
 if(!fail){assert(!error);assert.equal(values.get(1),1);assert.equal(calls.filter(p=>p[1]===4).length,1024);assert.equal(calls.filter(p=>p[1]===3).length,1);}
 else {assert(error);assert.equal(calls.filter(p=>p[1]===3).length,0);}
 if(fail==='old')assert.equal(calls.length,1);
 assert.equal(dev.gatt.connected,false);
}
(async()=>{for(const fail of [null,'old','unlock','mismatch','zero-width'])await run(fail);console.log('Fleet parameters: success, old firmware, unlock failure, mismatch and zero-width gates passed');})().catch(e=>{console.error(e);process.exitCode=1;});
