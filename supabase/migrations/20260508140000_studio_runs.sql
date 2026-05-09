-- studio_runs — tracking de geração em batch do Studio.
--
-- Por que: gerar 10 criativos com gpt-image-2 (15-25s cada) batia
-- nos 150s de idle timeout do edge function quando algum era lento.
-- Solução: server retorna run_id imediatamente e processa em background
-- via EdgeRuntime.waitUntil, escrevendo cada resultado no DB conforme
-- termina. Frontend faz poll a cada 2.5s e renderiza streaming.

create table if not exists public.studio_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',  -- pending | running | done | failed
  prompt text not null,
  brand_id uuid references public.user_brands(id) on delete set null,
  count int not null,
  aspect_ratio text not null default '1:1',
  -- angles é o array final escolhido pra esta run (id de SERVER_ANGLE_LIBRARY)
  angles jsonb not null default '[]'::jsonb,
  -- results é populado item-por-item conforme cada gen termina:
  -- [{ angle_id, angle_label, image_url?, asset_id?, error? }]
  results jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  finished_at timestamptz
);

create index if not exists idx_studio_runs_user_status on public.studio_runs(user_id, status, created_at desc);

alter table public.studio_runs enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'studio_runs' and policyname = 'studio_runs_owner') then
    create policy studio_runs_owner on public.studio_runs
      for all to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;
