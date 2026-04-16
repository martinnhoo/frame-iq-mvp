#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# AI Chat Edge Function — 3 Scenario Test
# ═══════════════════════════════════════════════════════════════
#
# Usage:
#   export SUPABASE_TOKEN="<your-jwt-from-browser>"
#   export TEST_USER_ID="<your-user-uuid>"
#   export TEST_PERSONA_LIGHT="<persona-uuid-with-few-ads>"
#   export TEST_PERSONA_HEAVY="<persona-uuid-with-many-ads>"
#   bash test-ai-chat.sh
#
# To get SUPABASE_TOKEN:
#   1. Open AdBrief in browser
#   2. Open DevTools → Console
#   3. Run: (await supabase.auth.getSession()).data.session.access_token
#
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

URL="https://mtrovtowcpttdqygtrwq.supabase.co/functions/v1/adbrief-ai-chat"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10cm92dG93Y3B0dGRxeWd0cndxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMTU5MjgsImV4cCI6MjA4ODU5MTkyOH0.lgMpc0SGlgXjvShD-1cZpZBENJtbT5TthtmOhoaAXsQ"

# Validate env vars
if [ -z "${SUPABASE_TOKEN:-}" ]; then echo "❌ Set SUPABASE_TOKEN first (JWT from browser)"; exit 1; fi
if [ -z "${TEST_USER_ID:-}" ]; then echo "❌ Set TEST_USER_ID first"; exit 1; fi

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

call_chat() {
  local label="$1"
  local body="$2"

  echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}▶ ${label}${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  local start_ms=$(date +%s%3N 2>/dev/null || python3 -c "import time; print(int(time.time()*1000))")

  local response
  local http_code

  response=$(curl -s -w "\n%{http_code}" \
    --max-time 30 \
    -X POST "$URL" \
    -H "Content-Type: application/json" \
    -H "apikey: $ANON_KEY" \
    -H "Authorization: Bearer $SUPABASE_TOKEN" \
    -d "$body" 2>&1) || true

  local end_ms=$(date +%s%3N 2>/dev/null || python3 -c "import time; print(int(time.time()*1000))")
  local elapsed=$((end_ms - start_ms))

  # Split response body and http code
  http_code=$(echo "$response" | tail -1)
  local resp_body=$(echo "$response" | sed '$d')

  # Parse results
  local has_blocks=$(echo "$resp_body" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if d.get('blocks') and len(d['blocks'])>0 else 'no')" 2>/dev/null || echo "parse_error")
  local has_error=$(echo "$resp_body" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error','none'))" 2>/dev/null || echo "parse_error")
  local block_type=$(echo "$resp_body" | python3 -c "import sys,json; d=json.load(sys.stdin); b=d.get('blocks',[]); print(b[0].get('type','?') if b else 'empty')" 2>/dev/null || echo "?")
  local debug_info=$(echo "$resp_body" | python3 -c "import sys,json; d=json.load(sys.stdin); dbg=d.get('_debug',{}); print(f\"system={dbg.get('system_chars','?')} meta_len={dbg.get('meta_len','?')} elapsed_server={dbg.get('elapsed_ms','?')}ms\")" 2>/dev/null || echo "no debug")
  local content_preview=$(echo "$resp_body" | python3 -c "import sys,json; d=json.load(sys.stdin); b=d.get('blocks',[]); c=b[0].get('content','') if b else ''; print(c[:150])" 2>/dev/null || echo "?")

  # Report
  echo -e "  HTTP:       ${http_code}"
  echo -e "  Tempo:      ${elapsed}ms (client) | ${debug_info}"
  echo -e "  Blocks:     ${has_blocks} (type: ${block_type})"
  echo -e "  Error:      ${has_error}"
  echo -e "  Preview:    ${content_preview}"

  if [ "$http_code" = "200" ] && [ "$has_blocks" = "yes" ] && [ "$has_error" = "none" ]; then
    echo -e "  Status:     ${GREEN}✅ PASS${NC}"
  elif [ "$http_code" = "200" ] && [ "$has_blocks" = "yes" ]; then
    echo -e "  Status:     ${YELLOW}⚠️  PASS (with error field: ${has_error})${NC}"
  else
    echo -e "  Status:     ${RED}❌ FAIL${NC}"
    echo -e "  Full body:  $(echo "$resp_body" | head -c 500)"
  fi
}

# ═══════════════════════════════════════════════════════════════
# SCENARIO 1 — Conta com poucos dados (no persona or light persona)
# ═══════════════════════════════════════════════════════════════
PERSONA_LIGHT="${TEST_PERSONA_LIGHT:-}"

# 1a. No persona at all — brand new user experience
call_chat "CENÁRIO 1a: Sem persona (conta nova)" "$(cat <<JSON
{
  "message": "oi, como funciona?",
  "user_id": "$TEST_USER_ID",
  "persona_id": null,
  "user_language": "pt",
  "history": []
}
JSON
)"

# 1b. With light persona
if [ -n "$PERSONA_LIGHT" ]; then
  call_chat "CENÁRIO 1b: Persona com poucos dados" "$(cat <<JSON
{
  "message": "como estão minhas campanhas?",
  "user_id": "$TEST_USER_ID",
  "persona_id": "$PERSONA_LIGHT",
  "user_language": "pt",
  "history": []
}
JSON
)"
else
  echo -e "\n${YELLOW}⏭  Cenário 1b pulado (TEST_PERSONA_LIGHT não definido)${NC}"
fi

# ═══════════════════════════════════════════════════════════════
# SCENARIO 2 — Conta com muitos dados (heavy persona + history)
# ═══════════════════════════════════════════════════════════════
PERSONA_HEAVY="${TEST_PERSONA_HEAVY:-$PERSONA_LIGHT}"

if [ -n "$PERSONA_HEAVY" ]; then
  # 2a. Dashboard request — triggers heavy data loading
  call_chat "CENÁRIO 2a: Dashboard (conta pesada)" "$(cat <<JSON
{
  "message": "[DASHBOARD_CONFIRMED] me mostra o dashboard",
  "user_id": "$TEST_USER_ID",
  "persona_id": "$PERSONA_HEAVY",
  "user_language": "pt",
  "history": [
    {"role": "user", "content": "quero ver meu dashboard"},
    {"role": "assistant", "content": "[{\"type\":\"dashboard_offer\",\"title\":\"Gerar dashboard?\"}]"}
  ]
}
JSON
)"

  # 2b. Complex analysis question with long history
  call_chat "CENÁRIO 2b: Análise complexa + histórico longo" "$(cat <<JSON
{
  "message": "qual criativo devo escalar essa semana? e qual pausar?",
  "user_id": "$TEST_USER_ID",
  "persona_id": "$PERSONA_HEAVY",
  "user_language": "pt",
  "history": [
    {"role": "user", "content": "oi"},
    {"role": "assistant", "content": "[{\"type\":\"insight\",\"title\":\"Olá\",\"content\":\"Oi! Como posso ajudar?\"}]"},
    {"role": "user", "content": "como estão minhas campanhas"},
    {"role": "assistant", "content": "[{\"type\":\"dashboard\",\"title\":\"Performance\",\"content\":\"CTR médio 1.5%\"}]"},
    {"role": "user", "content": "quero melhorar o CTR"},
    {"role": "assistant", "content": "[{\"type\":\"insight\",\"title\":\"CTR\",\"content\":\"Recomendo testar novos hooks\"}]"},
    {"role": "user", "content": "me gera hooks"},
    {"role": "assistant", "content": "[{\"type\":\"tool_call\",\"tool\":\"hooks\"}]"},
    {"role": "user", "content": "bom, agora quero focar nos criativos"},
    {"role": "assistant", "content": "[{\"type\":\"insight\",\"title\":\"Criativos\",\"content\":\"Vamos analisar\"}]"},
    {"role": "user", "content": "quais estão gastando mais?"},
    {"role": "assistant", "content": "[{\"type\":\"insight\",\"title\":\"Top spend\",\"content\":\"Os 3 maiores...\"}]"}
  ]
}
JSON
)"

  # 2c. Tool call request (hooks)
  call_chat "CENÁRIO 2c: Pedido de hooks (tool_call)" "$(cat <<JSON
{
  "message": "gera 5 hooks pra mim",
  "user_id": "$TEST_USER_ID",
  "persona_id": "$PERSONA_HEAVY",
  "user_language": "pt",
  "history": []
}
JSON
)"
else
  echo -e "\n${YELLOW}⏭  Cenários 2a-2c pulados (nenhuma persona definida)${NC}"
fi

# ═══════════════════════════════════════════════════════════════
# SCENARIO 3 — Troca de persona + continuação de chat
# ═══════════════════════════════════════════════════════════════
if [ -n "$PERSONA_LIGHT" ] && [ -n "${TEST_PERSONA_HEAVY:-}" ]; then
  # 3a. Start with persona A
  call_chat "CENÁRIO 3a: Chat com persona A" "$(cat <<JSON
{
  "message": "resume minha conta",
  "user_id": "$TEST_USER_ID",
  "persona_id": "$PERSONA_LIGHT",
  "user_language": "pt",
  "history": []
}
JSON
)"

  # 3b. Switch to persona B mid-conversation (history from persona A)
  call_chat "CENÁRIO 3b: Troca pra persona B (com histórico de A)" "$(cat <<JSON
{
  "message": "e essa conta aqui, como está?",
  "user_id": "$TEST_USER_ID",
  "persona_id": "$TEST_PERSONA_HEAVY",
  "user_language": "pt",
  "history": [
    {"role": "user", "content": "resume minha conta"},
    {"role": "assistant", "content": "[{\"type\":\"insight\",\"title\":\"Resumo\",\"content\":\"Sua conta tem 3 campanhas ativas...\"}]"}
  ]
}
JSON
)"

  # 3c. Back to persona A with clean history
  call_chat "CENÁRIO 3c: Volta pra persona A (histórico limpo)" "$(cat <<JSON
{
  "message": "me mostra os padrões dessa conta",
  "user_id": "$TEST_USER_ID",
  "persona_id": "$PERSONA_LIGHT",
  "user_language": "pt",
  "history": []
}
JSON
)"
else
  echo -e "\n${YELLOW}⏭  Cenários 3a-3c pulados (precisa de TEST_PERSONA_LIGHT + TEST_PERSONA_HEAVY)${NC}"

  # Fallback: test persona switch with null → persona
  if [ -n "${PERSONA_HEAVY:-}" ]; then
    call_chat "CENÁRIO 3 (fallback): null → persona" "$(cat <<JSON
{
  "message": "analisa minha conta",
  "user_id": "$TEST_USER_ID",
  "persona_id": "$PERSONA_HEAVY",
  "user_language": "pt",
  "history": [
    {"role": "user", "content": "oi"},
    {"role": "assistant", "content": "[{\"type\":\"insight\",\"title\":\"Olá\",\"content\":\"Oi!\"}]"}
  ]
}
JSON
)"
  fi
fi

echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Testes concluídos.${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
