# Flasher 1.5.40 — dedicated V12.2.34 recovery

- Adds a separate `Recovery V12.2.34 → V12.2.49` action to the internal portal.
- Reads the installed firmware with read-only AA13 on the selected BLE device.
- Requires the exact source `V12.2.34-PDO-FULL` and the pinned sodium target
  `V12.2.49-PDO-FULL` before sending FE05.
- Sends no motor START or STOP command in Recovery mode.
- Retries only FE05 refusal `FE E0 09` or a missing notification for at most
  30 seconds. Any other reply, write failure or disconnect stops immediately.
- Firmware bytes are never streamed until the firmware accepts OTA mode.
- The ordinary updater keeps its previous STOP-assisted behavior.

This is software validation only. It cannot bypass a refusal enforced by the
installed V12.2.34 firmware and does not claim physical BLE qualification.
