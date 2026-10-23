# Fleet 1.0.17 — safe dual-node FTD30 parameter restore

2026-10-23. Fleet parameter restore now identifies both FTD30 nodes through
the guarded CANopen identity object `0x1018` before the first write. Parameter
P1 is not used as pre-check identity because it is not readable on every drive
before password 11 unlock.

The sequential job requests the established BLE STOP command, requires its
acknowledgement, waits for a stable Home/Idle state, and tolerates bounded CAN
and BLE handover delays. Before writing, both node 1 and node 2 must answer the
identity request and report zero RPM, an allowed disabled state, and no alarm.
Stale notifications are ignored unless they match the pending command.

Only after the complete pre-check does Fleet write 1022 parameters per node.
P1 is set to the destination node ID; P994 calibration and P1012 serial number
remain untouched. Every written value is read back before SAVE. There is no
automatic retry after a write because a disconnect can leave a partial update.

Physical validation completed on six machines (`13C6`, `2682`, `3F92`,
`DA66`, `496E`, `6C12`): twelve FTD30 nodes completed write, full readback and
SAVE, then all six machines started correctly after the operation. The initial
test without magnetic driver cables was rejected before any parameter write;
power-cycling with both cables connected restored the required state.

Firmware remains V12.2.50-PDO-FULL. Flasher remains 1.5.43. No firmware,
binary, Nextion, customer-portal, parameter-set or battery-profile change.
