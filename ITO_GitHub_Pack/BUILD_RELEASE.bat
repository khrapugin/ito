@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
  py -3 -X utf8 tools/build.py
) else (
  python -X utf8 tools/build.py
)
if errorlevel 1 (
  echo Build failed. Python 3.11+ is required. See the error above.
  pause
  exit /b 1
)
echo Ready: dist\ITO_GitHub_Pack_0.6.1.zip
pause
