@echo off
title Detener HexDraft
echo ==========================================
echo   Deteniendo HexDraft Monitor y Astro...
echo ==========================================
taskkill /f /im HexDraft.exe >nul 2>&1
taskkill /f /im node.exe >nul 2>&1
echo.
echo [OK] HexDraft se ha detenido completamente.
timeout /t 3
