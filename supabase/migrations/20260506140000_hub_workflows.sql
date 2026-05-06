-- hub_workflows + hub_workflow_runs — Brilliant Workflows feature.
--
-- Workflows são pipelines de geração reutilizáveis (Image Studio +
-- bg-remove + storyboard + voice etc). Equivalente Brilliant ao
-- Higgsfield Canvas — mas com brand presets, mercados e disclaimer
-- regulatório nativos.
--
-- hub_workflows guarda o GRAFO (nodes + edges em JSON).
-- hub_workflow_runs guarda cada EXECUÇÃO do grafo, com status e outputs.
--
-- Templates são workflows com user_id=null e is_template=true,
-- visíveis pra todos (galeria curada).

-- ── Tabela do grafo ─────────────────────────────────────────────────
create table if not exists public.hub_workflows (
  id uuid primary key default gen_random_uuid(),
  -- user_id pode ser null pra TEMPLATES OFICIAIS (criados por admin/seed).
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  brand_id text,                  -- marca "default" do workflow (informativo, não-binding)
  graph jsonb not null,           -- { version, nodes: [], edges: [] }
  is_template boolean not null default false,
  thumbnail_url text,             -- preview do último output (pra galeria)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hub_workflows_user_created
  on public.hub_workflows (user_id, created_at desc) where user_id is not null;
create index if not exists idx_hub_workflows_templates
  on public.hub_workflows (is_template, created_at desc) where is_template = true;

alter table public.hub_workflows enable row level security;

-- User vê seus workflows + todos os templates (user_id=null e is_template=true)
drop policy if exists "Users see own + templates" on public.hub_workflows;
create policy "Users see own + templates"
  on public.hub_workflows for select to authenticated
  using (auth.uid() = user_id or (is_template = true and user_id is null));

-- User só pode INSERT/UPDATE/DELETE em rows próprias (não em templates)
drop policy if exists "Users manage own workflows" on public.hub_workflows;
create policy "Users manage own workflows"
  on public.hub_workflows for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- updated_at trigger
create or replace function public.tg_hub_workflows_updated()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_hub_workflows_updated on public.hub_workflows;
create trigger trg_hub_workflows_updated
  before update on public.hub_workflows
  for each row execute function public.tg_hub_workflows_updated();

comment on table public.hub_workflows is
  'Pipelines reutilizáveis do Brilliant Hub. Cada row tem o grafo (nodes+edges) em JSON. Templates oficiais têm user_id=null + is_template=true.';

-- ── Tabela das execuções ────────────────────────────────────────────
create table if not exists public.hub_workflow_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workflow_id uuid not null references public.hub_workflows(id) on delete cascade,
  -- pending: criado, ainda não começou
  -- running: está executando nós
  -- succeeded: todos os nós OK
  -- partial: ao menos 1 falhou mas outros completaram
  -- failed: erro de validação ou todos falharam
  status text not null default 'pending'
    check (status in ('pending','running','succeeded','partial','failed')),
  inputs jsonb,                  -- overrides dos nós-fonte (ex: {n2:{text:"..."}})
  outputs jsonb default '{}'::jsonb,  -- map node_id → output do nó
  error text,                    -- top-level error msg
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_hub_workflow_runs_workflow
  on public.hub_workflow_runs (workflow_id, created_at desc);
create index if not exists idx_hub_workflow_runs_user
  on public.hub_workflow_runs (user_id, created_at desc);

alter table public.hub_workflow_runs enable row level security;

drop policy if exists "Users manage own runs" on public.hub_workflow_runs;
create policy "Users manage own runs"
  on public.hub_workflow_runs for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.hub_workflow_runs is
  'Execuções de workflows. Status muda assincronamente conforme execute-workflow processa os nós. UI pola get-workflow-run pra status.';

-- ── Seed de 1 template oficial: "Promo de jogo" ─────────────────────
-- Workflow linear simples: brand → prompt → image-gen → output
-- Usado no MVP da Fase 1. Serve de exemplo + acelera onboarding.
insert into public.hub_workflows (user_id, name, description, brand_id, graph, is_template, created_at)
values (
  null,
  'Promo de jogo',
  'Template básico: marca + prompt → 1 imagem com disclaimer regulatório do mercado.',
  'betbus',
  '{
    "version": 1,
    "nodes": [
      {
        "id": "n1",
        "type": "brand",
        "position": { "x": 80, "y": 100 },
        "data": { "brand_id": "betbus", "market": "MX", "include_disclaimer": true }
      },
      {
        "id": "n2",
        "type": "prompt",
        "position": { "x": 80, "y": 280 },
        "data": { "text": "10 USD a cada gol do Cristiano Ronaldo se a pessoa apostou na vitória de Portugal." }
      },
      {
        "id": "n3",
        "type": "image-gen",
        "position": { "x": 400, "y": 200 },
        "data": { "aspect_ratio": "9:16", "quality": "medium" }
      },
      {
        "id": "n4",
        "type": "output",
        "position": { "x": 720, "y": 200 },
        "data": { "name_template": "{brand}_{market}_{date}_{slug}", "save_to_library": true }
      }
    ],
    "edges": [
      { "id": "e1", "source": "n1", "target": "n3", "targetHandle": "brand" },
      { "id": "e2", "source": "n2", "target": "n3", "targetHandle": "prompt" },
      { "id": "e3", "source": "n3", "target": "n4", "targetHandle": "asset" }
    ]
  }'::jsonb,
  true,
  now()
)
on conflict do nothing;
