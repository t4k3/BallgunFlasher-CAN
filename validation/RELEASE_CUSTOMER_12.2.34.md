# Customer promotion V12.2.34 — 2026-10-21

The sodium 11S firmware `V12.2.34-PDO-FULL`, previously limited to the
internal Flasher and Fleet, is promoted to the customer-shared path after the
user confirmed that physical validation is complete.

- Shared path: `STANDALONE/BallgunSTANDALONE.bin`.
- Size: 918944 bytes.
- SHA-256: `4fb270fde208be10477f761f771340d32c824beb6e24c3d83f6ac1a166a917a4`.
- Source: `t4k3/ballgun_STANDALONE_CANBUS`, branch
  `codex/pdo-12.2.0-restart`, commit
  `16bcc3af7acda810eed18cc9e48d224487e52070`.
- The promoted image is byte-for-byte identical to the internal sodium image
  already used for the completed validation.

The customer page remains sodium 11S only. Lithium stays on the separate
internal `V12.2.28-LI10S-PDO-FULL` image and is not exposed by the customer
page. Fleet, internal Flasher behavior, TFT assets, FTD30 parameters and the
backend are unchanged.

Release gates: full portal tests, exact descriptor/size/hash verification,
GitHub Pages deployment verification, and direct customer-page download check.
