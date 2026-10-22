# Internal sodium recovery release V12.2.49 — 2026-10-22

- Target: `V12.2.49-PDO-FULL`, sodium 11S only.
- Firmware source: `t4k3/ballgun_STANDALONE_CANBUS`, branch
  `codex/ftd30-not-ready-maintenance`, commit
  `91d191160e1f4bb6c11cf51119c7134654976e2a`.
- OTA artifact: `INTERNAL/OTA/naion-11s/V12.2.49-PDO-FULL.bin`.
- Size: 919120 bytes.
- SHA-256: `7f50f29fc876909607177e2f717b2c708b00b50d9cb59d77346c3c61cb423f16`.
- Purpose: allow ESP32 OTA from a true cold-start session before any START,
  including when one or both FTD30 nodes are absent. Any START request or
  evidence of drive activity revokes the cold permission until a real power
  cycle.
- The customer shared firmware and isolated USB package remain on
  `V12.2.48-PDO-FULL`; this release updates only the internal sodium OTA path,
  Fleet target and the iOS recovery artifact.

Verification before publication:

- 79/79 firmware host tests passed.
- ESP-IDF 6.1 PDO-FULL sodium build passed.
- Firmware descriptor, size and SHA-256 verified.
- No physical BLE or motor qualification is claimed by these software tests.
