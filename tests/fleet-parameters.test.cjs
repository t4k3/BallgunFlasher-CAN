const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../fleet.html'),'utf8');
new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
const functions=['loadFleetParameterSet','fleetPrepareNodeParameters','fleetReadParameter','fleetReadIdentity','fleetPreflightNodes','fleetParametersOne'];
const extracted=functions.map(name=>html.match(new RegExp(`(?:async )?function ${name}\\([^]*?^}`,'m'))[0]).join('\n');
const source='let fleetParameterSet=null;\n'+extracted;
const prm=fs.readFileSync(require('node:path').join(__dirname,'../FTD30/waz_nodo2.prm'),'utf8');

async function run(fail){
 const calls=[],values=new Map(),readAttempts=new Map(),identityAttempts=new Map();let notify,staleSent=false;
 const key=(node,index)=>`${node}:${index}`;
 const replyRead=p=>{
   const node=p[2],index=p[3]|p[4]<<8;
   const readKey=key(node,index),attempt=(readAttempts.get(readKey)||0)+1;
   readAttempts.set(readKey,attempt);
   if(fail==='transient-rpm'&&node===1&&index===0x1218&&attempt<=2)
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
 const replyIdentity=p=>{
   const node=p[2],index=p[3]|p[4]<<8,sub=p[5],offset=p[6];
   const identityKey=`${node}:${index}:${sub}:${offset}`;
   const attempt=(identityAttempts.get(identityKey)||0)+1;
   identityAttempts.set(identityKey,attempt);
   if((fail==='identity-handover'&&node===1&&attempt<=2)||fail==='identity-never-idle')
    return [0xFC,5,0xEE];
   const echoedNode=fail===`wrong${node}`?(node===1?2:1):node;
   const status=(fail===`missing${node}`)?1:(fail==='identity-busy'&&node===1&&attempt<=2?5:0);
   const data=status===0?[0x78,0x56,0x34,0x12]:[];
   return [0xFC,5,status,echoedNode,index&255,index>>8,sub,data.length,offset,data.length,0,0,0,0,...data];
 };
 const chr={addEventListener:(t,f)=>notify=f,removeEventListener(){},startNotifications:async()=>{},
  writeValueWithResponse:async p=>{
   p=[...p];calls.push(p);let r;
   if(p[0]===0xAA&&p[1]===3)r=[0xAA,3,0];
   if(p[0]===0xFC&&p[1]===1)r=[0xFC,1,fail==='stuck-idle'?0xEE:fail==='old'?1:fail==='pdo'?0x9f:7];
   if(p[0]===0xFC&&p[1]===2){
    if(fail==='unlock')r=[0xFC,2,0xE1];
    else {for(let j=0;j<p[3];j++){const o=4+j*6;values.set(key(p[2],p[o]|p[o+1]<<8),(p[o+2]|p[o+3]<<8|p[o+4]<<16|p[o+5]<<24)>>>0);}r=[0xFC,2,p[3],0,0,0];}
   }
   if(p[0]===0xFC&&p[1]===5)r=replyIdentity(p);
   if(p[0]===0xFC&&p[1]===4)r=replyRead(p);
   if(p[0]===0xFC&&p[1]===3)r=[0xFC,3,0];
   if(fail==='stale-command'&&p[0]===0xFC&&p[1]===4&&!staleSent){
    staleSent=true;
    notify({target:{value:new DataView(Uint8Array.from([0xFC,1,7]).buffer)}});
    setTimeout(()=>notify({target:{value:new DataView(Uint8Array.from(r).buffer)}}),0);
    return;
   }
   notify({target:{value:new DataView(Uint8Array.from(r).buffer)}});
  }};
 const dev={name:'test',gatt:{connected:true,connect:async()=>({getPrimaryService:async()=>({getCharacteristic:async()=>chr})}),disconnect(){this.connected=false;}}};
 const c={Uint8Array,AbortController,URL,TextDecoder,crypto:require('node:crypto').webcrypto,OTA_SERVICE_UUID:'s',OTA_CHAR_UUID:'c',log(){},fetch:async()=>({ok:true,arrayBuffer:async()=>Uint8Array.from(Buffer.from(prm)).buffer}),
  setTimeout:(f,n)=>[1200,750,350].includes(n)?setTimeout(f,0):setTimeout(f,n),clearTimeout};
 vm.createContext(c);vm.runInContext(source,c);
 let error;try{await c.fleetParametersOne(dev,()=>{});}catch(e){error=e;}
 const writes=calls.filter(p=>p[0]===0xFC&&p[1]===2),saves=calls.filter(p=>p[0]===0xFC&&p[1]===3);
 const expectedSuccess=!fail||['pdo','transient-rpm','identity-busy','identity-handover','stale-command'].includes(fail);
 if(expectedSuccess){
  assert(!error,`${fail || 'success'}: ${error?.message || error}`);assert.deepEqual(saves.map(p=>p[2]),[1,2]);
  assert(writes.some(p=>p[2]===1)&&writes.some(p=>p[2]===2));
  assert.equal(values.get(key(1,1)),1);assert.equal(values.get(key(2,1)),2);
  for(const node of [1,2]){assert(!values.has(key(node,994)));assert(!values.has(key(node,1012)));}
  assert.equal(calls.filter(p=>p[0]===0xFC&&p[1]===5).length,2+(['identity-busy','identity-handover'].includes(fail)?2:0));
  assert.equal(calls.filter(p=>p[0]===0xFC&&p[1]===4).length,8+1022*2+(fail==='transient-rpm'?2:0));
 } else {
  assert(error);
   if(fail==='old')assert.equal(calls.length,2);
   if(fail==='stuck-idle')assert.equal(calls.filter(p=>p[0]===0xFC&&p[1]===1).length,12);
   if(fail==='identity-never-idle')assert.equal(calls.filter(p=>p[0]===0xFC&&p[1]===5).length,12);
  if(/^(missing|wrong|moving|status|alarm)/.test(fail)){
   assert.equal(writes.length,0,`${fail}: pre-check must block every write`);
   assert.equal(saves.length,0,`${fail}: pre-check must block every SAVE`);
  }
  if(['unlock','mismatch','zero-width'].includes(fail))assert.equal(saves.length,0);
 }
 assert.equal(dev.gatt.connected,false);
}

(async()=>{
 for(const fail of [null,'old','pdo','stuck-idle','transient-rpm','identity-busy','identity-handover','identity-never-idle','stale-command','missing1','missing2','wrong1','wrong2','moving1','moving2','status1','status2','alarm1','alarm2','unlock','mismatch','zero-width'])await run(fail);
 assert.match(html,/Parametri \(nodi 1 \+ 2\)/);
 console.log('Fleet parameters: identity-based two-node pre-check, dual restore, protected fields and no-SAVE failure gates passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
