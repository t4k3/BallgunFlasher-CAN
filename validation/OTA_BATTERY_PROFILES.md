# Portale interno 1.5.23 — profili batteria OTA

Nella sola scheda **BLE · WIRELESS / OTA** sono disponibili:

| Selezione | Versione immagine | File |
|---|---|---|
| Sodio · 11S (predefinito) | V12.1.4 | `INTERNAL/OTA/naion-11s/V12.1.4.bin` |
| Litio 36 V · 10S | V12.1.4-LI10S | `INTERNAL/OTA/liion-10s/V12.1.4-LI10S.bin` |

La pagina parte sempre da Sodio, anche dopo ripristino della pagina dalla cache
di navigazione. Il tipo batteria, la versione completa e la tensione massima sono
visibili prima di premere Connect & Update. La selezione non viene salvata.

La scelta è fissata e i controlli sono disabilitati prima di aprire il selettore
Bluetooth. Il download usa il percorso del profilo scelto, senza fallback. Prima
di entrare in OTA si controllano chip ESP32-C6, nome progetto, versione, dimensione
e SHA-256. Un 404 o un file diverso non può avviare il trasferimento.

Il caricamento custom rimane disponibile, indicato come File personalizzato;
passare a Sodio/Litio elimina il precedente custom. I custom sono verificati per
chip/progetto/versione, ma non hanno un hash di catalogo.

## Separazione dal portale cliente

`STANDALONE/BallgunSTANDALONE.bin` è V12.1.4 (sodio), SHA-256
`d67237a492fbff1bab477b5463b14f43a9579bc2264e1a5b8cedc903caebf73d`.
Il portale cliente, la scheda USB, Fleet e le app native continuano a usare quel
percorso condiviso. `version.json.firmware` descrive il binario standard;
`internal_ota` descrive le due varianti selezionabili nel portale interno.
I file TFT non sono stati modificati.

"Interno" indica l'interfaccia che espone la scelta; non viene aggiunto un nuovo
meccanismo di autenticazione al repository GitHub Pages esistente.

## Provenienza dei binari

Build ESP32-C6 / ESP-IDF 6.1 del 14 ottobre 2026, dal checkout canonico
`ballgun_STANDALONE_CANBUS`. La versione base proviene dal file ESP-IDF
`version.txt`; il profilo litio aggiunge il suffisso `-LI10S`.
Entrambi i file sono da 883568 byte. Descrittori, checksum ESP e validation hash
verificati con esptool. I valori completi SHA-256 sono nel catalogo `version.json`.

Profilo sodio: 44 V piena carica / 30 V riserva / 26 V avviso scarica.
Profilo litio: Li-ion 10S confermata dall'utente, 36 V nominali / 42 V piena carica /
34 V riserva / 29 V avviso scarica, con curva ereditata dal firmware C3.
Queste soglie non introducono un cutoff motori ESP32. La scelta è incorporata nel
firmware; un successivo aggiornamento standard riporterebbe il profilo sodio.

## Verifiche

- `node --test validation/ota-battery-profiles.test.cjs`: 13 test passati usando
  il codice reale della pagina e i binari distribuiti, con BLE in memoria.
- `node --test validation/nextion-transfer.test.cjs`: 23 regressioni passate.
- Sintassi del modulo JavaScript verificata con `node --check`.
- Browser: versione e tensione corrette passando Sodio → Litio; ricaricando si
  torna a Sodio. Scheda controllata anche visivamente, senza avviare collegamenti.
- Descrittori ESP, versioni e hash confrontati con i metadati pubblicati.

Queste verifiche non costituiscono una prova BLE o un flash fisico della macchina.

## Ripristino parametri V12.1.4

Flasher 1.5.23 e Fleet 0.8.3 offrono il ripristino separato del solo nodo 1.
Il set completo viene da `FTD30/waz_nodo2.prm`, identico al file approvato
dall'utente, con la sola sostituzione di P1 per il nodo 1. Il nodo 2 resta intatto.
La capability del firmware conferma il controllo dell'esito SDO della password 11
prima di ogni batch. Tutti i 1024 parametri vengono riletti prima del SAVE;
errori, parametri saltati o discrepanze interrompono il ripristino senza SAVE.
La persistenza dopo spegnimento e riaccensione richiede verifica sulla macchina.
La V12.1.4 interrompe inoltre l'avvio se una ruota non raggiunge lo stato o gli
RPM richiesti, invece di dichiarare completato un avvio parziale.

Test locali: `node tests/ftd30-repair.test.cjs` e
`node tests/fleet-parameters.test.cjs` verificano successo, firmware precedente,
fallimento password e discrepanze, usando il codice reale e una connessione simulata.
La nuova release non è stata collaudata su hardware in questa pubblicazione.
