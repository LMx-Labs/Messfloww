@echo off
title MessFloww Kiosk Launcher
echo Starting MessFloww Print Server...
:: Start Python print server silently (pythonw = no console window)
start /B pythonw "%~dp0..\print_server\print_server.py"
:: Wait 3 seconds for Flask server to bind to port 5000
timeout /t 3 /nobreak >nul
echo Starting Kiosk Browser...
:: Launch Chrome with silent printing (no dialog) and kiosk mode (full screen, no toolbar)
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --kiosk-printing ^
  --kiosk ^
  --disable-infobars ^
  https://messfloww.web.app/scan
