const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const path=require('node:path'),crypto=require('node:crypto').webcrypto;
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'fleet.html'),'utf8');
const source='let fleetParameterSet=null;\n'+html.match(/async function loadFleetParameterSet\([^]*?^}/m)[0];
const file=fs.readFileSync(path.join(root,'FTD30/waz_nodo2.prm'));
async function run(kind){
 let calls=0;
 const ctx={Uint8Array,URL,TextDecoder,AbortController,crypto,log(){},
  setTimeout:(fn,ms)=>setTimeout(fn,ms===1500?0:ms),clearTimeout,
  fetch:async()=>{
   calls++;
   const ok=kind!=='404' && (kind!=='transient'||calls>1);
   const bytes=kind==='wrong-set'?Buffer.from('other set'):file;
   return {ok,status:ok?200:404,arrayBuffer:async()=>Uint8Array.from(bytes).buffer};
  }
 };
 vm.createContext(ctx);vm.runInContext(source,ctx);
 if(kind==='404'||kind==='wrong-set'){
  await assert.rejects(ctx.loadFleetParameterSet(),kind==='404'?/HTTP 404/:/SHA-256/);
  assert.equal(calls,kind==='404'?3:1);
 }else{
  const first=await ctx.loadFleetParameterSet();
  assert.equal(first.length,1024);assert.equal(first.find(p=>p.index===1).value,1);
  assert(Object.isFrozen(first)&&Object.isFrozen(first[0]));
  const second=await ctx.loadFleetParameterSet();assert.equal(first,second);
  assert.equal(calls,kind==='transient'?2:1,'reuse validated set without another download');
 }
}
(async()=>{for(const kind of ['ok','transient','404','wrong-set'])await run(kind);console.log('Fleet parameter download: pinned hash, bounded retries, immutable session cache passed');})().catch(e=>{console.error(e);process.exitCode=1;});
