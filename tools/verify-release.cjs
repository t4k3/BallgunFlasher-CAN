// Read-only release gate. Use --live after GitHub Pages deployment.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const meta=JSON.parse(fs.readFileSync(path.join(root,'version.json'),'utf8'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function checkImage(b,p){
 assert.equal(b[0],0xE9);assert.equal(b.readUInt16LE(12),13,'ESP32-C6 chip');
 assert.equal(b.readUInt32LE(32),0xABCD5432,'ESP app descriptor');
 assert.equal(b.subarray(48,80).toString().split('\0')[0],p.version);
 assert.equal(b.subarray(80,112).toString().split('\0')[0],'BallgunSTANDALONE');
 assert.equal(b.length,p.size);assert.equal(hash(b),p.sha256);
}
(async()=>{
 const sodium=meta.internal_ota.profiles.sodium;
 assert.equal(meta.firmware,'V12.2.51-PDO-FULL');assert.equal(sodium.version,meta.firmware);
 assert.equal(meta.internal_ota.profiles.lithium.version,'V12.2.28-LI10S-PDO-FULL');
 assert.equal(meta.recovery_ota.source_version,'V12.2.34-PDO-FULL');
 assert.equal(meta.recovery_ota.version,'V12.2.49-PDO-FULL');
 assert.equal(meta.shared_firmware.version,'V12.2.50-PDO-FULL');
 assert.equal(meta.shared_firmware.sha256,'ac8240e0a89ec46f025bf1ca9e4dfa963cf596c96d2511b71a6b43c816c8734a');
 for(const p of Object.values(meta.internal_ota.profiles)){
  checkImage(fs.readFileSync(path.join(root,p.path)),p);
  console.log(`LOCAL ${p.version}: ${p.size} bytes SHA256 ${p.sha256}`);
 }
 checkImage(fs.readFileSync(path.join(root,meta.recovery_ota.path)),meta.recovery_ota);
 checkImage(fs.readFileSync(path.join(root,meta.shared_firmware.path)),meta.shared_firmware);
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const usb=JSON.parse(html.match(/STANDALONE: (\[[^]*?\]),/)[1]);
 assert.deepEqual(usb,meta.internal_usb.files.map(f=>({offset:f.offset,file:f.path,size:f.size,sha256:f.sha256})));
 for(const f of meta.internal_usb.files){
  const b=fs.readFileSync(path.join(root,f.path));assert.equal(b.length,f.size);assert.equal(hash(b),f.sha256);
  if(f.offset===0x10000)checkImage(b,{version:meta.internal_usb.version,size:f.size,sha256:f.sha256});
 }
 const prm=fs.readFileSync(path.join(root,'FTD30/waz_nodo2.prm'));
 assert.equal(hash(prm),'725fc26d36910d6a7e28923003bb234d26189f6957ee7a70bd5a8fcde4e88fa2','Canonical FTD30 set changed');
 assert.match(fs.readFileSync(path.join(root,'index.html'),'utf8'),new RegExp('flasher-'+meta.flasher.replaceAll('.','\\.')));
 assert.match(fs.readFileSync(path.join(root,'fleet.html'),'utf8'),new RegExp('id="pageVer">v'+meta.fleet.replaceAll('.','\\.')));
 if(process.argv.includes('--live')){
  const base='https://t4k3.github.io/BallgunFlasher-CAN/';
  async function get(p){const r=await fetch(base+p+'?releaseCheck='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(30000)});assert(r.ok,`${p} HTTP ${r.status}`);return Buffer.from(await r.arrayBuffer());}
  assert.deepEqual(JSON.parse((await get('version.json')).toString()),meta,'Live catalog must match local release');
  assert.equal(hash(await get('FTD30/waz_nodo2.prm')),hash(prm),'Live parameter set mismatch');
  for(const p of Object.values(meta.internal_ota.profiles))checkImage(await get(p.path),p);
  checkImage(await get(meta.recovery_ota.path),meta.recovery_ota);
  checkImage(await get(meta.shared_firmware.path),meta.shared_firmware);
  for(const f of meta.internal_usb.files){const b=await get(f.path);assert.equal(b.length,f.size);assert.equal(hash(b),f.sha256);}
  for(const p of ['index.html','fleet.html'])assert.equal(hash(await get(p)),hash(fs.readFileSync(path.join(root,p))),`${p} deployment mismatch`);
  console.log(`LIVE VERIFIED: firmware ${meta.firmware}, Flasher ${meta.flasher}, Fleet ${meta.fleet}; both OTA profiles and isolated USB files match; customer shared binary is ${meta.shared_firmware.version}.`);
 }
})().catch(e=>{console.error('RELEASE VERIFICATION FAILED:',e.message);process.exitCode=1;});
