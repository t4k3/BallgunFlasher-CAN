const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 for(const [file,prefix] of [['index.html','nble'],['fleet.html','fnble']]){
  const html=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
  const source=html.match(new RegExp('^async function '+prefix+'ForwardRaw\\([^]*?^}', 'm'))[0];
  const writes=[];
  const ctx={NBLE_BLE_WRITE:180,Uint8Array,Promise,setTimeout:fn=>fn(),[prefix+'Write']:async b=>writes.push(Uint8Array.from(b))};
  vm.createContext(ctx);vm.runInContext(source,ctx);
  for(const size of [1,2,3,6,7,180,181,360,4096])for(const cmd of [0,3,4,7,15,254,255]){
   const bytes=new Uint8Array(size).fill(254);bytes[size-1]=cmd;
   writes.length=0;await ctx[prefix+'ForwardRaw'](bytes);
   for(const w of writes)assert(w.length===1||w[0]!==254,`${file}: unescaped FE prefix`);
   assert.deepEqual(Buffer.concat(writes.map(b=>Buffer.from(b))),Buffer.from(bytes));
  }
  console.log(`PASS ${file}: repeated FE prefixes and command-sized tails preserve every byte without command collisions`);
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
