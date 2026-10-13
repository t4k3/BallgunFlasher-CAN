# Portale interno 1.5.22 — profili batteria OTA

Nella sola scheda **BLE · WIRELESS / OTA** sono disponibili:

| Selezione | Versione immagine | File |
|---|---|---|
| Sodio · 11S (predefinito) | V12.1.3 | `INTERNAL/OTA/naion-11s/V12.1.3.bin` |
| Litio 36 V · 10S | V12.1.3-LI10S | `INTERNAL/OTA/liion-10s/V12.1.3-LI10S.bin` |

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

`STANDALONE/BallgunSTANDALONE.bin` è V12.1.3 (sodio), SHA-256
`1d4a7a914c33cd404aec169521a8af6c8761b375e38d58715e380ee57c660a71`.
Il portale cliente, la scheda USB, Fleet e le app native continuano a usare quel
percorso condiviso. `version.json.firmware` descrive il binario standard;
`internal_ota` descrive le due varianti selezionabili nel portale interno.
I file TFT non sono stati modificati.

"Interno" indica l'interfaccia che espone la scelta; non viene aggiunto un nuovo
meccanismo di autenticazione al repository GitHub Pages esistente.

## Provenienza dei binari

Build pulite ESP32-C6 / ESP-IDF 6.1 del 13 ottobre 2026, dal checkout canonico
`ballgun_STANDALONE_CANBUS`. La versione base proviene dal file ESP-IDF
`version.txt`; il profilo litio aggiunge il suffisso `-LI10S`.
Entrambi i file sono da 883200 byte. Descrittori, checksum ESP e validation hash
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
