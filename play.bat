@echo off
cd /d "%~dp0"
echo Starting Room Service Rush...
echo.
echo Opening http://127.0.0.1:5173 in your browser.
echo If the page looks stuck, press Ctrl+Shift+R to hard-refresh.
echo Close this window to stop the game server.
echo.

start "" "http://127.0.0.1:5173"
python serve.py
pause
