# Verifica conferma finale Nextion BLE — 16 settembre 2026

Il sito cliente 2.1.1 cercava soltanto `05 00 00 00 FF FF FF` dopo l'invio e dichiarava completato anche quando il pattern mancava. Lo stesso criterio era presente nel flasher interno 1.5.19. La prova fotografata del 2.8″ riportava NX4848E028_011C, revisione 177, canBusRounded.tft V8 da 664248 byte, seek 524288 e 36 blocchi. L'utente ha confermato che il cliente ha visto il display riavviarsi e funzionare: questo era l'esito prima della correzione, non una prova fisica della nuova pagina.

## Correzione

- Conferma obbligatoria per ogni blocco, incluso l'ultimo. Si accettano 05 e 08 con offset completo; 08 con zero continua, offset nonzero richiesto anche dopo l'ultima scrittura viene servito prima di concludere.
- Il pattern esteso rimane compatibile perché inizia con 05; i byte successivi del riavvio diventano sola diagnostica.
- Attesa limitata a 15 secondi, offset oltre EOF rifiutati, seek limitati a 32. Nessuna ritrasmissione cieca quando manca la conferma.
- Stato finale “update received” distingue la ricezione dei dati dalla verifica del riavvio. Senza ACK: “The display has not confirmed the update. Check its screen before trying again.”
- Sul sito cliente `nextion_completed` richiede la conferma e registra `confirmation=display_block_ack`. Una conferma mancante registra `nextion_failed` con `outcome=unconfirmed`; nessun aggiornamento del backend o della struttura DB.
- Uscita best effort dal passthrough dopo trasferimento confermato o interrotto, quando BLE è ancora collegato.

## Verifiche

`node --test validation/nextion-transfer.test.cjs`: 23 test per pagina, usando le funzioni reali estratte da index.html e un trasporto BLE in memoria. Nessun dispositivo, browser, richiesta di rete o evento nel DB di produzione durante i test.

Casi: tutti e tre i modelli con 05, pattern esteso, 08/zero e ACK finale assente; scenario 2.8″ con seek 524288 e 36 blocchi, offset frammentato, ACK finale ritardato di 5 secondi, EOF esplicito, richiesta di reinvio dopo l'ultima scrittura, soli byte di boot, offset incompleto, disconnessione, timeout intermedio, offset fuori limite, seek ripetuti, file di un solo blocco.

Verificata sintassi di tutti gli script della pagina. Hash invariati per 31 file protetti: firmware C/H, binari ESP32, tre TFT e fleet.html. Gestione USB e app iOS/Android non modificate. Nessun flash hardware; verifica fisica del nuovo flusso ancora da eseguire.

Versione pagina: 1.5.20.
