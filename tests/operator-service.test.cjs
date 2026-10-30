'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
for(const [page,name] of [['index.html','otaEnterUpdateMode'],['fleet.html','otaUpdateOne']]){
 const source=fs.readFileSync(path.join(__dirname,'..',page),'utf8');
 const body=source.match(new RegExp(`^async function ${name}\\([^]*?^}`,'m'))[0];
 assert.doesNotMatch(body,/\bconfirm\s*\(|\bprompt\s*\(/,'trained internal service has no manual dialog');
 assert.doesNotMatch(body,/\[\s*0xAA\s*,\s*0x0[123]/,'ESP32 service must not send motor START/STOP/setpoint');
 assert.doesNotMatch(body,/0xFC/,'ESP32 service must not require a driver check');
 assert.match(body,/0x0A/,'distinguish local resource refusal');
}
console.log('PASS internal/Fleet OTA: no operator dialog, motor commands or FTD30 pre-check');
