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

Write-Host "[1/6] Cerrando procesos de sesiones anteriores..."
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -match 'server\.ts' -or $_.CommandLine -match 'start_mision_control' -or $_.CommandLine -match 'uvicorn api\.main' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; Write-Host "   Cerrado $($_.ProcessId)" }
$conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
  $conn | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
    Write-Host "   Puerto 3000 ocupado por PID $_ - cerrando..."
    Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Seconds 1
} else {
  Write-Host "   Puerto 3000 libre."
}

if (-not (Test-Path .env)) {
  Write-Host "[INFO] No habia .env; creando uno basico..."
  @("DATA_SOURCE=bridge","BRIDGE_HOST=127.0.0.1","BRIDGE_PORT=8000","STARTING_BALANCE=1350") | Set-Content .env
}

Write-Host "[2/6] Actualizando codigo (git pull)..."
$pull = & git pull --ff-only 2>&1
$pull | ForEach-Object { Write-Host "   $_" }
if ($LASTEXITCODE -ne 0) {
  Write-Host "[AVISO] git pull fallo (lineas de arriba). Se continua con el codigo local." -ForegroundColor Yellow
}

Write-Host "[3/6] Instalando dependencias web..."
& bun install 2>&1 | Select-Object -Last 2 | ForEach-Object { Write-Host "   $_" }

Write-Host "[4/6] Arrancando puente MT5 (ventana minimizada)..."
Start-Process cmd -ArgumentList "/k","start_mision_control.bat" -WorkingDirectory $dir -WindowStyle Minimized
Start-Sleep -Seconds 2

$token = ""
Get-Content .env | ForEach-Object { if ($_ -match '^BRIDGE_TOKEN=(.+)$') { $token = $Matches[1].Trim() } }
try {
  $headers = @{}
  if ($token) { $headers.Authorization = "Bearer $token" }
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -Headers $headers -TimeoutSec 5
  if ($health.connected) {
    Write-Host "   [OK] MT5 conectado: el puente lee tu terminal." -ForegroundColor Green
  } else {
    Write-Host "   [AVISO] El puente vive pero MT5 no responde: "$health.last_error -ForegroundColor Yellow
  }
} catch {
  Write-Host "   [AVISO] El puente aun no responde; seguira reintentando solo." -ForegroundColor Yellow
}

Write-Host "[5/6] Arrancando la web (logs en web_log.txt / web_err.txt)..."
$out = Join-Path $dir "web_log.txt"
$err = Join-Path $dir "web_err.txt"
$web = Start-Process bun -ArgumentList "run","dev" -WorkingDirectory $dir -RedirectStandardOutput $out -RedirectStandardError $err -PassThru -WindowStyle Hidden

Write-Host "   Comprobando que la web responde de verdad (maximo 90s)..."
$ok = $false
for ($i = 0; $i -lt 45; $i++) {
  if ($web.HasExited) { break }
  try {
    $resp = Invoke-WebRequest -Uri "http://localhost:3000/" -UseBasicParsing -TimeoutSec 4
    if ($resp.StatusCode -eq 200) { $ok = $true; break }
  } catch { }
  Start-Sleep -Seconds 2
}

if (-not $ok) {
  Write-Host ""
  Write-Host "[ERROR] La web no respondio correctamente. Ultimas lineas del registro:" -ForegroundColor Red
  if (Test-Path $err) { Get-Content $err -Tail 25 | ForEach-Object { Write-Host "   $_" -ForegroundColor Yellow } }
  if (Test-Path $out) { Get-Content $out -Tail 12 | ForEach-Object { Write-Host "   $_" -ForegroundColor Yellow } }
  Write-Host ""
  Write-Host "Envia una captura de ESTE texto y te doy el arreglo exacto."
  Pause-End
}

Write-Host "[6/6] Web verificada con HTTP 200. Abriendo navegador..."
Start-Process "http://localhost:3000/"
Write-Host ""
Write-Host "[OK] Todo listo en http://localhost:3000/" -ForegroundColor Green
Write-Host "Puedes cerrar esta ventana; la web sigue funcionando."
Write-Host "Para pararlo todo: STOP_ALL.bat"
Pause-End
