-- Hook Library — biblioteca de copy hooks pra iGaming.
--
-- 40 hooks pré-fabricados, categorizados por mecanismo psicológico
-- (urgência, valor, social proof, FOMO, etc). User abre modal no nó
-- Variação (axis="prompt") e seleciona hooks pra preencher o textarea
-- automaticamente.
--
-- Categorias:
--   urgency       — urgência temporal ("só hoje", "expira em")
--   value         — valor explícito do bônus
--   testimonial   — depoimento/prova social
--   comparison    — comparação com concorrente
--   offer         — oferta direta (deposite X, ganhe Y)
--   fomo          — medo de perder oportunidade
--   social_proof  — # de pessoas, autoridade
--   question      — pergunta que engaja

create table if not exists public.hub_hook_library (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in (
    'urgency','value','testimonial','comparison','offer','fomo','social_proof','question'
  )),
  copy text not null,
  -- locale: lang+market (pt-BR, es-MX, etc). null = "neutro" (qualquer mercado)
  locale text,
  -- brand_kind: 'casino' (slots/roleta), 'sportsbook' (esportes), 'live' (live games), null = neutro
  brand_kind text,
  -- score (manual ou calculado): hooks com mais conversão sobem
  score numeric default 0,
  is_official boolean default true,
  created_at timestamptz not null default now()
);

-- Índices pra filtrar/ordenar
create index if not exists idx_hub_hook_library_category on public.hub_hook_library(category);
create index if not exists idx_hub_hook_library_score on public.hub_hook_library(score desc);

-- Tabela é LEITURA PÚBLICA (todos os users veem os mesmos hooks
-- oficiais). RLS minimal — qualquer authenticated lê.
alter table public.hub_hook_library enable row level security;

drop policy if exists "Authenticated read hook library" on public.hub_hook_library;
create policy "Authenticated read hook library"
  on public.hub_hook_library for select
  to authenticated
  using (true);

comment on table public.hub_hook_library is
  'Biblioteca de copy hooks iGaming. User abre via modal no Workflow Variation node, seleciona hooks, preenche o textarea automaticamente.';

-- ── Seed de 40 hooks (5 por categoria × 8 categorias) ───────────────

insert into public.hub_hook_library (category, copy, locale, brand_kind, score, is_official) values
  -- URGENCY (urgência temporal)
  ('urgency', 'Só hoje: 100 rodadas grátis no primeiro depósito. Slot machine com luzes douradas explodindo de moedas.', 'pt-BR', 'casino', 90, true),
  ('urgency', 'Expira meia-noite: bônus de 200% em todos os slots. Cassino vibrante estilo Las Vegas com neon.', 'pt-BR', 'casino', 85, true),
  ('urgency', 'Últimas horas pra dobrar seu depósito. Cifras douradas, atmosfera de jackpot, contagem regressiva.', 'pt-BR', 'casino', 80, true),
  ('urgency', '24h pra reclamar: cashback 50% em qualquer perda. Roleta dourada com fichas voando.', 'pt-BR', 'casino', 88, true),
  ('urgency', 'Termina hoje às 23:59 — 50 rodadas grátis sem depósito. Slot machine com símbolos cintilantes.', 'pt-BR', 'casino', 87, true),

  -- VALUE (valor explícito do bônus)
  ('value', 'Ganhe 100 rodadas grátis no primeiro depósito. Slot premium com cifrões dourados.', 'pt-BR', 'casino', 95, true),
  ('value', 'Bônus de R$ 500 pra começar. Cassino estilo Las Vegas, neon brilhante, atmosfera vibrante.', 'pt-BR', 'casino', 92, true),
  ('value', 'Multiplicador x10 em todos os slots de hoje. Símbolos dourados em cascata, fundo escuro.', 'pt-BR', 'casino', 90, true),
  ('value', 'Cashback 10% toda semana sem questionamento. Fichas voando, cores quentes, fundo elegante.', 'pt-BR', 'casino', 88, true),
  ('value', 'Bônus de boas-vindas 200% até R$ 1000. Banner promocional centrado, slot machine de fundo.', 'pt-BR', 'casino', 90, true),

  -- TESTIMONIAL (prova social via depoimento)
  ('testimonial', 'Depositei 50 e tirei 2 mil em 1 hora. Pessoa sorrindo recebendo dinheiro, atmosfera autêntica.', 'pt-BR', 'casino', 93, true),
  ('testimonial', 'Comecei com bônus grátis e hoje pago meu aluguel. Pessoa real, ambiente casual, sem clichê.', 'pt-BR', 'casino', 89, true),
  ('testimonial', 'Já saquei 3x essa semana sem problema. Tela do celular mostrando saque PIX, expressão de alívio.', 'pt-BR', 'casino', 91, true),
  ('testimonial', 'Apostei R$ 10 e levei R$ 800 no Aviator. Pessoa sorrindo com celular, fundo de sala casual.', 'pt-BR', 'casino', 87, true),
  ('testimonial', 'Não acreditava até receber o dinheiro na conta. Pessoa olhando notif do banco com expressão de surpresa.', 'pt-BR', 'casino', 86, true),

  -- COMPARISON (comparação implícita com concorrentes)
  ('comparison', 'Outros pagam em dias. A gente paga em segundos. PIX instantâneo, contagem regressiva 0:01.', 'pt-BR', 'casino', 88, true),
  ('comparison', 'Cassino que paga MESMO. Sem letras miúdas, sem rolagem, sem complicação. Pessoa sorrindo confiante.', 'pt-BR', 'casino', 85, true),
  ('comparison', 'Bônus REAL — não os 1000% que travam tudo. Comparação visual: caminho claro vs labirinto.', 'pt-BR', 'casino', 87, true),
  ('comparison', 'Aqui o saque sai. No outro fica preso. Split screen: PIX recebido vs erro de transação.', 'pt-BR', 'casino', 84, true),
  ('comparison', 'O cassino que respeita o seu tempo: cadastro em 30 segundos. Cronômetro, fundo limpo.', 'pt-BR', 'casino', 82, true),

  -- OFFER (oferta direta calibrada)
  ('offer', 'Deposite R$ 30 e leve R$ 60. Slot machine com símbolos de cifrão dourado, atmosfera neon.', 'pt-BR', 'casino', 91, true),
  ('offer', 'Cadastro grátis com 20 rodadas de bônus. Sem depósito. Slot premium, luzes douradas.', 'pt-BR', 'casino', 94, true),
  ('offer', 'Deposite R$ 100, jogue com R$ 300. 3x o saldo. Pilha de moedas multiplicando, fundo VIP.', 'pt-BR', 'casino', 89, true),
  ('offer', 'Aposta dobrada toda terça. Cifras douradas duplicando, calendário marcando o dia.', 'pt-BR', 'casino', 86, true),
  ('offer', 'Bônus sem rollover. Saque o que ganhar, na hora. Pessoa recebendo PIX, fundo limpo.', 'pt-BR', 'casino', 90, true),

  -- FOMO (medo de perder)
  ('fomo', 'Enquanto você pensa, alguém leva os R$ 5 mil. Roleta girando, multidão expectante.', 'pt-BR', 'casino', 87, true),
  ('fomo', 'Mais 100 vagas pro bônus VIP. Depois fecha. Multidão se inscrevendo, contador descendo.', 'pt-BR', 'casino', 85, true),
  ('fomo', 'Hoje 1 a cada 3 jogadores sai com lucro. Estatística destacada, gráfico positivo.', 'pt-BR', 'casino', 83, true),
  ('fomo', 'Quem cadastrou ontem já pegou o bônus. Você ainda dá tempo. Notificação aparecendo na tela.', 'pt-BR', 'casino', 82, true),
  ('fomo', 'Promoção de aniversário: só os 1000 primeiros. Contador descendo, ambiente festivo.', 'pt-BR', 'casino', 84, true),

  -- SOCIAL_PROOF (prova social numérica)
  ('social_proof', 'Mais de 50 mil brasileiros sacaram esta semana. Multidão diversificada sorrindo, mapa do Brasil.', 'pt-BR', 'casino', 90, true),
  ('social_proof', '4.8 estrelas no Reclame Aqui. Selo de confiança, depoimentos rápidos.', 'pt-BR', 'casino', 88, true),
  ('social_proof', 'Aprovado por mais de 100 mil jogadores. Crowd shot, vibrante, expressões positivas.', 'pt-BR', 'casino', 86, true),
  ('social_proof', '#1 cassino mais sacado do Brasil em 2026. Troféu dourado, ranking visual.', 'pt-BR', 'casino', 89, true),
  ('social_proof', 'Pago R$ 500 milhões em prêmios este ano. Cifra grande destacada, símbolos de dinheiro.', 'pt-BR', 'casino', 91, true),

  -- QUESTION (pergunta engaja)
  ('question', 'Sabe qual cassino paga em 30 segundos? Ponto de interrogação destacado, celular com PIX.', 'pt-BR', 'casino', 84, true),
  ('question', 'Quanto você quer ganhar essa semana? R$ 500? R$ 5 mil? Calculadora, fichas crescendo.', 'pt-BR', 'casino', 82, true),
  ('question', 'E se 50 reais virassem 1000 em 5 minutos? Ampulheta dourada, transformação visual.', 'pt-BR', 'casino', 81, true),
  ('question', 'Já viu cassino que devolve sua perda? Cifra negativa virando positiva, escudo protetor.', 'pt-BR', 'casino', 83, true),
  ('question', 'Por que ainda não aproveitou seu bônus de boas-vindas? Presente embrulhado, dourado.', 'pt-BR', 'casino', 80, true)
on conflict do nothing;
