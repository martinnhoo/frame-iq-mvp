#!/usr/bin/env bash
# Deploy do worker da Rede de Cortes no Fly.io — um comando.
#
# Não contém segredo nenhum. Os secrets são lidos do ambiente (ou pedidos
# interativamente) e vão direto para o Fly, nunca para o repositório.
#
#   ./deploy.sh
#
# Pré-requisito único: flyctl instalado e autenticado (`fly auth login`).
set -euo pipefail

cd "$(dirname "$0")"

APP="${FLY_APP:-adbrief-clip-worker}"
ORG="${FLY_ORG:-personal}"
REGION="${FLY_REGION:-gru}"
VOLUME="clip_worker_data"

info() { printf '\n\033[1;36m▸ %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

# 1. flyctl existe?
command -v fly >/dev/null 2>&1 || command -v flyctl >/dev/null 2>&1 \
  || fail "flyctl não encontrado. Instale com: curl -L https://fly.io/install.sh | sh"
FLY=$(command -v fly || command -v flyctl)

# 2. autenticado?
info "Verificando autenticação Fly"
"$FLY" auth whoami >/dev/null 2>&1 || fail "Não autenticado. Rode: $FLY auth login"
"$FLY" auth whoami

# 3. cria o app só se ainda não existir
if "$FLY" apps list 2>/dev/null | awk '{print $1}' | grep -qx "$APP"; then
  info "App $APP já existe — nada a criar"
else
  info "Criando app $APP na org $ORG"
  "$FLY" apps create "$APP" --org "$ORG"
fi

# 4. volume de temporários (1 worker = 1 volume). Idempotente.
if "$FLY" volumes list -a "$APP" 2>/dev/null | grep -q "$VOLUME"; then
  info "Volume $VOLUME já existe"
else
  info "Criando volume $VOLUME (10GB, $REGION)"
  "$FLY" volumes create "$VOLUME" -a "$APP" -r "$REGION" -n 1 -s 10 --yes
fi

# 5. secrets — só define os que estiverem presentes no ambiente.
#    Nada é ecoado; o Fly recebe pelo stdin.
set_secret() {
  local name="$1" value="${2:-}"
  [ -z "$value" ] && return 0
  printf '%s' "$value" | "$FLY" secrets import -a "$APP" --stage >/dev/null <<EOF
$name=$value
EOF
  printf '  · %s definido\n' "$name"
}

info "Aplicando secrets presentes no ambiente"
MISSING=()
for KEY in SUPABASE_URL CLIP_WORKER_SECRET; do
  VAL="${!KEY:-}"
  if [ -n "$VAL" ]; then set_secret "$KEY" "$VAL"; else MISSING+=("$KEY"); fi
done
if [ ${#MISSING[@]} -gt 0 ]; then
  printf '  · não definidos neste ambiente: %s\n' "${MISSING[*]}"
  printf '    (se ainda não estiverem no app, rode: %s secrets set %s -a %s)\n' \
    "$FLY" "$(printf '%s=... ' "${MISSING[@]}")" "$APP"
fi

# 6. deploy usando o fly.toml do diretório
info "Fazendo deploy"
"$FLY" deploy -a "$APP" -c fly.toml --ha=false

# 7. status final
info "Status do app"
"$FLY" status -a "$APP" || true
printf '\nLogs ao vivo: %s logs -a %s\n' "$FLY" "$APP"
