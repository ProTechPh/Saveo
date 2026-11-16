@echo off
cd /d "%~dp0"
if exist "dist\Saveo\Saveo.exe" (
    start "" "dist\Saveo\Saveo.exe"
) else if exist "Saveo.exe" (
    start "" "Saveo.exe"
) else if exist "dist\Droply\Droply.exe" (
    start "" "dist\Droply\Droply.exe"
) else if exist "Droply.exe" (
    start "" "Droply.exe"
) else (
    start "" pythonw app.py
)
exit
