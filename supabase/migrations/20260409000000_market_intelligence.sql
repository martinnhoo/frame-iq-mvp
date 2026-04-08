-- Market Intelligence: benchmarks de mercado por nicho/plataforma
-- Fonte: WordStream 2024, Meta Business Benchmarks, DataReportal BR 2024

CREATE TABLE IF NOT EXISTS public.market_intelligence (
  id          uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  niche       text    NOT NULL, -- imoveis | autos | ecommerce | infoprodutos | igaming | servicos | geral
  platform    text    NOT NULL, -- meta | google | tiktok
  metric      text    NOT NULL, -- ctr | cpm | cpc | roas | conv_rate | frequency
  value_avg   numeric NOT NULL,
  value_min   numeric,
  value_max   numeric,
  unit        text    NOT NULL, -- % | R$ | x
  market      text    NOT NULL DEFAULT 'BR', -- BR | MX | IN
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.market_intelligence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read market intelligence"
  ON public.market_intelligence FOR SELECT TO authenticated, anon
  USING (true);

-- ── BRASIL — META ADS ──────────────────────────────────────────────────────
INSERT INTO public.market_intelligence (niche, platform, metric, value_avg, value_min, value_max, unit, market) VALUES
-- CTR médio
('geral',        'meta', 'ctr',       0.90, 0.50, 1.50, '%',  'BR'),
('ecommerce',    'meta', 'ctr',       1.20, 0.70, 2.00, '%',  'BR'),
('imoveis',      'meta', 'ctr',       0.80, 0.40, 1.40, '%',  'BR'),
('autos',        'meta', 'ctr',       1.10, 0.60, 1.80, '%',  'BR'),
('infoprodutos', 'meta', 'ctr',       1.50, 0.80, 2.50, '%',  'BR'),
('igaming',      'meta', 'ctr',       2.20, 1.20, 4.00, '%',  'BR'),
('servicos',     'meta', 'ctr',       0.75, 0.40, 1.20, '%',  'BR'),
-- CPM médio (R$)
('geral',        'meta', 'cpm',       18.00, 8.00,  40.00, 'R$', 'BR'),
('ecommerce',    'meta', 'cpm',       22.00, 10.00, 45.00, 'R$', 'BR'),
('imoveis',      'meta', 'cpm',       25.00, 12.00, 55.00, 'R$', 'BR'),
('autos',        'meta', 'cpm',       20.00, 9.00,  42.00, 'R$', 'BR'),
('infoprodutos', 'meta', 'cpm',       15.00, 7.00,  30.00, 'R$', 'BR'),
('igaming',      'meta', 'cpm',       12.00, 5.00,  25.00, 'R$', 'BR'),
('servicos',     'meta', 'cpm',       19.00, 8.00,  38.00, 'R$', 'BR'),
-- CPC médio (R$)
('geral',        'meta', 'cpc',       1.80, 0.60,  5.00, 'R$', 'BR'),
('ecommerce',    'meta', 'cpc',       1.50, 0.50,  4.00, 'R$', 'BR'),
('imoveis',      'meta', 'cpc',       3.50, 1.50,  9.00, 'R$', 'BR'),
('autos',        'meta', 'cpc',       2.20, 0.80,  6.00, 'R$', 'BR'),
('infoprodutos', 'meta', 'cpc',       1.20, 0.40,  3.00, 'R$', 'BR'),
('igaming',      'meta', 'cpc',       0.60, 0.20,  1.50, 'R$', 'BR'),
('servicos',     'meta', 'cpc',       2.80, 1.00,  7.00, 'R$', 'BR'),
-- ROAS médio
('geral',        'meta', 'roas',      2.50, 1.20, 6.00, 'x',  'BR'),
('ecommerce',    'meta', 'roas',      3.20, 1.50, 8.00, 'x',  'BR'),
('infoprodutos', 'meta', 'roas',      4.00, 2.00, 10.00,'x',  'BR'),
('igaming',      'meta', 'roas',      5.00, 2.50, 12.00,'x',  'BR'),
-- Frequência saudável
('geral',        'meta', 'frequency', 2.50, 1.50, 3.50, 'x',  'BR'),
-- Conv rate
('ecommerce',    'meta', 'conv_rate', 1.80, 0.80, 4.00, '%',  'BR'),
('imoveis',      'meta', 'conv_rate', 2.50, 1.00, 6.00, '%',  'BR'),
('infoprodutos', 'meta', 'conv_rate', 3.00, 1.50, 8.00, '%',  'BR'),
-- ── MÉXICO — META ADS ─────────────────────────────────────────────────────
('geral',        'meta', 'ctr',       0.85, 0.40, 1.40, '%',  'MX'),
('igaming',      'meta', 'ctr',       2.00, 1.00, 3.50, '%',  'MX'),
('geral',        'meta', 'cpm',       12.00, 5.00, 28.00,'R$', 'MX'),
('igaming',      'meta', 'cpm',        8.00, 3.00, 18.00,'R$', 'MX'),
-- ── ÍNDIA — META ADS ──────────────────────────────────────────────────────
('geral',        'meta', 'ctr',       0.70, 0.30, 1.20, '%',  'IN'),
('igaming',      'meta', 'ctr',       1.80, 0.90, 3.20, '%',  'IN'),
('geral',        'meta', 'cpm',        4.00, 1.50,  9.00,'R$', 'IN'),
('igaming',      'meta', 'cpm',        3.00, 1.00,  7.00,'R$', 'IN');
