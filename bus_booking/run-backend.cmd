@echo off
REM Activate venv and run Django dev server
cd /d "%~dp0backend"
if exist "venv\Scripts\activate.bat" (
  call venv\Scripts\activate.bat
) else if exist "..\venv\Scripts\activate.bat" (
  call ..\venv\Scripts\activate.bat
)
python manage.py runserver
pause
