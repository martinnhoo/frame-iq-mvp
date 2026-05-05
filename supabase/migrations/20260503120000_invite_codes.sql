-- Invite codes — gating signup por código único de 1 uso.
--
-- AdBrief virou portal de cadastro/login só. Acesso é por convite:
-- 10 códigos pré-gerados, cada um claimable uma única vez. Sem código
-- válido, edge function `claim-invite-code` rejeita o signup.
--
-- Schema é simples de propósito:
--   - code: chave primária, formato BRILL-XXXX-YYYY
--   - used_by: FK pra auth.users(id), null = não usado
--   - used_at: timestamp da reclamação (auditoria)
--   - created_at: quando o código foi semeado

create table if not exists public.invite_codes (
  code        text primary key,
  used_by     uuid references auth.users(id) on delete set null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- RLS: ninguém lê ou escreve direto. Só service_role (via edge function)
-- pode tocar nessa tabela. Frontend NUNCA enxerga códigos.
alter table public.invite_codes enable row level security;

-- Sem policies = ninguém autenticado consegue acessar. service_role
-- bypassa RLS por padrão, então a edge function consegue.

-- Index pra checar por código rapidamente (já temos PK, mas index
-- explícito ajuda na cláusula `where used_by is null`).
create index if not exists idx_invite_codes_unused
  on public.invite_codes (code)
  where used_by is null;

-- Sementes — 10 códigos pré-gerados. Cada um vale 1 conta.
insert into public.invite_codes (code) values
  ('BRILL-RKYD-RECE'),
  ('BRILL-97ZT-G7BU'),
  ('BRILL-27GL-YPXB'),
  ('BRILL-6P2Z-DYEA'),
  ('BRILL-DLAG-S9B8'),
  ('BRILL-4DA3-M862'),
  ('BRILL-DZU5-HUFB'),
  ('BRILL-Y3WE-G9P3'),
  ('BRILL-HCFD-HJLE'),
  ('BRILL-6R3E-J6BD')
on conflict (code) do nothing;

comment on table public.invite_codes is
  'Códigos de convite single-use pra signup. Cada conta nova claim 1 código atomicamente via edge function claim-invite-code.';
