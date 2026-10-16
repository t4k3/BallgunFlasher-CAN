const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/mg, '');
new vm.Script(script);
const names = ['fparParsePrm', 'fparPrep', 'fparRestoreNode', 'fparVerifyAll', 'fparRestoreAll'];
const source = names.map(name => {
  const match = script.match(new RegExp(`(?:async )?function ${name}\\([^]*?^}`, 'm'));
  assert(match, name);
  return match[0];
}).join('\n');
const controls = {};
const calls = [];
const ctx = {
  FPAR: {busy: false, char: {}, set: null}, FPAR_BATCH: 24,
  FQ: id => controls[id] || (controls[id] = {}),
  fparStatus(){}, fparProgress(){}, log(){},
  fparInvalidateVerification(){},
  fparReadParam: async n => n,
  fparVerifyNode: async () => true,
};
vm.createContext(ctx);
vm.runInContext(source, ctx);
const text = fs.readFileSync(path.join(root, 'FTD30/waz_nodo2.prm'), 'utf8');
const set = ctx.fparParsePrm(text);
assert.equal(set.length, 1024);
const prepared = ctx.fparPrep(set, 1);
assert.equal(prepared.find(p => p.index === 1).value, 1);
assert.equal(set.find(p => p.index === 1).value, 2);
assert.equal(prepared.filter((p,i) => p.value !== set[i].value).length, 1);
assert.throws(() => ctx.fparParsePrm(text.replace(/21,\s*0,/, '21,1,')), /P21/);
assert.throws(() => ctx.fparParsePrm('[Drive]\n1,2,x'), /1024/);

(async () => {
  const stored = new Map(prepared.map(p => [p.index, p.value]));
  ctx.FPAR.set = set;
  ctx.fparCmd = async pkt => {
    calls.push(pkt);
    if (pkt[1] === 1) return [0xFC,1,3];
    assert.equal(pkt[2], 1, 'no commands writing/reading configuration on node 2');
    if (pkt[1] === 2) return [0xFC,2,pkt[3],0,0,0];
    if (pkt[1] === 3) return [0xFC,3,0];
    const idx = pkt[3] | pkt[4]<<8, v = stored.get(idx) >>> 0;
    return [0xFC,4,0,v&255,(v>>>8)&255,(v>>>16)&255,v>>>24,4];
  };
  await ctx.fparRestoreAll();
  assert.equal(calls.filter(p => p[1] === 4).length, 1022);
  for(const p of calls.filter(p=>p[1]===2))for(let o=4;o<p.length;o+=6)assert(![994,1012].includes(p[o]|p[o+1]<<8));
  assert.equal(calls.filter(p => p[1] === 3).length, 1);
  const saveAt = calls.findIndex(p => p[1] === 3);
  assert.equal(calls.slice(0,saveAt).filter(p => p[1] === 4).length, 1022);

  calls.length = 0;
  stored.set(78,0);
  await ctx.fparRestoreAll();
  assert.equal(calls.filter(p => p[1] === 3).length, 0, 'no SAVE on mismatch');

  calls.length = 0;
  ctx.fparCmd = async pkt => {calls.push(pkt); return pkt[1] === 1 ? [0xFC,1,3] : [0xFC,2,0xE1];};
  await ctx.fparRestoreAll();
  assert.equal(calls.filter(p => p[1] === 3).length,0, 'no SAVE on unlock failure');
  assert.equal(calls.filter(p => p[1] === 2).length,1, 'stop at first failed batch');

  calls.length=0;
  ctx.fparCmd = async pkt => {calls.push(pkt); return [0xFC,1,1];};
  await ctx.fparRestoreAll();
  assert.equal(calls.length,1, 'old firmware refused before any writes');
  assert.equal(ctx.FPAR.busy,false);
  console.log('FTD30 repair tests passed: parser, P1-only override, node2 untouched, full verification, failure gates');
})().catch(e => {console.error(e);process.exitCode=1;});
