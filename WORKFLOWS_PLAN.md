# Brilliant Workflows — Plano de Implementação

**Status:** rascunho aguardando aprovação · **Autor:** Martinho + Claude · **Data:** 2026-05-06

Documento de design pra a feature **Workflows** do Brilliant Hub — equivalente ao Higgsfield Canvas, com diferenciais específicos pro caso de uso interno da Brilliant Gaming (iGaming, multi-mercado, multi-marca).

---

## 1. Objetivo

Permitir que um designer da Brilliant monte **uma vez** uma cadeia de geração (prompt → imagem → bg-remove → variação por mercado → output salvo na biblioteca) e **rode N vezes** trocando só os inputs. Hoje cada criativo é evento isolado: gera, salva, esquece. Workflow vira a **lógica de produção como artefato persistente e reutilizável**.

Caso de uso #1 que precisa funcionar end-to-end no MVP:
> "Gera promo BETBUS '10$ a cada gol do CR7' em 3 mercados (MX/BR/CL), com disclaimer regulatório por país, em 9:16, salva tudo na biblioteca com naming consistente."

Hoje isso são ~15 cliques + 3 prompts manuais. No Workflow vai ser: abrir template, trocar marca + texto da promo, clicar em **Run**.

## 2. Não-objetivos (MVP)

Pra não escopo creep:

- **Sem colaboração ao vivo** (Figma-like). Tu carrega, edita, salva. Outro user abre depois.
- **Sem MCP / Claude controla via conversa**. Vem na fase 3.
- **Sem Soul ID equivalente** (fine-tuning de personagem). Vem quando a gente decidir treinar.
- **Sem upscale node**. Topaz é overkill pra hoje.
- **Sem versionamento de grafo** (undo/redo histórico). Salvar é overwrite simples.
- **Sem nodes de vídeo**. Storyboard sim (imagens em sequência), vídeo full não.

## 3. Stack escolhida

| Camada | Decisão | Por quê |
|---|---|---|
| Canvas/grafo UI | `@xyflow/react` (React Flow) | Lib consolidada, MIT, 28k stars, é o que Higgsfield, n8n e ComfyUI usam por baixo. Infinite canvas + zoom/pan + custom nodes prontos. |
| State do grafo | React Flow built-in (`useNodesState`, `useEdgesState`) | Já vem pronto, não precisa Zustand novo. |
| Persistência grafo | Nova tabela `hub_workflows` (Supabase Postgres) | Mesmo padrão do `hub_assets` e `creative_memory`. JSON do grafo no campo `graph` (jsonb). |
| Execução | Nova edge function `execute-workflow` | Server-side. Recebe `workflow_id` + `inputs`, roda em ordem topológica chamando edge functions já existentes. |
| Status de run | Nova tabela `hub_workflow_runs` | Cada execução cria 1 row. Status: `pending`/`running`/`succeeded`/`failed`. Pra UI poder polar. |
| Assets gerados pelo run | Reusa `hub_assets` (com `workflow_run_id` no jsonb) | Não duplica. A biblioteca já mostra. |

## 4. Schema do grafo (JSON)

Um workflow é serializado como:

```json
{
  "version": 1,
  "nodes": [
    {
      "id": "n1",
      "type": "brand",
      "position": { "x": 100, "y": 100 },
      "data": {
        "brand_id": "betbus",
        "market": "MX",
        "include_disclaimer": true
      }
    },
    {
      "id": "n2",
      "type": "prompt",
      "position": { "x": 100, "y": 280 },
      "data": {
        "text": "10$ a cada gol do Cristiano Ronaldo se a pessoa apostou na vitória de Portugal"
      }
    },
    {
      "id": "n3",
      "type": "image-gen",
      "position": { "x": 400, "y": 200 },
      "data": {
        "aspect_ratio": "9:16",
        "quality": "medium",
        "elements": []
      }
    },
    {
      "id": "n4",
      "type": "output",
      "position": { "x": 700, "y": 200 },
      "data": {
        "name_template": "{brand}_{market}_{date}_{slug}"
      }
    }
  ],
  "edges": [
    { "id": "e1", "source": "n1", "target": "n3", "targetHandle": "brand" },
    { "id": "e2", "source": "n2", "target": "n3", "targetHandle": "prompt" },
    { "id": "e3", "source": "n3", "target": "n4", "targetHandle": "asset" }
  ]
}
```

**Regras:**
- Cada nó tem `id` único, `type`, `position` (UI), `data` (config do nó)
- Cada edge conecta `source` → `target`, opcionalmente `targetHandle` (qual input do nó destino)
- Sem ciclos (validador rejeita se houver loop)
- Tipos de handle são tipados (ex: `brand` só conecta em handles que aceitam brand context)

## 5. Tabelas novas

### `hub_workflows`

```sql
create table public.hub_workflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  brand_id text,                  -- marca "default" do workflow (informativo)
  graph jsonb not null,           -- schema acima
  is_template boolean default false,  -- true = aparece na galeria pública do Hub
  thumbnail_url text,             -- preview do último output (pra UI da galeria)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index hub_workflows_user_id_idx on public.hub_workflows(user_id);
create index hub_workflows_is_template_idx on public.hub_workflows(is_template) where is_template = true;
```

RLS: user vê só os seus + os que `is_template = true`.

### `hub_workflow_runs`

```sql
create table public.hub_workflow_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workflow_id uuid not null references public.hub_workflows(id) on delete cascade,
  status text not null default 'pending',  -- pending | running | succeeded | failed | partial
  inputs jsonb,                            -- inputs passados pelo user na hora de rodar
  outputs jsonb,                           -- map node_id -> output ({ asset_id, image_url, error })
  error text,                              -- top-level error se falhou antes de começar
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz default now()
);

create index hub_workflow_runs_workflow_id_idx on public.hub_workflow_runs(workflow_id);
create index hub_workflow_runs_user_id_idx on public.hub_workflow_runs(user_id);
```

RLS: user vê só os seus.

## 6. Contratos dos nós

Cada tipo de nó tem:
- **`data` schema** — o que vai no `data` do nó no grafo
- **Inputs aceitos** — quais handles entram (com tipos)
- **Output produzido** — o que sai (estrutura)
- **Edge function chamada** — qual função do backend executa

### 6.1 `brand`
- `data`: `{ brand_id: string, market: string, include_disclaimer: boolean }`
- Inputs: nenhum (é nó-fonte)
- Output: `{ brand_hint: string, license_text: string, market: string, brand_id: string }`
- Não chama edge function — resolve client-side ou no `execute-workflow` puxando do `HUB_BRANDS` e `HUB_MARKETS`.

### 6.2 `prompt`
- `data`: `{ text: string }`
- Inputs: nenhum
- Output: `{ text: string }`
- Sem edge function.

### 6.3 `image-gen`
- `data`: `{ aspect_ratio: "1:1"|"9:16"|"16:9"|"4:5", quality: "low"|"medium"|"high" }`
- Inputs:
  - `prompt` ← string (obrigatório)
  - `brand` ← brand context (opcional)
  - `elements` ← array de PNGs (opcional, até 16)
- Output: `{ asset_id: string, image_url: string, prompt_used: string }`
- Edge function: `generate-image-hub` (já existe — reusa direto).

### 6.4 `bg-remove`
- `data`: `{}` (sem config)
- Inputs: `image` ← image_url ou base64
- Output: `{ asset_id, image_url }` (PNG transparente, < 2MB)
- Edge function: `hub-bria-bg-remove` (já existe).

### 6.5 `storyboard`
- `data`: `{ scene_count: number (2-8), aspect_ratio, quality }`
- Inputs: `script` ← string, `brand` ← opcional
- Output: `{ storyboard_id, scenes: [{ n, image_url, asset_id }] }`
- Edge function: `generate-storyboard-hub` (já existe).

### 6.6 `voice`
- `data`: `{ voice_id: string, language: "pt"|"es"|"en", speed: number }`
- Inputs: `text` ← string
- Output: `{ asset_id, audio_url, duration_s }`
- Edge function: `hub-voice-gen` (já existe).

### 6.7 `variation` (fan-out)
- `data`: `{ axis: "aspect_ratio"|"market", values: string[] }`
- Inputs: o nó upstream (qualquer)
- Output: array de N execuções paralelas — uma por valor do `values`
- Lógica especial no `execute-workflow`: clona o subgrafo downstream N vezes.
- Não é edge function, é primitiva do executor.

### 6.8 `output`
- `data`: `{ name_template: string, save_to_library: boolean }`
- Inputs: `asset` ← asset_id ou image_url
- Output: `{ asset_id }` (final, persistido em `hub_assets`)
- Edge function: nenhuma — só persiste no `hub_assets` via service role.

**Templating do nome** (`name_template`): vars suportadas
- `{brand}` — brand_id
- `{market}` — market code
- `{date}` — `YYYYMMDD`
- `{time}` — `HHmm`
- `{slug}` — slug do prompt (primeiras 30 chars sanitizadas)
- `{i}` — índice quando há fan-out

## 7. Execução server-side

**Por que server-side?** Pra não vazar token OpenAI no client, pra rodar nós em paralelo de verdade, e pra que o user possa fechar o browser e o workflow continuar rodando.

### Fluxo do `execute-workflow`

```
POST /functions/v1/execute-workflow
{
  "workflow_id": "uuid",
  "inputs": {                         // overrides opcionais nos nós-fonte
    "n2": { "text": "novo prompt" }
  }
}

→ resp imediata: { run_id: "uuid", status: "pending" }
```

Em background (async, sem await na resposta):

1. Cria row em `hub_workflow_runs` (status=running, started_at=now)
2. Carrega graph do `hub_workflows`
3. Aplica `inputs` overrides nos nós correspondentes
4. **Valida grafo:**
   - Sem ciclos (Kahn's algorithm)
   - Todo nó tem inputs obrigatórios conectados
   - Tipos compatíveis nos handles
5. **Ordena topologicamente** os nós em "níveis" (cada nível = nós que podem rodar em paralelo)
6. Pra cada nível, executa `Promise.all` dos nós:
   - Coleta inputs do `outputs` map (já preenchido por níveis anteriores)
   - Chama a edge function correspondente (HTTP fetch interno)
   - Guarda resultado no `outputs[node_id]`
   - Se falha, marca `errors[node_id]` e segue (não para o run inteiro — outros nós podem ainda concluir)
7. Persiste `outputs` no `hub_workflow_runs` (após cada nível, pra UI poder polar progresso)
8. Status final:
   - `succeeded` se todos nós OK
   - `partial` se alguns falharam mas pelo menos 1 output gerado
   - `failed` se nenhum output ou falha de validação

### Polling do status (UI)

```
GET /functions/v1/get-workflow-run?run_id=uuid
→ { status, outputs, errors, progress: "3/5 nodes done" }
```

UI pola a cada 2s enquanto status ∈ {pending, running}.

### Timeout / abort

Cada nó tem timeout próprio (image-gen = 130s, bg-remove = 60s, voice = 90s). Se um nó estoura, marca como erro e segue. Run inteiro tem hard ceiling de 10min — se passar, marca `failed` com `error: "timeout"`.

### Retry

MVP: sem retry automático. User vê o nó vermelho, clica "Re-run failed nodes" → função `retry-workflow-run` que pega só os falhos e re-executa.

## 8. Frontend — `HubWorkflows.tsx`

### Layout

```
┌──────────────────────────────────────────────────────────┐
│ ← Voltar  ·  Workflows                                   │
├─────────────┬────────────────────────────────────────────┤
│             │                                            │
│  Templates  │            React Flow Canvas               │
│  ─────────  │                                            │
│  + Novo     │     ┌───────┐    ┌──────────┐             │
│  Promo Game │     │ Brand │───▶│ Image-gen│──┐          │
│  Storyboard │     └───────┘    └──────────┘  │          │
│  UGC...     │     ┌───────┐         ▲        ▼          │
│             │     │Prompt │─────────┘     ┌──────┐      │
│  Meus       │     └───────┘               │Output│      │
│  ─────────  │                             └──────┘      │
│  Workflow A │                                            │
│  Workflow B │                                            │
│             │  [palette nós →] [Save] [Run]              │
└─────────────┴────────────────────────────────────────────┘
```

**Sidebar esquerda:** lista de templates oficiais (curados, `is_template=true`) + workflows do user.

**Canvas central:** React Flow. Drag&drop nós da palette pra dentro. Conecta arrastando handle de output → input.

**Bottom toolbar:** Save (overwrites o workflow atual), Run (chama `execute-workflow`), palette de nós.

**Painel direito (quando nó selecionado):** form de config do `data` daquele nó (ex: dropdown de `brand_id`, slider de quality, textarea de prompt).

### Custom node components

Um component por tipo (8 no MVP):

```
src/components/hub-workflows/nodes/
  BrandNode.tsx
  PromptNode.tsx
  ImageGenNode.tsx
  BgRemoveNode.tsx
  StoryboardNode.tsx
  VoiceNode.tsx
  VariationNode.tsx
  OutputNode.tsx
```

Cada um implementa:
- Visual do nó (header com ícone+nome, body com inputs/preview)
- Handles (conectores) tipados
- Render de status durante run (idle / running / done / error com cor)

### Run UX

1. User clica **Run**
2. Mostra modal "Configurando inputs" — formulário só com nós-fonte (`prompt`, `brand`) que aceitam override
3. User confirma
4. `POST /execute-workflow` → recebe `run_id`
5. UI muda pra modo "running" — nós ficam pulsando, com border colorida conforme status
6. Pola `get-workflow-run` a cada 2s
7. Quando status = `succeeded` ou `partial`:
   - Outputs aparecem em painel deslizante à direita com thumbnails
   - Botão "Ver na biblioteca" leva pro `HubLibrary` filtrado pelo `run_id`
8. Se `failed` em algum nó: nó vermelho, click no nó mostra erro, botão "Re-run failed".

## 9. MVP — escopo travado

**Build em 2 fases pra hoje/amanhã.**

### Fase 1 — "Workflow rodável end-to-end" (~6h)

Sem colab, sem fan-out, sem variation. Caso linear simples.

**Backend:**
- Migration: `hub_workflows` + `hub_workflow_runs`
- Edge function `execute-workflow` (somente nós: brand, prompt, image-gen, output)
- Edge function `get-workflow-run`

**Frontend:**
- Página `HubWorkflows.tsx` em `/dashboard/hub/workflows`
- React Flow setup (palette + canvas)
- 4 nodes (brand, prompt, image-gen, output)
- Sidebar com 1 template hardcoded: "Promo de jogo"
- Save / Run / status polling
- Adicionar link "Workflows" no menu do Hub

**Aceite Fase 1:** abrir template "Promo de jogo", trocar prompt, rodar, em <2min ver 1 imagem PNG salva na biblioteca com naming `betbus_mx_20260506_promo_cr7.png`.

### Fase 2 — "Multi-mercado" (~3h)

Adiciona `bg-remove`, `variation` e `storyboard`. Permite o caso de uso #1 completo (3 mercados em paralelo).

**Backend:** suporte a `variation` no `execute-workflow` (clona subgrafo, executa em paralelo).
**Frontend:** 3 nodes novos + segundo template "Promo multi-mercado" com fan-out.

**Aceite Fase 2:** abrir template, trocar prompt, sair 3 PNGs (MX/BR/CL) cada um com disclaimer correto.

### Fase 3 — Voice + Storyboard chained (~2h)

Adiciona `voice`. Permite workflows tipo "roteiro → storyboard 4 cenas → voice-over por cena → 4 vídeos prontos pra editor externo".

### Fase 4+ (não-MVP, futuro)

- Colab live (Yjs ou Supabase Realtime)
- MCP server pra Claude controlar via conversa
- Brand fine-tuning (Soul ID equivalente — fotos das marcas Brilliant)
- Compliance check node (LLM revisa output contra regras iGaming antes de salvar)
- Learned-style node (puxa padrões do `creative_loop`)
- Versionamento (snapshots do grafo)
- Export/import workflow como JSON

## 10. Diferenciais Brilliant — onde batemos Higgsfield

| Eixo | Higgsfield | Brilliant Workflows |
|---|---|---|
| Marcas | User cadastra do zero | Pré-cadastradas (BETBUS, ELUCK, COME, FUNILIVE) com paleta, logo, hint |
| Mercados | Não existe | First-class — disclaimer regulatório injetado por país |
| Compliance iGaming | Cego | Fase 4: nó dedicado verifica regras |
| Custo | $30-249/mo por seat | Custo só de API (OpenAI + BRIA + ElevenLabs) |
| Performance loop | Não tem | Fase 4: integra `creative_loop` e `learned_patterns` |
| Stack | Closed | Plugado no Postgres + edge functions já existentes |
| Naming | Manual | Templating automático com vars de marca/mercado |

## 11. Riscos & mitigações

| Risco | Probabilidade | Mitigação |
|---|---|---|
| React Flow learning curve | Média | Começar com 4 nós, custom node simples (50 linhas cada). Lib é bem documentada. |
| `execute-workflow` complexo (~500 linhas) | Alta | Testar cada nó isolado antes de testar grafo full. Logs verbosos. Persistir output após cada nível pra debugar. |
| Custo de tokens explode | Média | Soft-limit por user no `execute-workflow`. Avisar quando run vai gastar > $X. |
| `localStorage` quota explode com graphs grandes | Alta (já tá perto) | Mover assets dos nós pro Supabase Storage **antes** desse build (1-2h extra). Já era pra ter feito. |
| Edge function timeout (Supabase mata em 150s) | Alta pra image-gen × 3 | Executor é async — devolve `run_id` na hora, processa em background. Cuidar do "background task" no Deno (`waitUntil` ou similar). |
| Validação topológica incorreta | Média | Testes unitários cobrindo: ciclo, nó isolado, handle não conectado, tipo errado. |

## 12. Decisões abertas (pra Martinho confirmar antes de Fase 1)

1. **Persistência do graph_json** — overwrite simples ou versionado? *Proposta: overwrite no MVP, versionar Fase 4.*
2. **Templates oficiais hardcoded vs DB-seeded** — onde moram os templates iniciais? *Proposta: 1 SQL seed em migration, marcados `is_template=true` + `user_id=null`.*
3. **`execute-workflow` em background — Deno tem `waitUntil`?** Se não tem, alternativas: chamar de novo a função recursivamente via fetch (gasta 1 invocation extra) ou usar `pg_cron` pra processar fila. *Proposta: pesquisar `EdgeRuntime.waitUntil` na boot, fallback pra fetch self-recursive.*
4. **UI palette de nós** — sempre visível ou botão "+"? *Proposta: sidebar sempre visível, drag&drop pra canvas (mesmo do Higgsfield).*
5. **Permissão de templates** — qualquer user pode marcar próprio workflow como template? *Proposta: só admin (martinho) por enquanto, depois liberar.*

---

**Próximo passo se aprovado:** começar Fase 1 — migration + `execute-workflow` shell + página `HubWorkflows.tsx` esqueleto com React Flow rodando vazio. Aceite intermediário: "consigo arrastar nó da palette pro canvas e conectar dois nós".
