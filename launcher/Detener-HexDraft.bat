@echo off
title Detener HexDraft
echo ==========================================
echo   Deteniendo HexDraft Monitor y Astro...
echo ==========================================
:: Señalizar al monitor que se detenga ordenadamente
echo stop > "%~dp0stop.flag"
:: Asegurar que node y procesos remanentes se cierren
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im HexDraft.exe >nul 2>&1
taskkill /f /im HexDraftApp.exe >nul 2>&1
echo.
echo [OK] HexDraft se ha detenido completamente.
timeout /t 3
