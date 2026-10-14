# Portale interno 1.5.27 / Fleet 1.0.4 — V12.1.8

Diagnostica identità FTD30 del 14 ottobre 2026:

- Lettura UP/DOWN di firmware major.minor tramite `0x323C:0`, già
  disponibile via FC04 sui firmware ESP32 precedenti: nessun update obbligatorio
  per questo confronto. La patch non è esposta da questo registro.
- Nuovo FC05 in V12.1.8 per `0x1008/1009/100A:0` e `0x1018:1..4`;
  upload SDO expedited/segmented, limite 64 byte, pagine BLE da massimo 20 byte.
  Timeout, abort con codice, formato errato e oggetto non supportato distinti.
- Solo HOME/Idle, nessun arresto pendente, motori disabilitati e RPM recenti
  sotto 50; nessun unlock, scrittura parametri, SAVE o comando motore.
- Nessuna variazione ad avvio, STOP, rampe o soglie CHECK CABLE.
- Build sodio 887184 byte; litio 887200 byte. Hash in `version.json`.
  Test parser C con ASan/UBSan, helper CAN reale con trasporto simulato e
  paginazione/diagnostica JS passati. Lettura su FTD30 fisici ancora da eseguire.

### Evidenza dal pacchetto Bystorm fornito dall'utente

Analizzato localmente `FTD30_REV3.8.0-0_240725.elf`, SHA-256
`f2e8265dfeb04386dab0dce4d2ab9e2c8eb3ef2524fd20e07592bdd20c9efe43`.
Il file proprietario non viene pubblicato nel repository.

- Header a `0x08024000`, campo FirmwareVersion a offset `0x50`:
  `0x03080000`; changelog: 3.8.0, 2024-07-25.
- DWARF: `OUT_FW_VERSION=60`. `CO_OD_ReadEntry` a `0x08029a04`
  mappa `0x3200..0x323F` su `VarOutput[index-0x3200]` a 16 bit.
- `_Exec` a `0x08036b84..0x08036b8e` legge Header.FirmwareVersion,
  esegue shift destro di 16 e scrive `VarOutput[60]`: quindi `0x323C`
  restituisce `0x0308` in questa release. La stessa mappa sulle release
  precedenti resta da confermare; conservare sempre il valore raw.
- Tabella `CO_ODE`: `0x1008:0` punta a `STM32F303`, `0x1009:0` e
  `0x100A:0` puntano entrambi a `FF.00`. Non usare questi segnaposto
  per concludere che i firmware dei nodi siano uguali.
- Il changelog 3.2.0 cita correzioni a baudrate e scrittura parametri CANopen;
  3.4.0 imposta CAN a 500 kbit/s di default; 3.8.0 corregge protezione F07.
  Questo non dimostra che CHECK CABLE sia causato dalla versione del driver.

## Documentazione storica V12.1.7

Aggiornamento STOP e diagnostica del 14 ottobre 2026:

- V12.1.7 sodio: 885472 byte; V12.1.7-LI10S litio: 885488 byte.
- Comando STOP invariato (Disable Operation, 0x0007), ora con ACK e
  rilettura statusword indipendenti per nodo. Non equivale a Disable Voltage.
- STOP non completato in caso di timeout, abort o stato ancora abilitato:
  START bloccato, allarme e retry a 1 secondo, senza annullare SDO pendenti.
- Completamento solo con RPM freschi successivi alla conferma del driver,
  sotto la soglia di arresto preesistente. Nessun azzeramento fittizio RPM.
- Pulsante Wait durante arresto. Rampe, parametri FTD30 e soglie CAN invariati.
- Diagnostica cumulativa bit/form/stuff/ACK, arbitraggio separato, bus-off,
  ritorni error-active e scarti della coda RX; riepilogo massimo ogni 5 secondi.
  L'API IDF non espone un flag CRC separato; arbitraggio perso non prova un guasto.
- Test C host riproducono il falso STOP della .6 e verificano la correzione;
  regressioni avvio, batteria, BLE e SDO passate. Build ESP-IDF 6.1 dei due
  profili e verifica dei descrittori eseguite. Prova fisica ancora necessaria.

La release non dimostra risolta la causa primaria di CHECK CABLE o la
magnetizzazione fisica. Per il collaudo usare prima una sola macchina e solo
aggiornamento firmware: non riscrivere i parametri. Binari precedenti conservati
nei percorsi versionati per rollback; hash correnti in `version.json`.

## Documentazione storica V12.1.6

Aggiornamento 14 ottobre 2026: catalogo e binario condiviso puntano a V12.1.6
(sodio, 884176 byte) e V12.1.6-LI10S (litio, 884192 byte).
Hash completi in `version.json`; binari V12.1.5 conservati nei percorsi versionati
per rollback. Il firmware attende ACK per accelerazione dolce, velocità e
controlword dopo wake-and-shake, con massimo tre tentativi e RPM freschi.
Test host e build dei due profili superati; collaudo fisico ancora da eseguire.
Nessun parametro FTD30 o file TFT modificato in questa release.

## Documentazione storica V12.1.5 (sotto)

Nella sola scheda **BLE · WIRELESS / OTA** sono disponibili:

| Selezione | Versione immagine | File |
|---|---|---|
| Sodio · 11S (predefinito) | V12.1.5 | `INTERNAL/OTA/naion-11s/V12.1.5.bin` |
| Litio 36 V · 10S | V12.1.5-LI10S | `INTERNAL/OTA/liion-10s/V12.1.5-LI10S.bin` |

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

`STANDALONE/BallgunSTANDALONE.bin` è V12.1.5 (sodio), SHA-256
`10a4e9a7a1f4656bb4e907581fe0796b8c1f656dce7c8ff1d0ea8f953430906b`.
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
Entrambi i file sono da 883648 byte. Descrittori, checksum ESP e validation hash
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

## Ripristino parametri V12.1.5

Flasher 1.5.24 e Fleet 0.8.5 offrono il ripristino separato del solo nodo 1,
oppure la sequenza firmware V12.1.5, attesa di 11 secondi, parametri nodo 1.
Il set completo viene da `FTD30/waz_nodo2.prm`, identico al file approvato
dall'utente, con la sola sostituzione di P1 per il nodo 1. Il nodo 2 resta intatto.
La capability del firmware conferma il controllo dell'esito SDO della password 11
prima di ogni batch. Tutti i 1024 parametri vengono riletti prima del SAVE;
errori, parametri saltati o discrepanze interrompono il ripristino senza SAVE.
La persistenza dopo spegnimento e riaccensione richiede verifica sulla macchina.
La V12.1.5 interrompe inoltre l'avvio se una ruota non raggiunge lo stato o gli
RPM richiesti, invece di dichiarare completato un avvio parziale.

Test locali: `node tests/ftd30-repair.test.cjs` e
`node tests/fleet-parameters.test.cjs` verificano successo, firmware precedente,
fallimento password e discrepanze, usando il codice reale e una connessione simulata.
La nuova release non è stata collaudata su hardware in questa pubblicazione.

La V12.1.5 corregge la dimensione dati delle risposte SDO: nella V12.1.4
rimaneva zero, bloccando la verifica su P0 e il SAVE. Le pagine richiedono ora
sia la capability di unlock verificato sia quella delle letture con dimensione
corretta, prima di qualsiasi scrittura. Dimensioni sconosciute non vengono
sostituite arbitrariamente con due byte. Le risposte segmentate non supportate
vengono rifiutate. Il test `tests/sdo-response.test.cjs` nel repository firmware
esegue il parser C reale insieme agli helper lettura/scrittura/SAVE; riproduce
il fallimento sulla V12.1.4 e passa sulla correzione, con UBSan.
Formato SDO di riferimento: https://canopennode.github.io/CANopenNode/group__CO__SDOserver.html
