@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul
title Wazlley USB Fix Tool

REM ============================================================
REM   Wazlley USB Fix Tool
REM
REM   Pulisce le COM port "fantasma" che Windows accumula ogni
REM   volta che colleghi un ESP32 nuovo. Esegui questo file SE
REM   il flasher web (https://t4k3.github.io/BallgunFlasher-CAN)
REM   non vede piu' la scheda anche dopo aver cambiato cavo o
REM   porta USB.
REM
REM   Sicuro: rimuove SOLO i device USB-Serial gia' scollegati
REM   e ricordati da Windows. Non tocca dispositivi attualmente
REM   collegati.
REM ============================================================

REM --- Self-elevate (serve admin per pnputil) ---
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo Questo strumento ha bisogno dei permessi amministratore.
    echo Sto chiedendo a Windows di riavviarlo come admin...
    echo.
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

cls
echo.
echo  ============================================================
echo                    WAZLLEY USB FIX TOOL
echo  ============================================================
echo.
echo   Cosa fa:
echo     1. Trova i device USB-Serial "fantasma" memorizzati
echo        da Windows (schede vecchie scollegate)
echo     2. Li rimuove dal registro di sistema
echo     3. Libera i numeri COM cosi' la nuova scheda ne riceve
echo        uno basso e pulito
echo.
echo   Sicuro: NON tocca alcun device attualmente collegato.
echo.
echo  ============================================================
echo.
pause

echo.
echo  [1/2] Ricerca device USB-Serial fantasma in corso...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { $ghosts = Get-PnpDevice -Class Ports -ErrorAction Stop | Where-Object { $_.Status -eq 'Unknown' }; if ($ghosts.Count -eq 0) { Write-Host '       Nessun device fantasma trovato. Tutto pulito.' -ForegroundColor Green } else { foreach ($g in $ghosts) { Write-Host ('       Rimuovo: ' + $g.FriendlyName) -ForegroundColor Yellow; & pnputil /remove-device $g.InstanceId 2^>$null ^| Out-Null }; Write-Host ('       Rimossi ' + $ghosts.Count + ' device fantasma.') -ForegroundColor Green } } catch { Write-Host ('       Errore: ' + $_.Exception.Message) -ForegroundColor Red }"

echo.
echo  [2/2] Pulizia tabella COM riservate (ComDB)...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$key = 'HKLM:\SYSTEM\CurrentControlSet\Control\COM Name Arbiter'; if (Test-Path $key) { try { $zero = New-Object byte[] 32; Set-ItemProperty -Path $key -Name 'ComDB' -Value $zero -ErrorAction Stop; Write-Host '       Tabella COM azzerata. Windows assegnera'' COM bassi.' -ForegroundColor Green } catch { Write-Host ('       Skip ComDB: ' + $_.Exception.Message) -ForegroundColor Gray } } else { Write-Host '       Chiave non trovata (skip).' -ForegroundColor Gray }"

echo.
echo  ============================================================
echo                       PULIZIA COMPLETATA
echo  ============================================================
echo.
echo   ADESSO FAI COSI':
echo.
echo     1. Chiudi questa finestra
echo     2. Scollega il cavo USB della scheda ESP32
echo     3. Aspetta 5 secondi
echo     4. Ricollega il cavo (preferisci una porta USB 2.0 nera)
echo     5. Riapri il flasher web e clicca Connect
echo.
echo   Se ancora non vede la scheda:
echo     - Prova un altro cavo USB-C (alcuni caricano ma non
echo       trasmettono dati)
echo     - Tieni premuto il bottone BOOT sulla scheda mentre
echo       colleghi il cavo, poi rilascialo
echo.
echo  ============================================================
echo.
pause
