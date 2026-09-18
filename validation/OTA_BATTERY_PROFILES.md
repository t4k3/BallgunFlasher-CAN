# Portale interno 1.5.21 — profili batteria OTA

Nella sola scheda **BLE · WIRELESS / OTA** sono disponibili:

| Selezione | Versione immagine | File |
|---|---|---|
| Sodio · 11S (predefinito) | V12.1.2 | `INTERNAL/OTA/naion-11s/V12.1.2.bin` |
| Litio 36 V · 10S | V12.1.2-LI10S | `INTERNAL/OTA/liion-10s/V12.1.2-LI10S.bin` |

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

`STANDALONE/BallgunSTANDALONE.bin` resta V12.1.1 (sodio), byte per byte invariato,
SHA-256 `86e1e96c03253e0feda1ecf2d2b8d4975a6be58568e63f3ac9113710f655a875`.
Il portale cliente e le app native continuano a usare quel percorso. Nessuna
modifica al repository `upgrade.takeoff.pro`, al suo backend, ai file TFT o ai
binari di boot. La scheda USB e Fleet rimangono sul binario standard condiviso.
`version.json.firmware` descrive ancora il binario condiviso; `internal_ota`
descrive esclusivamente le nuove varianti interne.

"Interno" indica l'interfaccia che espone la scelta; non viene aggiunto un nuovo
meccanismo di autenticazione al repository GitHub Pages esistente.

## Provenienza dei binari

Build ESP32-C6 / ESP-IDF 6.1 del 18 settembre 2026, dal checkout canonico
`ballgun_STANDALONE_CANBUS`, base `31e23a8691745ada14283385fc8fd201b3e49af6`
con le modifiche locali del passaggio di controllo BLE e dei profili batteria.
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
- Hash confrontati prima/dopo su file condivisi e sito cliente: invariati.

Queste verifiche non costituiscono una prova BLE o un flash fisico della macchina.
