# Internal sodium test release V12.2.34 — 2026-10-17

Flasher 1.5.34 / Fleet 1.0.9. User authorized rollout to four additional
sodium11S machines after Borg's Nextion and BLE Start/Stop/Start checks.

- Fleet target: V12.2.34-PDO-FULL, sodium11S only, 918944 bytes.
- SHA256: 4fb270fde208be10477f761f771340d32c824beb6e24c3d83f6ac1a166a917a4.
- The OTA application is byte-for-byte the image flashed on Borg.
- Internal USB references the matching isolated .34 sodium build files.
- Lithium stays V12.2.28-LI10S-PDO-FULL, unchanged bytes/hash.
- Customer-shared STANDALONE remains V12.1.10. TFT assets and FTD30
  parameter set remain unchanged. PDO parameter writes remain disabled.
- No app source/version changes in this publication. Use Fleet for this rollout;
  the app's separate updater release approval remains independent.

Included previously tested portal fixes: robust USB Nextion framing/final ACK,
OTA cleanup between sessions, bounded reboot wait, and honest transfer outcome.
ACK/disconnect alone is TRANSFERRED/UNVERIFIED, not proof of running version.
Fleet must not mark a device updated, auto-retry, or continue combined writes
without running-version proof. Confirm installed version and operation afterward.

Firmware protections: priority BLE STOP, session-bound motion commands and
TX authority checks, supervised controlled stop, recovery proof invalidation
on contradictory node evidence, safe USB maintenance. Ramps, two-second
startup delay and battery profile are unchanged. See firmware source tools/
12.2.34-validation-summary.txt and 12.2.34-Borg-bench.txt for evidence/limits.

Borg observed both-node restart enable separation2501ms via Nextion and2504ms
via BLE, both stopped and disabled in Home/after STOP, user confirmed no
magnetization, live current and presets. A pre-first-start ACK-loss episode
remains unexplained; not declared fixed. No physical endurance, flying-start
or isolated-CAN-loss autonomous-stop qualification is claimed.

Release gate: node tools/verify-release.cjs locally and --live after deployment,
checking both OTA profiles, every USB image, canonical parameters and both
HTML pages against exact catalog hashes. Firmware branch is kept separate
from stable source main; source commit is pinned in version.json.

Source: 16bcc3af7acda810eed18cc9e48d224487e52070.
Release rerun:79 firmware tests passed,53 portal tests passed; both HTML
script syntax checks passed. Local byte/hash/descriptor release gate passed.
