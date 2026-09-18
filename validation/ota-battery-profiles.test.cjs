// Real page selection/validation code, real release images, in-memory BLE.
// No radio connection, flashing or production events.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const code = html.slice(html.indexOf('// OTA BATTERY PROFILES:'), html.indexOf('// END OTA BATTERY PROFILES'));
const metadata = JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8'));
const catalog = metadata.internal_ota.profiles;
function image(key) {
    return Uint8Array.from(fs.readFileSync(path.join(root, catalog[key].path))).buffer;
}
function harness({ restored = 'lithium', fetchResult, connectResult = true, connectHook } = {}) {
    const elements = Object.fromEntries(['otaBatteryProfile', 'otaFile', 'otaFileLabel', 'otaVersion', 'otaProfileInfo', 'otaConnectBtn']
        .map(id => [id, { value: '', textContent: '', disabled: false, listeners: {}, attributes: {},
            addEventListener(event, fn) { this.listeners[event] = fn; },
            setAttribute(name, value) { this.attributes[name] = value; } }]));
    elements.otaBatteryProfile.value = restored;
    const state = { events: {}, requests: [], transfers: [], logs: [], connections: 0, disconnects: 0 };
    const gatt = { connected: false, disconnect() { this.connected = false; state.disconnects++; } };
    const context = vm.createContext({
        Uint8Array, ArrayBuffer, DataView, TextDecoder, crypto: webcrypto,
        document: { getElementById: id => elements[id] },
        window: { addEventListener: (event, fn) => { state.events[event] = fn; } },
        FIRMWARE_BASE: 'https://fixtures.invalid', ota: { device: { gatt } },
        log: line => state.logs.push(line),
        otaConnect: async () => {
            state.connections++;
            if (connectHook) await connectHook(elements);
            gatt.connected = connectResult; return connectResult;
        },
        otaRunUpdate: async data => { state.transfers.push(data); },
        fetch: async (url, options) => {
            state.requests.push(url); assert.equal(options.cache, 'no-store');
            if (fetchResult) return fetchResult(url);
            const profile = Object.entries(catalog).find(([, p]) => url.includes('/' + p.path + '?'));
            assert.ok(profile, `Unexpected URL ${url}`);
            return { ok: true, arrayBuffer: async () => image(profile[0]) };
        }
    });
    vm.runInContext(code, context);
    const select = value => { elements.otaBatteryProfile.value = value; elements.otaBatteryProfile.listeners.change(); };
    const custom = data => elements.otaFile.listeners.change({ target: { files: [{ name: 'selected.bin', arrayBuffer: async () => data }] } });
    return { elements, state, select, custom, click: () => elements.otaConnectBtn.listeners.click(),
        load: key => context.otaLoadSelection({ profile: catalog[key] }) };
}
test('page and metadata versions agree; standard shared firmware is unchanged', () => {
    assert.ok(html.includes(`flasher-${metadata.flasher}`));
    assert.equal(metadata.flasher, '1.5.21');
    assert.equal(metadata.firmware, 'V12.1.1');
    assert.equal(metadata.internal_ota.default, 'sodium');
    assert.equal(catalog.sodium.version, 'V12.1.2');
    assert.equal(catalog.lithium.version, 'V12.1.2-LI10S');
    const shared = fs.readFileSync(path.join(root, 'STANDALONE/BallgunSTANDALONE.bin'));
    assert.equal(shared.subarray(48,80).toString().split('\0')[0], 'V12.1.1');
});
test('always starts with sodium even when the browser restores lithium', () => {
    const h = harness();
    assert.equal(h.elements.otaBatteryProfile.value, 'sodium');
    assert.equal(h.elements.otaVersion.textContent, 'V12.1.2');
    assert.match(h.elements.otaProfileInfo.textContent, /Sodio/);
    h.select('lithium');
    assert.equal(h.elements.otaVersion.textContent, 'V12.1.2-LI10S');
    h.state.events.pageshow({ persisted: true });
    assert.equal(h.elements.otaBatteryProfile.value, 'sodium');
});
for (const key of Object.keys(catalog)) {
    test(`${key}: real descriptor/hash validated and correct bytes reach OTA`, async () => {
        const h = harness(); h.select(key); await h.click();
        assert.equal(h.state.transfers.length, 1);
        assert.deepEqual(new Uint8Array(h.state.transfers[0]), new Uint8Array(image(key)));
        assert.equal(h.elements.otaVersion.textContent, catalog[key].version);
        assert.ok(h.state.requests[0].includes(catalog[key].path));
        assert.ok(h.state.logs.some(line => line.includes(catalog[key].label) && line.includes(catalog[key].version)));
        assert.equal(h.state.disconnects, 0, 'do not interrupt ESP image verification after transfer');
        assert.equal(h.elements.otaConnectBtn.disabled, false);
        assert.equal(h.elements.otaBatteryProfile.disabled, false);
    });
}
test('choosing a named profile clears a previously selected custom image', async () => {
    const h = harness(); h.custom(image('lithium'));
    assert.equal(h.elements.otaBatteryProfile.value, 'custom');
    assert.equal(h.elements.otaVersion.textContent, 'Personalizzato');
    h.select('sodium'); await h.click();
    assert.equal(h.state.requests.length, 1);
    assert.deepEqual(new Uint8Array(h.state.transfers[0]), new Uint8Array(image('sodium')));
    assert.equal(h.elements.otaFileLabel.textContent, '…or pick custom .bin');
});
test('custom selection is explicit and never silently downloads a named profile', async () => {
    const h = harness(); h.custom(image('lithium')); await h.click();
    assert.equal(h.state.requests.length, 0);
    assert.equal(h.state.transfers.length, 1);
    assert.match(h.elements.otaProfileInfo.textContent, /File personalizzato/);
    assert.equal(h.elements.otaVersion.textContent, 'V12.1.2-LI10S');
});
test('wrong profile bytes never enter OTA and have no fallback to standard', async () => {
    const h = harness({ fetchResult: () => ({ ok: true, arrayBuffer: async () => image('lithium') }) });
    await h.click();
    assert.equal(h.state.transfers.length, 0);
    assert.equal(h.state.requests.length, 1);
    assert.equal(h.state.disconnects, 1);
    assert.ok(h.state.logs.some(line => line.includes('non corrisponde')));
});
test('same-version modified payload is rejected by hash before OTA', async () => {
    const altered = new Uint8Array(image('sodium')); altered[512] ^= 1;
    const h = harness({ fetchResult: () => ({ ok: true, arrayBuffer: async () => altered.buffer }) });
    await h.click();
    assert.equal(h.state.transfers.length, 0);
    assert.ok(h.state.logs.some(line => line.includes('SHA-256 fallita')));
});
test('404 cannot fall back to the other battery or shared firmware', async () => {
    const h = harness({ fetchResult: () => ({ ok: false, status: 404 }) });
    h.select('lithium'); await h.click();
    assert.equal(h.state.requests.length, 1);
    assert.equal(h.state.transfers.length, 0);
    assert.equal(h.elements.otaBatteryProfile.disabled, false);
    assert.ok(h.state.logs.some(line => line.includes('HTTP 404')));
});
test('invalid custom chip or truncated image never reaches OTA', async () => {
    const wrongChip = new Uint8Array(image('sodium')); wrongChip[12] = 0;
    for (const data of [new ArrayBuffer(5), wrongChip.buffer]) {
        const h = harness(); h.custom(data); await h.click();
        assert.equal(h.state.transfers.length, 0);
        assert.ok(h.state.logs.some(line => line.includes('non valido per ESP32-C6')));
    }
});
test('connection cancellation makes no download or transfer', async () => {
    const h = harness({ connectResult: false }); await h.click();
    assert.equal(h.state.requests.length, 0); assert.equal(h.state.transfers.length, 0);
    assert.equal(h.elements.otaFile.disabled, false);
});
test('selection is captured and controls locked before Bluetooth chooser; duplicate clicks ignored', async () => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const h = harness({ connectHook: async elements => {
        assert.equal(elements.otaBatteryProfile.disabled, true);
        assert.equal(elements.otaFile.disabled, true);
        assert.equal(elements.otaConnectBtn.disabled, true);
        assert.equal(elements.otaFileLabel.attributes['aria-disabled'], 'true');
        await gate;
    } });
    h.select('lithium'); const pending = h.click();
    await h.click(); assert.equal(h.state.connections, 1);
    h.state.events.pageshow({ persisted: true });
    assert.equal(h.elements.otaBatteryProfile.value, 'lithium');
    release(); await pending;
    assert.deepEqual(new Uint8Array(h.state.transfers[0]), new Uint8Array(image('lithium')));
});
test('invalid selection makes no connection', async () => {
    const h = harness(); h.select('unknown'); await h.click();
    assert.equal(h.state.connections, 0); assert.equal(h.state.transfers.length, 0);
});
