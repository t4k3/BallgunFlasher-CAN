const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../fleet.html'),'utf8');
new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
const functions=['loadFleetParameterSet','fleetPrepareNodeParameters','fleetReadParameter','fleetPreflightNodes','fleetParametersOne'];
const extracted=functions.map(name=>html.match(new RegExp(`(?:async )?function ${name}\\([^]*?^}`,'m'))[0]).join('\n');
const source='let fleetParameterSet=null;\n'+extracted;
const prm=fs.readFileSync(require('node:path').join(__dirname,'../FTD30/waz_nodo2.prm'),'utf8');

async function run(fail){
 const calls=[],values=new Map();let notify;
 const key=(node,index)=>`${node}:${index}`;
 const replyRead=p=>{
   const node=p[2],index=p[3]|p[4]<<8;
   if((fail==='missing1'&&node===1&&index===1)||(fail==='missing2'&&node===2&&index===1))
     return [0xFC,4,1,0,0,0,0,0];
   let value;
   if(values.has(key(node,index))) value=values.get(key(node,index));
   else if(index===1) value=fail===`wrong${node}`?(node===1?2:1):node;
   else if(index===0x1218) value=fail===`moving${node}`?100:0;
   else if(index===0x4041) value=fail===`status${node}`?0x27:0x23;
   else if(index===0x1204||index===0x1205) value=fail===`alarm${node}`?5:0;
   else value=0;
   if(fail==='mismatch'&&node===1&&index===78) value=0;
   const width=fail==='zero-width'&&node===1&&index===78?0:4;
   value>>>=0;
   return [0xFC,4,0,value&255,(value>>>8)&255,(value>>>16)&255,value>>>24,width];
 };
 const chr={addEventListener:(t,f)=>notify=f,removeEventListener(){},startNotifications:async()=>{},
  writeValueWithResponse:async p=>{
   p=[...p];calls.push(p);let r;
   if(p[1]===1)r=[0xFC,1,fail==='old'?1:fail==='pdo'?0x9f:3];
   if(p[1]===2){
    if(fail==='unlock')r=[0xFC,2,0xE1];
    else {for(let j=0;j<p[3];j++){const o=4+j*6;values.set(key(p[2],p[o]|p[o+1]<<8),(p[o+2]|p[o+3]<<8|p[o+4]<<16|p[o+5]<<24)>>>0);}r=[0xFC,2,p[3],0,0,0];}
   }
   if(p[1]===4)r=replyRead(p);
   if(p[1]===3)r=[0xFC,3,0];
   notify({target:{value:new DataView(Uint8Array.from(r).buffer)}});
  }};
 const dev={name:'test',gatt:{connected:true,connect:async()=>({getPrimaryService:async()=>({getCharacteristic:async()=>chr})}),disconnect(){this.connected=false;}}};
 const c={Uint8Array,AbortController,URL,TextDecoder,crypto:require('node:crypto').webcrypto,OTA_SERVICE_UUID:'s',OTA_CHAR_UUID:'c',log(){},fetch:async()=>({ok:true,arrayBuffer:async()=>Uint8Array.from(Buffer.from(prm)).buffer}),
  setTimeout:(f,n)=>n===1200?setTimeout(f,0):setTimeout(f,n),clearTimeout};
 vm.createContext(c);vm.runInContext(source,c);
 let error;try{await c.fleetParametersOne(dev,()=>{});}catch(e){error=e;}
 const writes=calls.filter(p=>p[1]===2),saves=calls.filter(p=>p[1]===3);
 const expectedSuccess=!fail||fail==='pdo';
 if(expectedSuccess){
  assert(!error);assert.deepEqual(saves.map(p=>p[2]),[1,2]);
  assert(writes.some(p=>p[2]===1)&&writes.some(p=>p[2]===2));
  assert.equal(values.get(key(1,1)),1);assert.equal(values.get(key(2,1)),2);
  for(const node of [1,2]){assert(!values.has(key(node,994)));assert(!values.has(key(node,1012)));}
  assert.equal(calls.filter(p=>p[1]===4).length,10+1022*2);
 } else {
  assert(error);
  if(fail==='old')assert.equal(calls.length,1);
  if(/^(missing|wrong|moving|status|alarm)/.test(fail)){
   assert.equal(writes.length,0,`${fail}: pre-check must block every write`);
   assert.equal(saves.length,0,`${fail}: pre-check must block every SAVE`);
  }
  if(['unlock','mismatch','zero-width'].includes(fail))assert.equal(saves.length,0);
 }
 assert.equal(dev.gatt.connected,false);
}

(async()=>{
 for(const fail of [null,'old','pdo','missing1','missing2','wrong1','wrong2','moving1','moving2','status1','status2','alarm1','alarm2','unlock','mismatch','zero-width'])await run(fail);
 assert.match(html,/Parametri \(nodi 1 \+ 2\)/);
 console.log('Fleet parameters: strict two-node pre-check, dual restore, protected fields and no-SAVE failure gates passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
