-- ═══════════════════════════════════════════════════════════════════════════
-- Mercado e licença passam a ser da MARCA — 03/08/2026
--
-- Antes eram campos do formulário de geração: o usuário escolhia mercado e
-- marcava "incluir licença" a cada criativo. Duas decisões repetidas que
-- nunca mudam entre uma geração e outra da mesma marca.
--
-- Pior: os dois estavam mortos em produção. `user_brands.markets` nunca era
-- preenchido (o formulário não escrevia lá) e `license` sequer existia como
-- coluna — o que fazia `hasLicense` ser sempre falso e o disclaimer jamais
-- aparecer, mesmo para quem precisava dele por regulação.
--
-- Agora: escreve uma vez na marca, vale em toda geração.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.user_brands
  add column if not exists license jsonb not null default '{}'::jsonb;

comment on column public.user_brands.license is
  'Texto legal por mercado, no formato {"BR": "...", "MX": "..."}. '
  'Injetado no rodapé do criativo quando o mercado da geração tem entrada aqui. '
  'Existe para quem anuncia em setor regulado (saúde, apostas, financeiro).';

comment on column public.user_brands.markets is
  'Mercados onde a marca opera (BR, MX, CO, PE, US, IN). O primeiro é o '
  'padrão da geração — o usuário deixa de escolher mercado a cada criativo.';

-- Marca sem mercado declarado assume Brasil: é o mercado de praticamente
-- toda a base, e um default errado é melhor que uma pergunta a mais.
update public.user_brands
   set markets = array['BR']
 where markets is null or cardinality(markets) = 0;
