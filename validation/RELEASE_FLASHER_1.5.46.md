# Flasher 1.5.46 — set FTD30 sperimentale interno

Data: 16 novembre 2026.

## Perimetro

La sola pagina interna aggiunge un secondo comando esplicito per un test di
spunto FTD30 su entrambi i nodi:

- P62 `I Rated` passa da `131` a `151`;
- P63 `I Max pos.` passa da `131` a `151`;
- P238 `Id Start` passa da `70` a `101`.

Il set collaudato `FTD30/waz_nodo2.prm` resta invariato e continua a essere la
scelta normale. Il set sperimentale è nel file separato
`FTD30/waz_nodo2-current151-idstart101.prm` e viene accettato soltanto con il
suo hash SHA-256 fissato nella pagina.

## Sicurezza e verifica

Il comando sperimentale riusa integralmente il flusso a due nodi già
collaudato: identificazione distinta dei nodi 1 e 2, RPM zero, stato
disabilitato, allarmi zero, preservazione di P994/P1012, rilettura completa dei
1022 parametri prima del SAVE e verifica separata dopo il riavvio.

Nessuna modifica a firmware ESP32, Fleet, pagina cliente, Nextion, profili
batteria o set FTD30 collaudato.
