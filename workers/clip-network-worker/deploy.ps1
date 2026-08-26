# Deploy do worker da Rede de Cortes no Fly.io (Windows / PowerShell).
# Sem segredo no repositório: os valores vêm das variáveis de ambiente da sessão.
#
#   $env:SUPABASE_URL="..."; $env:CLIP_WORKER_SECRET="..."
#   .\deploy.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$App    = if ($env:FLY_APP)    { $env:FLY_APP }    else { "adbrief-clip-worker" }
$Org    = if ($env:FLY_ORG)    { $env:FLY_ORG }    else { "personal" }
$Region = if ($env:FLY_REGION) { $env:FLY_REGION } else { "gru" }
$Volume = "clip_worker_data"

function Info($m) { Write-Host "`n> $m" -ForegroundColor Cyan }

# 1. flyctl existe?
$fly = (Get-Command fly -ErrorAction SilentlyContinue) ?? (Get-Command flyctl -ErrorAction SilentlyContinue)
if (-not $fly) { throw "flyctl nao encontrado. Instale: iwr https://fly.io/install.ps1 -useb | iex" }
$FLY = $fly.Source

# 2. autenticado?
Info "Verificando autenticacao Fly"
& $FLY auth whoami
if ($LASTEXITCODE -ne 0) { throw "Nao autenticado. Rode: $FLY auth login" }

# 3. cria o app somente se nao existir
$apps = & $FLY apps list
if ($apps -match "(?m)^\s*$([regex]::Escape($App))\s") {
  Info "App $App ja existe"
} else {
  Info "Criando app $App"
  & $FLY apps create $App --org $Org
}

# 4. volume idempotente
$vols = & $FLY volumes list -a $App
if ($vols -match $Volume) { Info "Volume $Volume ja existe" }
else { Info "Criando volume $Volume"; & $FLY volumes create $Volume -a $App -r $Region -n 1 -s 10 --yes }

# 5. secrets presentes no ambiente
Info "Aplicando secrets presentes no ambiente"
$missing = @()
foreach ($key in @("SUPABASE_URL","CLIP_WORKER_SECRET")) {
  $val = [Environment]::GetEnvironmentVariable($key)
  if ($val) { & $FLY secrets set "$key=$val" -a $App --stage | Out-Null; Write-Host "  - $key definido" }
  else { $missing += $key }
}
if ($missing.Count -gt 0) {
  Write-Host "  - nao definidos nesta sessao: $($missing -join ', ')"
  Write-Host "    ($FLY secrets set $(($missing | ForEach-Object { "$_=..." }) -join ' ') -a $App)"
}

# 6. deploy
Info "Fazendo deploy"
& $FLY deploy -a $App -c fly.toml --ha=false
if ($LASTEXITCODE -ne 0) { throw "fly deploy falhou" }

# 7. status
Info "Status do app"
& $FLY status -a $App
Write-Host "`nLogs ao vivo: $FLY logs -a $App"
