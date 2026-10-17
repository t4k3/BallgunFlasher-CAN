'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const extract=name=>html.match(new RegExp('^async function '+name+'\\([^]*?^}', 'm'))[0];
function fixture(){
 let now=0, pending;
 const c={Uint8Array,DataView,Number,Error,performance:{now:()=>now},
  nextionRxBuffer:new Uint8Array(),setTimeout:fn=>{now+=20;if(pending){const f=pending;pending=null;f();}fn();}};
 vm.createContext(c);vm.runInContext(['nextionReadUploadFrame','nextionTransferTft'].map(extract).join('\n'),c);
 return {c,later:fn=>{pending=fn;},append:bytes=>{c.nextionRxBuffer=new Uint8Array([...c.nextionRxBuffer,...bytes]);}};
}
const data=Uint8Array.from({length:5000},(_,i)=>i%251);
(async()=>{
 // ACK can arrive before writer.write resolves, including after the final block.
 let f=fixture(),sent=[],reads=0;
 const result=await f.c.nextionTransferTft(data,async b=>{sent.push(b);f.append([5]);},
  async()=>{reads++;return f.c.nextionReadUploadFrame();},()=>{});
 assert.equal(result.chunks,2);assert.equal(reads,2);
 assert.deepEqual(Buffer.concat(sent.map(Buffer.from)),Buffer.from(data));
 // The final block may request a backward seek, not completion.
 f=fixture();sent=[];reads=0;
 await f.c.nextionTransferTft(data,async b=>sent.push(b),async()=>{
  reads++;return reads===2?{code:8,offset:4096}:{code:5};
 },()=>{});
 assert.equal(reads,3);assert.deepEqual(sent[2],data.slice(4096));
 // Fragmented 08 frame consumes exactly five bytes, preserving a subsequent ACK.
 for(let split=1;split<5;split++){
  f=fixture();const frame=[8,0,16,0,0];f.append(frame.slice(0,split));
  f.later(()=>f.append([...frame.slice(split),5]));
  const frameResult=await f.c.nextionReadUploadFrame();assert.equal(frameResult.offset,4096);
  assert.equal((await f.c.nextionReadUploadFrame()).code,5);
 }
 for(const offset of [-1,5001,0xFFFFFFFF,1.5]){
  f=fixture();await assert.rejects(f.c.nextionTransferTft(data,async()=>{},async()=>({code:8,offset}),()=>{}),/outside image/);
 }
 // Zero offset means continue, not rewind. Exact EOF offset is permitted.
 for(const offset of [0,data.length]){
  f=fixture();reads=0;
  await f.c.nextionTransferTft(data,async()=>{},async()=>{reads++;return {code:8,offset};},()=>{});
  assert.equal(reads,offset===0?2:1);
 }
 f=fixture();reads=0;
 await assert.rejects(f.c.nextionTransferTft(data,async()=>{},async()=>{
  if(++reads===1)return {code:5};return f.c.nextionReadUploadFrame(40);
 },()=>{}),/ACK timeout/);assert.equal(reads,2);
 f=fixture();await assert.rejects(f.c.nextionTransferTft(data,async()=>{},async()=>({code:8,offset:1}),()=>{}),/repeated seeks/);
 for(const code of [0x09,0x1a,0x1d,0xff]){
  f=fixture();f.append([code]);await assert.rejects(f.c.nextionReadUploadFrame(),/upload error/);
 }
 const upload=extract('nextionUpdate');
 assert.match(upload,/nextionRxBuffer = new Uint8Array\(0\);\s*await nextionSendCmd\(uploadCmd\)/);
 assert.match(upload,/await nextionTransferTft\(fileData/);
 assert.doesNotMatch(upload,/while \(filePos < fileSize\)/);
 assert.match(upload,/throw new Error\(`Nextion rejected image/);
 assert.match(upload,/Transfer confirmed; verify the running display/);
 console.log('PASS actual USB Nextion host transfer: early/final ACK, fragmented seeks, final rewind, bounds, timeout, bounded retries and raw image fidelity; no hardware claim');
})().catch(e=>{console.error(e);process.exitCode=1;});
