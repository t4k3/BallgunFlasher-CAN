# Flasher 1.5.41 — visible FTD30 restore progress

- Changes only the indications shown during the existing two-node FTD30
  parameter restore.
- Keeps the approved parameter file, exclusions, batch writes, full 1022-value
  readback, SAVE order and six-key final check unchanged.
- Shows the active node and separate write, full-readback, SAVE and final-check
  phases in the card.
- During the slow full readback, the card updates the `X/1022` count and the
  console records a checkpoint every 128 values.
- Firmware binaries, TFT files, Fleet behavior and BLE/CAN protocol are
  unchanged.

Software tests do not replace a physical restore. The previous V12.2.49 bench
restore remains the physical evidence for the underlying operation; this
release only makes its already-observed phases visible.
