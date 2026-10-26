@echo off
rem Abre Prompt Vault con doble clic.
cd /d "%~dp0"

if exist "release\Prompt-Vault-1.0.0.exe" (
  start "" "release\Prompt-Vault-1.0.0.exe"
  exit /b 0
)

if exist "node_modules\electron\dist\electron.exe" if exist "dist\index.html" (
  start "" "node_modules\electron\dist\electron.exe" .
  exit /b 0
)

echo No se encontro la aplicacion compilada.
echo Ejecuta primero en esta carpeta:  npm install   y luego   npm run build
pause
