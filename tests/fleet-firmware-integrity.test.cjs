const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'fleet.html'),'utf8');
const source=html.match(/^function extractVersion\([^]*?^}/m)[0]+'\n'+html.match(/^async function downloadFirmware\([^]*?^}/m)[0];
const meta=JSON.parse(fs.readFileSync(path.join(root,'version.json'),'utf8'));
const image=fs.readFileSync(path.join(root,meta.internal_ota.profiles.sodium.path));
async function run(change){
 const catalog=structuredClone(meta),bytes=Buffer.from(image),elements={};let step=0;
 if(change==='old')catalog.firmware='V12.1.3';
 if(change==='hash')bytes[512]^=1;
 if(change==='chip')bytes[12]=0;
 if(change==='version')bytes.write('V12.1.8',48);
 const ctx={Uint8Array,DataView,TextDecoder,Date,crypto:crypto.webcrypto,firmwareBytes:new Uint8Array(1),firmwareVersion:'old',
  $:id=>elements[id]||=( {}),log(){},fetch:async()=>++step===1?{ok:true,json:async()=>catalog}:{ok:change!=='404',status:404,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length)}};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 if(change){await assert.rejects(ctx.downloadFirmware());assert.equal(ctx.firmwareBytes,null);assert.equal(ctx.firmwareVersion,null);}
 else {await ctx.downloadFirmware();assert.equal(ctx.firmwareVersion,'V12.2.51-PDO-FULL');assert.equal(Buffer.compare(Buffer.from(ctx.firmwareBytes),image),0);}
}
(async()=>{await run();for(const c of ['old','hash','chip','version','404'])await run(c);console.log('PASS Fleet integrity: matching release accepted; old catalog, wrong hash/chip/version and HTTP error blocked before OTA');})().catch(e=>{console.error(e);process.exitCode=1;});
