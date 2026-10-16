const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=['fparOnNotify','fparWaitReply','fparCmd'].map(n=>html.match(new RegExp(`(?:async )?function ${n}\\([^]*?^}`,'m'))[0]).join('\n');
function harness(write){
 const c={Uint8Array,setTimeout,clearTimeout,FPAR:{waiter:null,device:{gatt:{connected:true,disconnect(){this.connected=false;}}}}};
 c.FPAR.char={writeValueWithResponse:async p=>write(c,p)};
 vm.createContext(c);vm.runInContext(source,c);return c;
}
function notify(c,bytes){const data=Uint8Array.from(bytes);c.fparOnNotify({target:{value:new DataView(data.buffer)}});}
(async()=>{
 let c=harness(async(c,p)=>{
  notify(c,[0xfc,3,0]);assert(c.FPAR.waiter,'wrong command must not consume waiter');
  notify(c,[0xfc,p[1],0,2,0,0,0,4]);
 });
 assert.equal((await c.fparCmd([0xfc,4,2,1,0],30))[3],2);assert.equal(c.FPAR.waiter,null);
 c=harness(async()=>{throw Error('write failure');});
 await assert.rejects(c.fparCmd([0xfc,2],30),/write failure/);
 assert.equal(c.FPAR.waiter,null);assert.equal(c.FPAR.char,null);assert(!c.FPAR.device.gatt.connected);
 c=harness(async()=>{});await assert.rejects(c.fparCmd([0xfc,4],10),/timeout/);
 assert.equal(c.FPAR.waiter,null);assert.equal(c.FPAR.char,null);assert(!c.FPAR.device.gatt.connected);
 notify(c,[0xfc,4,0,1,0,0,0,4]);assert.equal(c.FPAR.waiter,null,'late reply cannot be reused');
 c=harness(()=>new Promise(()=>{}));await assert.rejects(c.fparCmd([0xfc,4],10),/timeout/);
 assert.equal(c.FPAR.waiter,null,'unresolved write is bounded');
 c=harness(c=>{notify(c,[0xfc,4,0,1,0,0,0,4]);return new Promise(()=>{});});
 await assert.rejects(c.fparCmd([0xfc,4],10),/timeout/);
 c=harness(c=>{setTimeout(()=>c.FPAR.cancelCommand(),1);return new Promise(()=>{});});
 await assert.rejects(c.fparCmd([0xfc,4],100),/scollegato/);assert.equal(c.FPAR.waiter,null);
 c=harness(async()=>{});const pending=c.fparCmd([0xfc,4],10);
 await assert.rejects(c.fparCmd([0xfc,3],10),/già in corso/);await assert.rejects(pending,/timeout/);
 console.log('PASS FTD30 transport: notification correlation, timeout/write failure cleanup, no reuse, single outstanding command');
})().catch(e=>{console.error(e);process.exitCode=1;});
