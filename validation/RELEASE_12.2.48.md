# Local release candidate V12.2.48 — 2026-10-22

Status: built and validated locally; not pushed, published or flashed.

- Sodium 11S firmware: `V12.2.48-PDO-FULL`, 918960 bytes.
- SHA-256: `e76253cfbfcdaf45d7e939f6641d3289fea12d0a55f08b61eb6d1c90aaa2eb30`.
- Firmware source: commit `5a69e8ee903af16a7bb5a1536c5d835764acf270` on
  `codex/ftd30-not-ready-maintenance`.
- ESP-IDF 6.1 / ESP32-C6 / PDO-FULL / NAION_11S build passed without
  compiler warnings or errors; image descriptor, checksum and hash valid.
- Firmware regression suite: all 52 test files passed.
- Portal regression and release-integrity suites passed using the real binary.

Functional correction:

- FTD30 parameter recovery now accepts a stopped driver in CiA-402 NOT_READY
  (observed raw statusword `0x0400`) while retaining every independent safety
  gate: both valid node IDs, idle ownership, drives disabled, confirmed STOP,
  healthy TWAI, fresh RPM/status telemetry, RPM below 50 and no active motion.
- Operation-enabled state remains rejected.
- The direct parameter card opens no browser popup. Exact rejection reasons are
  shown in the console; a rejection before the first acknowledged batch reports
  that no parameter and no SAVE were written.

Physical recovery of the reported machine is not yet proven until this image is
flashed and the two-node restore is repeated on the bench.
