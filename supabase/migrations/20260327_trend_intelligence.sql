-- trend_intelligence: sistema global de trends, acima de todos os clientes
-- Não tem user_id — é compartilhado por toda a plataforma

create table if not exists trend_intelligence (
  id            uuid primary key default gen_random_uuid(),
  
  -- Identificação
  term          text not null,                    -- "BBB26", "Diddy", "Copa do Mundo"
  term_key      text not null unique,              -- slug normalizado: "bbb26"
  category      text,                             -- "reality", "meme", "esporte", "entretenimento"
  
  -- Volume e relevância (Google Trends: 0-100)
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  days_active   int not null default 1,           -- quantos dias apareceu no ranking
  appearances   int not null default 1,           -- quantas vezes apareceu (pode sumir e voltar)
  peak_volume   int not null default 0,           -- maior volume já registrado (0-100)
  last_volume   int not null default 0,           -- volume mais recente
  
  -- Aprendizado de padrão (atualizado com cada aparição)
  avg_volume    float not null default 0,         -- média histórica de volume
  
  -- Análise cultural (gerada pelo Haiku, compacta)
  angle         text,                             -- "o que é" em 1 frase
  ad_angle      text,                             -- como usar em anúncio
  niches        text[],                           -- ["fitness","beleza","apps"]
  risk_score    int not null default 0,           -- 0-10, >= 7 não propaga
  
  -- Status
  is_active     boolean not null default true,    -- ainda no ranking hoje
  is_blocked    boolean not null default false,   -- bloqueado manualmente
  
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- trend_daily_volumes: histórico diário para aprender o que é alto/baixo
create table if not exists trend_daily_volumes (
  id         uuid primary key default gen_random_uuid(),
  term_key   text not null references trend_intelligence(term_key) on delete cascade,
  date       date not null default current_date,
  volume     int not null,       -- 0-100 do Google Trends
  position   int,                -- posição no ranking naquele dia (1-10)
  unique(term_key, date)
);

-- trend_platform_baseline: média histórica por plataforma/geo para calibrar
-- "o que é normal no Brasil" aprende com o tempo
create table if not exists trend_platform_baseline (
  id          uuid primary key default gen_random_uuid(),
  geo         text not null default 'BR',
  week_start  date not null,
  avg_volume  float,            -- média de volume dos top 10 naquela semana
  p75_volume  float,            -- percentil 75 (o que é "alto")
  p90_volume  float,            -- percentil 90 (o que é "viral")
  unique(geo, week_start)
);

-- Índices
create index if not exists idx_trend_active on trend_intelligence(is_active, last_seen_at desc);
create index if not exists idx_trend_term_key on trend_intelligence(term_key);
create index if not exists idx_trend_volumes_date on trend_daily_volumes(date desc);

-- RLS: trend_intelligence é público (leitura) para todos os usuários autenticados
alter table trend_intelligence enable row level security;
alter table trend_daily_volumes enable row level security;
alter table trend_platform_baseline enable row level security;

create policy "authenticated users can read trends"
  on trend_intelligence for select to authenticated using (true);

create policy "service role manages trends"
  on trend_intelligence for all to service_role using (true);

create policy "authenticated users can read volumes"
  on trend_daily_volumes for select to authenticated using (true);

create policy "service role manages volumes"
  on trend_daily_volumes for all to service_role using (true);

create policy "authenticated users can read baseline"
  on trend_platform_baseline for select to authenticated using (true);

create policy "service role manages baseline"
  on trend_platform_baseline for all to service_role using (true);
