# Flasher 1.5.43 — USB V12.2.50 and isolated V12.2.34 Recovery

- The internal STANDALONE USB bundle is now the complete
  `V12.2.50-PDO-FULL` four-file image at offsets `0x0`, `0x8000`, `0xE000`
  and `0x10000`.
- USB verifies the exact size and SHA-256 of every file before erasing or
  writing the ESP32-C6.
- Normal BLE OTA remains `V12.2.50-PDO-FULL`.
- The dedicated `V12.2.34 → V12.2.49` path has its own isolated Recovery card.
  It still requires exact AA13 proof of `.34`, uses the pinned `.49` image and
  sends no motor START/STOP command.
- Fleet, FTD30 parameters, Nextion files and customer assets are unchanged.

Local software tests do not constitute a physical USB flash or Recovery test.
