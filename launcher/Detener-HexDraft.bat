@echo off
title Detener HexDraft
echo ==========================================
echo   Deteniendo HexDraft Guard y Astro...
echo ==========================================
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name = 'wscript.exe'\" | Where-Object { $_.CommandLine -like '*HexDraftGuard.vbs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
taskkill /f /im node.exe >nul 2>&1
echo.
echo [OK] HexDraft se ha detenido completamente.
timeout /t 3
