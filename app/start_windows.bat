@echo off
setlocal
cd /d "%~dp0"
if exist "..\.venv\Scripts\python.exe" (
  set "ITO_PY=..\.venv\Scripts\python.exe"
  goto check
)
if exist ".venv\Scripts\python.exe" (
  set "ITO_PY=.venv\Scripts\python.exe"
  goto check
)
where py >nul 2>nul
if not errorlevel 1 (
  py -3 -m venv .venv
) else (
  python -m venv .venv
)
if errorlevel 1 goto failed
set "ITO_PY=.venv\Scripts\python.exe"
:check
"%ITO_PY%" -c "import fastapi, uvicorn, openpyxl, multipart" >nul 2>nul
if not errorlevel 1 goto run
"%ITO_PY%" -m pip install -r requirements.txt
if errorlevel 1 goto failed
:run
"%ITO_PY%" -X utf8 launch.py
if errorlevel 1 goto failed
exit /b 0
:failed
echo.
echo Could not start ITO. Check Python 3.11+ and the error above.
pause
exit /b 1
