const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const names=['fparReadIdentity','fparFormatIdentity','fparLogIdentities','fparOnNotify','fparReadDiagnostic'];
const source=names.map(n=>html.match(new RegExp(`(?:async )?function ${n}\\([^]*?^}`,'m'))[0]).join('\n');
const logs=[],calls=[];
const ctx={FPAR:{},Uint8Array,DataView,TextDecoder,log:s=>logs.push(s)};
vm.createContext(ctx);vm.runInContext(source,ctx);
const packet=(req,data,status=0,abort=0)=>{
 const off=req[6],part=data.slice(off,off+6);
 return Uint8Array.from([0xfc,5,status,req[2],req[3],req[4],req[5],data.length,off,part.length,
  abort&255,abort>>>8&255,abort>>>16&255,abort>>>24,...part]);
};
(async()=>{
 for(const size of [0,1,4,6,7,10,63,64]){
  calls.length=0;const data=Uint8Array.from({length:size},(_,i)=>i);
  ctx.fparCmd=async p=>{calls.push(p);return packet(p,data);};
  const r=await ctx.fparReadIdentity(1,0x100a,0);assert.deepEqual(Array.from(r.data),Array.from(data));
  assert(calls.every(p=>p[1]===5));assert.equal(ctx.FPAR.identityExpected,null);
 }
 for(const [status,msg] of [[1,'TIMEOUT CAN'],[2,'NON SUPPORTATO'],[3,'NON VALIDA'],[4,'64 BYTE'],[5,'NON PRONTO'],[6,'INVIO CAN']]){
  ctx.fparCmd=async p=>packet(p,[],status,0x06020000);
  assert.match((await ctx.fparReadIdentity(2,0x100a,0)).error,new RegExp(msg));
 }
 ctx.fparCmd=async()=>[0xfc,5,0xee];assert.match((await ctx.fparReadIdentity(1,0x100a,0)).error,/MOTORI/);
 ctx.fparCmd=async()=>{throw Error('disconnected');};assert.match((await ctx.fparReadIdentity(1,0x100a,0)).error,/BLE/);
 for(const mutate of [r=>r[3]=2,r=>r[6]=1,r=>r[8]=6,r=>r[7]=65,r=>r[9]=7]){
  ctx.fparCmd=async p=>{const r=packet(p,[1,2,3,4]);mutate(r);return r;};
  assert((await ctx.fparReadIdentity(1,0x100a,0)).error);
 }
 assert.match(ctx.fparFormatIdentity({data:Uint8Array.from([255,255,255,255])},false),/4294967295/);
 assert.match(ctx.fparFormatIdentity({data:new TextEncoder().encode('FF.00\0')},true),/segnaposto/);
 assert.match(ctx.fparFormatIdentity({data:Uint8Array.from([1,2])},false),/INATTESO/);
 // A DataView can point inside a larger buffer; ignore old node/offset replies.
 let received=null;ctx.FPAR.identityExpected={node:1,index:0x100a,sub:0,offset:0};ctx.FPAR.waiter=r=>received=r;
 const r=packet([0xfc,5,1,10,16,0,0],[1,2]);const storage=new Uint8Array(50);storage.set(r,5);
 storage[8]=2;ctx.fparOnNotify({target:{value:new DataView(storage.buffer,5,r.length)}});assert.equal(received,null);
 storage[8]=1;ctx.fparOnNotify({target:{value:new DataView(storage.buffer,5,r.length)}});assert.equal(received.length,16);
 // Older firmware: no FC05 request; numeric version still read before optional identity.
 ctx.fparCmd=async p=>{assert.equal(p[1],1);return [0xfc,1,3];};await ctx.fparLogIdentities();assert.match(logs.at(-1),/12.1.8/);
 ctx.FPAR={busy:false,char:{}};ctx.FQ=()=>({});ctx.fparStatus=()=>{};
 const ods=[];ctx.fparReadParam=async(n,i)=>{ods.push([n,i+0x2000]);return i+0x2000===0x323c?0x0308:0;};
 await ctx.fparReadDiagnostic();assert.deepEqual(ods.slice(0,2),[[1,0x323c],[2,0x323c]]);
 assert(logs.some(s=>/UP=3.8.*DOWN=3.8/.test(s)));
 console.log('PASS identity web: MTU23 paging, errors, offsets, placeholder, old firmware and actual read-only diagnostic');
})().catch(e=>{console.error(e);process.exitCode=1;});
