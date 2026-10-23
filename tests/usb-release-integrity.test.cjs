const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
const {test}=require('node:test');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const config=JSON.parse(html.match(/STANDALONE: (\[[^]*?\]),/)[1]);
const source=html.match(/^async function flashFiles\([^]*?^}/m)[0];
async function run(corrupt){
 const events=[],logs=[];
 const ctx={Uint8Array,crypto:webcrypto,FIRMWARE_BASE:'https://fixture.invalid',log:s=>logs.push(s),
  devs:{standalone:{loader:{eraseFlash:async()=>events.push('erase'),writeFlash:async({fileArray})=>events.push(fileArray.map(f=>f.address)),hardReset:async()=>events.push('reset')}}},
  fetch:async url=>{const file=new URL(url).pathname.slice(1);const b=Buffer.from(fs.readFileSync(path.join(root,file)));if(corrupt&&file.endsWith(corrupt))b[b.length-1]^=1;return {ok:true,arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.length)};}};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return {ok:await ctx.flashFiles('standalone',config,'USB',null),events,logs};
}
test('USB internal release uses verified isolated files before erase',async()=>{
 assert(config.every(f=>f.file.startsWith('INTERNAL/USB/V12.2.50-PDO-FULL/')));
 const r=await run();assert.equal(r.ok,true);assert.equal(r.events[0],'erase');assert.deepEqual(Array.from(r.events[1]),[0,0x8000,0xe000,0x10000]);assert.equal(r.events[2],'reset');
});
for(const file of config.map(f=>path.basename(f.file)))test(`USB tampered ${file} blocks erase and all writes`,async()=>{
 const r=await run(file);assert.equal(r.ok,false);assert.deepEqual(r.events,[]);assert(r.logs.some(l=>l.includes('Integrità non valida')));
});
