# V12.2.54 — finestra indipendente avvio motori

- Firmware sorgente: commit `ca8870b77464624bca9be28a190d835f9b892cc6`.
- Flasher interno 1.5.48 e Fleet 1.0.21.
- BLE Sodio 11S e pacchetto USB interno: `V12.2.54-PDO-FULL`.
- Ogni nodo dispone di 20 secondi dal proprio `startRampAt` per raggiungere 400 RPM; lo sfasamento intenzionale del nodo 2 non consuma la finestra del nodo 1.
- Dopo il raggiungimento della soglia, entrambi i nodi devono restare sopra 400 RPM per 500 ms continui prima dell'accesso a Main.
- Se un nodo non supera la soglia entro 20 secondi più i 500 ms di prova, il firmware arresta l'avvio e mostra `POWER OFF/ON`.
- Invariati: rampe, comunicazione CAN, parametri FTD30, P994, P1012, Nextion, Recovery V12.2.34, profilo litio e portale cliente.
- Verifica sorgente: 54 test `.test.cjs`, suite batteria, suite controlword startup e build ESP-IDF 6.1 superati.
- Immagine ESP32-C6: 920816 byte, SHA-256 `13956c637578d1e81d445228f5b412c4402ec8a8f6945a70375e0ab0d6c11ef1`.
- La pubblicazione del binario non costituisce prova di installazione o collaudo fisico; il test sulla macchina resta separato.
