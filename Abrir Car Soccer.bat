@echo off
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo No se encontro npm. Instala Node.js desde https://nodejs.org/ y vuelve a abrir este archivo.
  pause
  exit /b 1
)

if not exist "node_modules\vite\bin\vite.js" (
  echo Instalando dependencias del juego...
  call npm install
  if errorlevel 1 goto :error
)

call npm run dev -- --open
exit /b %errorlevel%

:error
echo No se pudieron instalar las dependencias. Revisa tu conexion a internet y vuelve a intentarlo.
pause
exit /b 1
