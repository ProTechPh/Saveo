@echo off
cd /d "%~dp0"
if exist "dist\Saveo\Saveo.exe" (
    start "" "dist\Saveo\Saveo.exe"
) else if exist "Saveo.exe" (
    start "" "Saveo.exe"
) else (
    start "" pythonw app.py
)
exit
