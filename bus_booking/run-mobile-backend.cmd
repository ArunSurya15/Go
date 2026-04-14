@echo off
REM Start Django backend for mobile devices on same LAN
cd /d "%~dp0backend"
if exist "venv\Scripts\activate.bat" (
  call venv\Scripts\activate.bat
) else if exist "..\venv\Scripts\activate.bat" (
  call ..\venv\Scripts\activate.bat
)
python manage.py runserver 0.0.0.0:8000
pause
