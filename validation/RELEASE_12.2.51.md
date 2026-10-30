# V12.2.51 BLE sodio: indicatore pieno

Flasher 1.5.44 e Fleet 1.0.18: target BLE sodio V12.2.51-PDO-FULL.
Firmware sorgente: a965ca5dc52d845fe1f33eeb03c6483bfaf72516.

- 100% dopo 10 secondi consecutivi ad almeno 43,2 V filtrati.
- Mantenimento finche non resta sotto 42,8 V per 15 secondi consecutivi.
- Curva fino a 42 V e protezioni invariate; dati mancanti azzerano il pieno.
- Litio invariato V12.2.28-LI10S-PDO-FULL.
- Recovery separato invariato .34 -> .49.
- Pacchetto USB e binario cliente condiviso restano .50: questa pubblicazione
  riguarda solo BLE interno e Fleet, non modifica i percorsi cliente.

Immagine ESP32-C6: 919648 byte, SHA256
`93a7fb8562a0762257173687edc5609c56d696889b2884f53333be5d186e01cc`.

Firmware: 79 regressioni e nuovi test batteria/display superati, quattro ore
simulate, compilazioni sodio/litio riuscite. Nessun collaudo fisico della nuova
soglia eseguito; la pubblicazione e autorizzata per la prova BLE dell'utente.
Un trasferimento completato non prova la versione avviata: usare la verifica
AA13 dopo il riavvio.
