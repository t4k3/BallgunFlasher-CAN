# Fleet 1.0.10 — automatic post-OTA running-version proof

2026-10-17. User authorized implementation, tests and publication.
Firmware remains V12.2.34-PDO-FULL sodium11S; no firmware/app/protection,
parameter, TFT or binary changes. Single-device Flasher remains1.5.34.

After a valid final OTA ACK AND observed remote disconnect, Fleet retires
the OTA connection, reconnects the same BluetoothDevice.id, reacquires the
service/characteristic, and reads AA13 firmware version with a new16-bit
token. Requests/replies match BleFirmwareVersion.h: tokenBE16, offset,
protocol1, total length1..64, up to13 printable ASCII bytes per chunk.
Unrelated/wrong-token/other-characteristic packets cannot confirm a version.
Offsets, chunk sizes, total length and exact version/profile suffix are checked.

Three bounded read-only reconnect attempts,45s proof deadline,8s GATT
operation timeout,3s per-chunk reply timeout. Hung GATT operations end the
verification instead of starting overlapping attempts. Late connections
are retired; listeners/timers/GATT are cleaned on every exit.

Only matching fresh readback produces verified/ota_completed/roster update.
Old version/rollback, malformed data, unsupported protocol, missing reboot,
timeout or disconnection remains transferred-unverified with a reason and
NO automatic OTA retransmission or combined-job continuation.
Verification sends only AA13: no START, STOP, speed or CAN/parameter writes.

80 host tests passed: existing OTA completion/failure/cleanup/sequence suites
plus27 readback scenarios and end-to-end job outcome checks. Transport is
simulated; physical post-OTA reconnect acceptance remains to be observed.
Existing four-machine results from Fleet1.0.9 are not retroactively changed.
The new automatic verification runs as part of subsequent OTA jobs.

Release gate checks unchanged artifact hashes and exact live HTML/catalog.
