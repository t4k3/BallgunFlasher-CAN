# Manutenzione ESP32 e FTD30: operazioni distinte

## Procedura per operatori formati (portale interno e Fleet)

Prima di aggiornare firmware ESP32 o display, l'operatore deve verificare
fisicamente che entrambi i motori siano completamente fermi e che nessuno
utilizzi la macchina. Non richiedere movimento durante l'aggiornamento.
Non considerare la mancanza di comunicazione CAN una prova di arresto.

- **Firmware ESP32:** la testa può essere scollegata; servono alimentazione
  stabile dell'ESP32 e collegamento di aggiornamento. Non serve alimentare i
  driver né attendere i loro RPM/stati. Portale interno e Fleet non aggiungono
  popup, checkbox o comandi START/STOP al flusso OTA.
- **Parametri FTD30:** entrambi i driver devono essere collegati e alimentati,
  con motori fermi. Pre-check, password, verifica delle scritture e SAVE sono
  invariati. Il percorso OTA ESP32 non è un bypass per modificare parametri.
- **Cliente finale:** la pagina cliente chiede conferma esplicita delle
  condizioni prima di aprire il collegamento di aggiornamento.

La V12.2.52 introduce l'accesso OTA indipendente dalla telemetria FTD30 e
inibisce i nuovi comandi di movimento fino al riavvio, anche se il trasferimento
viene interrotto. Non arresta né certifica fisicamente motori già in rotazione:
questa verifica precede l'operazione ed è responsabilità dell'operatore.

## Compatibilità e stato della modifica

Il firmware **già installato** decide se accettare FE05. Un nuovo binario
scaricato non può cambiare il controllo del vecchio firmware prima del flash.
Il portale segnala quindi il rifiuto legacy senza attendere i driver e senza
inviare dati. Recovery dedicata solo con versione esatta V12.2.34; se una diversa
versione continua a rifiutare, il primo aggiornamento può richiedere USB.

Flasher 1.5.45 / Fleet 1.0.19: release 12.2.52 per BLE sodio e USB interno.
Litio, Recovery e firmware condiviso cliente rimangono invariati. La versione
12.2.52 va indicata come installata solo dopo rilettura dal dispositivo.
