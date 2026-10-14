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
 assert.equal(meta.firmware,'V12.1.9');assert.equal(sodium.version,meta.firmware);
 assert.equal(meta.internal_ota.profiles.lithium.version,meta.firmware+'-LI10S');
 for(const p of Object.values(meta.internal_ota.profiles)){
  checkImage(fs.readFileSync(path.join(root,p.path)),p);
  console.log(`LOCAL ${p.version}: ${p.size} bytes SHA256 ${p.sha256}`);
 }
 checkImage(fs.readFileSync(path.join(root,'STANDALONE/BallgunSTANDALONE.bin')),sodium);
 assert.match(fs.readFileSync(path.join(root,'index.html'),'utf8'),new RegExp('flasher-'+meta.flasher.replaceAll('.','\\.')));
 assert.match(fs.readFileSync(path.join(root,'fleet.html'),'utf8'),new RegExp('id="pageVer">v'+meta.fleet.replaceAll('.','\\.')));
 if(process.argv.includes('--live')){
  const base='https://t4k3.github.io/BallgunFlasher-CAN/';
  async function get(p){const r=await fetch(base+p+'?releaseCheck='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(30000)});assert(r.ok,`${p} HTTP ${r.status}`);return Buffer.from(await r.arrayBuffer());}
  assert.deepEqual(JSON.parse((await get('version.json')).toString()),meta,'Live catalog must match local release');
  for(const p of Object.values(meta.internal_ota.profiles))checkImage(await get(p.path),p);
  checkImage(await get('STANDALONE/BallgunSTANDALONE.bin'),sodium);
  for(const p of ['index.html','fleet.html'])assert.equal(hash(await get(p)),hash(fs.readFileSync(path.join(root,p))),`${p} deployment mismatch`);
  console.log(`LIVE VERIFIED: firmware ${meta.firmware}, Flasher ${meta.flasher}, Fleet ${meta.fleet}; both profiles and shared USB binary match.`);
 }
})().catch(e=>{console.error('RELEASE VERIFICATION FAILED:',e.message);process.exitCode=1;});
