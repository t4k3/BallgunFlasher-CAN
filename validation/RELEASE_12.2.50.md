# V12.2.50 normal update target

- Normal sodium 11S update target: `V12.2.50-PDO-FULL`.
- Internal single-machine OTA, Fleet and the shared customer binary use the
  same verified 919120-byte image (SHA-256
  `ac8240e0a89ec46f025bf1ca9e4dfa963cf596c96d2511b71a6b43c816c8734a`).
- Dedicated recovery remains independently pinned to
  `V12.2.34-PDO-FULL → V12.2.49-PDO-FULL`, using the existing `.49` image and
  hash. It never follows the normal sodium target automatically.
- Internal USB was subsequently promoted to the complete `.50` four-file
  bundle in Flasher 1.5.43.

The `.50` firmware changes only `version.txt` from `.49`. A physical
`.49 → .50` BLE update was completed successfully on 2026-10-22; the USB
bundle still requires its own physical flash test.
