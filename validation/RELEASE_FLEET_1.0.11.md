# Fleet 1.0.11 — verification without reflashing

2026-10-17. User requested a verification-only action for four machines
already updated to V12.2.34-PDO-FULL, tests and publication.

Toolbar: "Verifica versione selezionate · senza flash". Select machines in
the queue, including those already updated; previously authorized devices
can be added from the remembered-device list. A fresh grant is available
through "Aggiungi sparapallone". Keep machines in Home with stopped motors
and disconnect other BLE apps before connecting Fleet.

Independent sequential read-only job, available without a downloaded binary.
It reads AA13 from the selected BluetoothDevice with the existing bounded
token/chunk/identity checks. Explicit read-only purpose does not require an
OTA reboot; the post-update flow still requires observed reboot disconnect.
No OTA, display upload, parameter writes, motor commands, fake ota_completed
events or updated-machine counter increments. Existing DB version is not
substituted for actual readback or overwritten by verification.

Matching exact version and device identity: green "Versione verificata".
Different running version: amber "Versione diversa" with actual/target.
Unavailable or invalid response: amber "Versione non letta" with reason.
Results stay in rows and session history; rows are deselected after reading.
No failure exposes an automatic flash/reflash button. Reselect rows and use
the same verification button to repeat the read. One machine's failure does
not prevent subsequent reads. Concurrent update/verification is blocked.

96 host tests passed, including four already-updated machines, matching and
mismatching versions/profile, unsupported firmware, timeout, disconnect,
wrong identity, cleanup, busy/empty-selection guards, independent binary
availability, read-only event routing and distinct history labels.
Transport is simulated: no physical four-machine verification in this task.
Local release gate and live gate compare catalog/HTML and artifact hashes.

Firmware remains V12.2.34-PDO-FULL sodium 11S. Flasher remains 1.5.34.
No app, firmware binary, TFT, parameter set or protection changes.
