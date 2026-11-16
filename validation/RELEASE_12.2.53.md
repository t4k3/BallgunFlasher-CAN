# V12.2.53 — verifica reale avvio motori

- Firmware sorgente: commit `98c05532b8bdd10c2ae6eba84095c759a208b555`.
- Flasher interno 1.5.47 e Fleet 1.0.20.
- BLE Sodio 11S e pacchetto USB interno: `V12.2.53-PDO-FULL`.
- Prima di aprire la pagina Main, entrambi i nodi devono confermare almeno
  400 RPM, target PDO corretto e stato operativo per 500 ms continui.
- Il falso feedback fermo da 200–300 RPM non soddisfa più la prova.
- Se la prova fallisce, Main resta chiusa e il tasto Nextion mostra
  `POWER OFF/ON` rosso; il tasto non riabilita i motori.
- `CHECK CABLE` resta separato per gli errori di comunicazione CAN.

Invariati: firmware cliente `V12.2.50-PDO-FULL`, litio
`V12.2.28-LI10S-PDO-FULL`, recovery `V12.2.34 → V12.2.49`, TFT e set parametri
FTD30. La build e i test host non sostituiscono la prova fisica di START.
