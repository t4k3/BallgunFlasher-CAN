# V12.2.52 — ESP32 service indipendente dalla testa

Pubblicazione autorizzata da Ross il 30 ottobre 2026.

- Firmware sorgente: `c54c69dccb4c5d8e1d56bbc3ce1d7c14028dcb4c`.
- Flasher 1.5.45, Fleet 1.0.19.
- BLE Sodio 11S e pacchetto USB interno: V12.2.52-PDO-FULL.
- Immagine app: 920384 byte, SHA256
  `dcfa5233a9526e3065e4cb9cce7b69d76c44d6ce1db18c68a87ac29b26e71a21`.
- Nessun pre-check CAN, STOP automatico o popup nel flusso OTA interno/Fleet.
- Rifiuti del firmware precedente esplicitamente distinti dalla versione
  target; nessun invio di dati senza ACK di ingresso. Recovery .34 separata.
- Rilettura versione dopo riavvio invariata: trasferito non significa installato.
- Litio .28, Recovery .49, firmware cliente condiviso .50, TFT e PRM invariati.
- Pagina cliente 2.1.7: conferma umana prima dell'aggiornamento, binario cliente
  non promosso. Nessuna modifica API/database/accessi.

Verifiche locali: 81 test firmware, 99 test portale, 25 test pagina cliente,
build ESP-IDF 6.1 e descriptor/hash validi. Test reali di aggiornamento sulle
macchine e qualifica fisica restano distinti dalla pubblicazione.
