# V12.2.50 normal update target

- Normal sodium 11S update target: `V12.2.50-PDO-FULL`.
- Internal single-machine OTA, Fleet and the shared customer binary use the
  same verified 919120-byte image (SHA-256
  `ac8240e0a89ec46f025bf1ca9e4dfa963cf596c96d2511b71a6b43c816c8734a`).
- Dedicated recovery remains independently pinned to
  `V12.2.34-PDO-FULL → V12.2.49-PDO-FULL`, using the existing `.49` image and
  hash. It never follows the normal sodium target automatically.
- Internal USB remains on its existing isolated `.48` bundle; it is outside
  this normal OTA-only release.

The `.50` firmware changes only `version.txt` from `.49`. Local build and host
tests do not prove a physical `.49 → .50` BLE update and do not constitute a
publication.
