# Internal test release V12.2.28 — 2026-10-16

Flasher 1.5.33 / Fleet 1.0.8. Publication authorized for a four-machine test.

- Sodium OTA: V12.2.28-PDO-FULL; lithium OTA: V12.2.28-LI10S-PDO-FULL.
- Fleet uses sodium only. Internal USB uses an isolated sodium FULL flash set.
- STANDALONE/ remains unchanged at V12.1.10: the customer website downloads that shared image. No customer deployment.
- OTA descriptor, ESP32-C6 chip, length and SHA-256 are checked before transfer. USB checks every image length/hash before erasing.
- Firmware + parameters is disabled for PDO. The complete FTD30 read-only check remains available; PDO FULL does not implement parameter writes/SAVE. Separate legacy parameter tooling is not a workaround for this limitation.
- Prior pending portal changes are included: console-only check details and preservation of P994/P1012 in legacy restores.

Bench evidence: Carulli ran the sodium V12.2.28 image. Operator confirmed staggered startup and Start/Home/Start. Current is read as raw OD 0x3210 on both nodes; UP was compared with Bystorm (raw signed -22..-25 versus 2.2..2.5 A). User chose conversion in the future app, not this firmware. No new BLE current payload is claimed.

Both battery profiles compile. Lithium has no new physical bench qualification. Host tests/simulated soak do not prove hardware endurance or automatic recovery after driver power loss; no flying start is claimed.

Release verification: `node tools/verify-release.cjs`, then `node tools/verify-release.cjs --live` after Pages deployment. Release hashes are pinned in version.json, including the frozen customer image.

Firmware source: a23dd93ee0a5252403e73ccb038f2472da5b9208 on codex/pdo-12.2.0-restart; stable source main is not replaced.
Release rerun: 71 firmware tests and 51 portal tests passed, plus battery profiles, BLE handover and startup-controlword shell tests. USB integrity tests reject tampering in each of the four flash files before erase. Portal version parsing accepts compound PDO-FULL suffixes while named-profile hash checks remain strict.
