// Exercises the page's real updater and event handler with an in-memory BLE link.
// No browser, device, network request or production database write is performed.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const customer = html.includes('async function nbleRunUpdate(onDetected)');
const helpers = html.slice(html.indexOf('// NEXTION TRANSFER:'), html.indexOf('// END NEXTION TRANSFER'));
assert.ok(helpers.includes('async function nbleReadUploadAck'));
const detector = customer ? html.slice(html.indexOf('function detectNextionModel('), html.indexOf('// Notify handler')) : '';
const start = html.indexOf('async function nbleRunUpdate(');
const end = customer ? html.indexOf('// =====================================================================\n// Avvio', start)
  : html.indexOf("document.getElementById('nbleConnectBtn').addEventListener", start);
const updater = html.slice(start, end);
const models = {
  square: { code: 'NX4827P043_011R', revision: 250, size: 799160, name: 'canBusSquare.tft', label: 'Square 4.3"' },
  circle: { code: 'NX4848E028_011C', revision: 177, size: 664248, name: 'canBusRounded.tft', label: 'Round 2.8"' },
  roundsmall: { code: 'NX4848E021_011C', revision: 250, size: 664740, name: 'canBusRoundedSmall.tft', label: 'Round 2.1"' },
};
function offsetFrame(offset) { return [8, offset & 255, (offset >>> 8) & 255, (offset >>> 16) & 255, (offset >>> 24) & 255]; }
async function run({ model = 'circle', final = '05', skip = model === 'circle' ? 524288 : 0, fragmented = false, size, intermediateMissing = false } = {}) {
  const info = { ...models[model], ...(size ? { size } : {}) };
  const data = Uint8Array.from({ length: info.size }, (_, i) => i % 251);
  let click, stage = 'connect', position = 0, clock = 0, chunks = 0, finalSeekSent = false;
  const logs = [], statuses = [], events = [], commands = [], pending = [], progress = [];
  const button = { disabled: false, addEventListener: (_, cb) => { click = cb; } };
  const state = { rxBuf: new Uint8Array(), device: { gatt: { connected: true } } };
  const append = bytes => { state.rxBuf = new Uint8Array([...state.rxBuf, ...bytes]); };
  function reply(bytes, partial = false) {
    if (partial) { append(bytes.slice(0, 2)); pending.push({ at: clock + 100, bytes: bytes.slice(2) }); }
    else append(bytes);
  }
  const context = {
    Uint8Array, TextEncoder, TextDecoder, Date: { now: () => clock },
    setTimeout: (cb, ms) => { clock += ms; cb(); },
    $: () => button, document: { getElementById: () => button },
    nble: state, NBLE_UART_BAUD: 115200, NBLE_CHUNK_SIZE: 4096, NBLE_ACK_TIMEOUT: 15000,
    NEXTION_TFTS: Object.fromEntries(Object.entries(models).map(([key, value]) => [key, { ...value, path: 'NEXTION/' + value.name }])),
    FIRMWARE_BASE: 'https://fixtures.invalid',
    log: text => logs.push(text), nbleHideProgress: () => {}, nbleSetProgress: value => progress.push(value),
    nbleSetStatus: (...args) => statuses.push(args), nbleConnect: async () => {},
    logEvent: async (type, details) => events.push({ type, details }),
    loadTftForModel: async key => { assert.equal(key, model); return { data, size: data.length, name: info.name, version: 'V8' }; },
    fetch: async url => { assert.ok(url.includes(info.name)); return { ok: true, arrayBuffer: async () => data.buffer }; },
    nbleSendCmd: async bytes => { commands.push(Array.from(bytes)); return new Uint8Array([254, bytes[1], 0]); },
    nbleWaitForByte: async byte => { assert.equal(state.rxBuf[0], byte); state.rxBuf = state.rxBuf.slice(1); },
    nbleWaitForData: async ms => {
      clock += ms;
      while (pending.length && pending[0].at <= clock) append(pending.shift().bytes);
    },
    nbleForwardRaw: async bytes => {
      const text = new TextDecoder().decode(bytes);
      if (text.startsWith('connect')) {
        append([...new TextEncoder().encode(`comok 2,630-0,${info.code},${info.revision},10201,TESTSERIAL,132644864-0`), 255, 255, 255]);
      } else if (text.startsWith('whmi-wris')) {
        assert.equal(text, `whmi-wris ${info.size},115200,${info.revision < 250 ? 0 : 1}`);
        stage = 'terminator';
      } else if (stage === 'terminator') {
        assert.deepEqual(Array.from(bytes), [255, 255, 255]); append([5]); stage = 'image';
      } else {
        assert.equal(stage, 'image');
        assert.deepEqual(Array.from(bytes), Array.from(data.slice(position, position + bytes.length)));
        position += bytes.length; chunks++;
        if (intermediateMissing && chunks === 2) return;
        if (final === 'seek_loop') { position = 1; reply(offsetFrame(1)); return; }
        if (chunks === 1 && skip) { position = skip; reply(offsetFrame(skip), fragmented); return; }
        if (position < data.length) { reply([5]); return; }
        switch (final) {
          case '05': reply([5]); break;
          case 'legacy_pattern': reply([5, 0, 0, 0, 255, 255, 255]); break;
          case '08_zero': reply(offsetFrame(0), fragmented); break;
          case '08_eof': reply(offsetFrame(data.length), fragmented); break;
          case 'delayed': pending.push({ at: clock + 5000, bytes: [5] }); break;
          case 'missing': break;
          case 'boot_only': reply([0, 0, 0, 255, 255, 255, 0x88, 255, 255, 255]); break;
          case 'partial_08': reply([8, 0, 0]); break;
          case 'disconnect': state.device.gatt.connected = false; break;
          case 'bad_offset': reply(offsetFrame(data.length + 1)); break;
          case 'seek_back':
            if (!finalSeekSent) { finalSeekSent = true; position = data.length - 100; reply(offsetFrame(position), fragmented); }
            else reply([5]);
            break;
          default: throw new Error(final);
        }
      }
    },
  };
  vm.createContext(context);
  vm.runInContext(helpers + '\n' + detector + '\n' + updater, context);
  if (customer) await click(); else await context.nbleRunUpdate(null);
  return { logs, statuses, events, commands, progress, chunks, position, clock, connected: state.device.gatt.connected };
}
function confirmed(result) {
  assert.ok(result.logs.some(text => text.includes('final block ACK received')));
  assert.ok(!result.logs.some(text => /no success|UNCONFIRMED|FAILED/.test(text)));
  assert.equal(result.progress.at(-1), 100);
  assert.ok(result.statuses.at(-1).some(value => typeof value === 'string' && /update received/i.test(value)));
  if (customer) {
    assert.equal(result.events.at(-1).type, 'nextion_completed');
    assert.equal(result.events.at(-1).details.meta.confirmation, 'display_block_ack');
  }
}
function unconfirmed(result) {
  assert.ok(!result.logs.some(text => text.includes('final block ACK received')));
  assert.ok(!result.progress.includes(100));
  assert.ok(result.logs.some(text => text.includes('UNCONFIRMED')));
  if (!result.connected) assert.ok(!result.commands.some(bytes => bytes[1] === 0));
  if (customer) {
    assert.equal(result.events.at(-1).type, 'nextion_failed');
    assert.equal(result.events.at(-1).details.meta.outcome, 'unconfirmed');
    assert.ok(!result.events.some(event => event.type === 'nextion_completed'));
  }
}
for (const model of Object.keys(models)) {
  for (const final of ['05', 'legacy_pattern', '08_zero']) {
    test(`${model}: ${final} confirms the final block`, async () => confirmed(await run({ model, final })));
  }
  test(`${model}: missing final ACK never completes or retries the image`, async () => {
    const result = await run({ model, final: 'missing' }); unconfirmed(result);
    const expected = model === 'circle' ? 36 : Math.ceil(models[model].size / 4096);
    assert.equal(result.chunks, expected);
    assert.ok(result.commands.some(bytes => bytes[1] === 0));
  });
}
test('2.8 screenshot transfer: 524288 seek and 36 chunks, fragmented offset', async () => {
  const result = await run({ fragmented: true }); confirmed(result); assert.equal(result.chunks, 36);
});
test('final ACK delayed five seconds is accepted', async () => confirmed(await run({ final: 'delayed' })));
test('final EOF offset is accepted', async () => confirmed(await run({ final: '08_eof', fragmented: true })));
test('final seek request is served before completion', async () => {
  const result = await run({ final: 'seek_back', fragmented: true }); confirmed(result); assert.equal(result.chunks, 37);
});
for (const final of ['boot_only', 'partial_08', 'disconnect']) {
  test(`${final} does not prove the final block was received`, async () => unconfirmed(await run({ final })));
}
test('missing intermediate ACK stops without sending another block', async () => {
  const result = await run({ intermediateMissing: true }); unconfirmed(result); assert.equal(result.chunks, 2);
});
for (const final of ['bad_offset', 'seek_loop']) {
  test(`${final} fails without reporting completion`, async () => {
    const result = await run({ final, skip: 0 });
    assert.ok(!result.progress.includes(100));
    assert.ok(!result.logs.some(text => text.includes('final block ACK received')));
    if (customer) assert.equal(result.events.at(-1).type, 'nextion_failed');
    if (final === 'seek_loop') assert.equal(result.chunks, 33);
  });
}
test('single-block image also requires the final ACK', async () => {
  confirmed(await run({ size: 100, skip: 0 }));
  unconfirmed(await run({ size: 100, skip: 0, final: 'missing' }));
});
