# Quantora Orbit - arranque completo con errores siempre visibles
$ErrorActionPreference = "Continue"
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $dir

function Pause-End {
  Write-Host ""
  Read-Host "Pulsa ENTER para cerrar esta ventana" | Out-Null
  exit
}

Write-Host "=================================================="
Write-Host "   QUANTORA ORBIT - ARRANQUE"
Write-Host "   Web: http://localhost:3000"
Write-Host "=================================================="

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  Write-Host "[ERROR] Bun no esta instalado. Ejecuta este comando," -ForegroundColor Red
  Write-Host "cierra PowerShell, abre uno nuevo y vuelve a lanzar START_ALL.bat:"
  Write-Host '   powershell -c "irm bun.sh/install.ps1 | iex"'
  Pause-End
}

if (-not (Test-Path .env)) {
  Write-Host "[INFO] No habia .env; creando uno basico..."
  @("DATA_SOURCE=bridge","BRIDGE_HOST=127.0.0.1","BRIDGE_PORT=8000","STARTING_BALANCE=1350") | Set-Content .env
}

Write-Host "[1/4] Actualizando codigo (git pull)..."
$pull = & git pull --ff-only 2>&1
$pull | ForEach-Object { Write-Host "   $_" }
if ($LASTEXITCODE -ne 0) {
  Write-Host "[AVISO] git pull fallo (lineas de arriba). Se continua con el codigo local." -ForegroundColor Yellow
  Write-Host "[AVISO] Si el fallo persiste, envia captura de este bloque." -ForegroundColor Yellow
}

Write-Host "[2/4] Instalando dependencias web (rapido si ya estaban)..."
& bun install 2>&1 | Select-Object -Last 3 | ForEach-Object { Write-Host "   $_" }

Write-Host "[3/4] Arrancando puente MT5 (ventana minimizada)..."
Start-Process cmd -ArgumentList "/k","start_mision_control.bat" -WorkingDirectory $dir -WindowStyle Minimized
Start-Sleep -Seconds 2

Write-Host "[4/4] Arrancando la web..."
$out = Join-Path $dir "web_log.txt"
$err = Join-Path $dir "web_err.txt"
$web = Start-Process bun -ArgumentList "run","dev" -WorkingDirectory $dir -RedirectStandardOutput $out -RedirectStandardError $err -PassThru -WindowStyle Hidden

Write-Host "   Esperando el puerto 3000 (maximo 60 segundos)..."
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  if ($web.HasExited) { break }
  if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) { $ready = $true; break }
  Start-Sleep -Seconds 1
}

if (-not $ready) {
  Write-Host ""
  Write-Host "[ERROR] La web no llego a arrancar. Ultimas lineas del registro:" -ForegroundColor Red
  if (Test-Path $err) { Get-Content $err -Tail 30 | ForEach-Object { Write-Host "   $_" -ForegroundColor Yellow } }
  if (Test-Path $out) { Get-Content $out -Tail 10 | ForEach-Object { Write-Host "   $_" -ForegroundColor Yellow } }
  Write-Host ""
  Write-Host "Envia una captura de ESTE texto y te doy el arreglo exacto."
  Pause-End
}

Start-Process "http://localhost:3000/"
Write-Host ""
Write-Host "[OK] Web lista en http://localhost:3000/" -ForegroundColor Green
Write-Host "[OK] Puente MT5 en 127.0.0.1:8000 (ventana minimizada)."
Write-Host "Puedes cerrar esta ventana; la web sigue funcionando."
Write-Host "Para pararlo todo: STOP_ALL.bat"
Pause-End
