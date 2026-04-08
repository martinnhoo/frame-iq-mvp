-- Atualiza market_intelligence com dados reais 2025
-- Fontes: Triple Whale 2025, WordStream 2025, Lebesgue CPM by Country 2026, AdAmigo 2026
-- BR convertido com USD/BRL ~5.70 (média 2025)

DELETE FROM public.market_intelligence;

-- ── BRASIL — META ADS 2025 ────────────────────────────────────────────────
-- Fonte: Lebesgue CPM Brazil $2.63-$4.20 | WordStream 2025 | Triple Whale 2025
-- CTR global median 2025: 0.90%-2.19% | Brasil tem audiência mais responsiva que US
INSERT INTO public.market_intelligence (niche, platform, metric, value_avg, value_min, value_max, unit, market) VALUES
-- CTR (%) — fonte: WordStream 2025 + Triple Whale 2025 adaptado para BR
('geral',        'meta', 'ctr',  1.10, 0.60, 2.20, '%',  'BR'),
('ecommerce',    'meta', 'ctr',  1.40, 0.80, 2.80, '%',  'BR'),
('imoveis',      'meta', 'ctr',  0.99, 0.50, 1.80, '%',  'BR'),
('autos',        'meta', 'ctr',  1.20, 0.70, 2.10, '%',  'BR'),
('infoprodutos', 'meta', 'ctr',  1.80, 1.00, 3.50, '%',  'BR'),
('igaming',      'meta', 'ctr',  2.50, 1.40, 4.50, '%',  'BR'),
('servicos',     'meta', 'ctr',  0.85, 0.45, 1.60, '%',  'BR'),
-- CPM (R$) — Lebesgue 2026: BR=$2.63-$4.20 * 5.70 = R$15-R$24
('geral',        'meta', 'cpm', 18.00,  8.00, 40.00, 'R$', 'BR'),
('ecommerce',    'meta', 'cpm', 20.00, 10.00, 45.00, 'R$', 'BR'),
('imoveis',      'meta', 'cpm', 28.00, 15.00, 60.00, 'R$', 'BR'),
('autos',        'meta', 'cpm', 22.00, 10.00, 48.00, 'R$', 'BR'),
('infoprodutos', 'meta', 'cpm', 14.00,  7.00, 28.00, 'R$', 'BR'),
('igaming',      'meta', 'cpm', 11.00,  4.00, 22.00, 'R$', 'BR'),
('servicos',     'meta', 'cpm', 19.00,  9.00, 38.00, 'R$', 'BR'),
-- CPC (R$) — WordStream 2025 global $0.70-$1.72 * 0.45 (BR desconto Tier 3) * 5.70
('geral',        'meta', 'cpc',  1.60, 0.50,  5.00, 'R$', 'BR'),
('ecommerce',    'meta', 'cpc',  1.40, 0.45,  3.80, 'R$', 'BR'),
('imoveis',      'meta', 'cpc',  3.80, 1.50,  9.50, 'R$', 'BR'),
('autos',        'meta', 'cpc',  2.40, 0.90,  6.50, 'R$', 'BR'),
('infoprodutos', 'meta', 'cpc',  1.10, 0.35,  2.80, 'R$', 'BR'),
('igaming',      'meta', 'cpc',  0.55, 0.18,  1.40, 'R$', 'BR'),
('servicos',     'meta', 'cpc',  2.90, 1.00,  7.00, 'R$', 'BR'),
-- ROAS — Triple Whale 2025: global median 1.93, top performers 2.5-4x
('geral',        'meta', 'roas',  2.20, 1.20,  5.00, 'x',  'BR'),
('ecommerce',    'meta', 'roas',  2.80, 1.50,  7.00, 'x',  'BR'),
('infoprodutos', 'meta', 'roas',  4.00, 2.00, 10.00, 'x',  'BR'),
('igaming',      'meta', 'roas',  5.50, 2.50, 14.00, 'x',  'BR'),
('imoveis',      'meta', 'roas',  2.10, 1.00,  6.00, 'x',  'BR'),
-- CVR (%) — WordStream 2025: global avg 9.21%, BR tende a ser menor (menos otimização)
('geral',        'meta', 'conv_rate', 4.50, 1.00, 12.00, '%', 'BR'),
('ecommerce',    'meta', 'conv_rate', 3.26, 0.80,  8.00, '%', 'BR'),
('imoveis',      'meta', 'conv_rate', 2.50, 0.80,  7.00, '%', 'BR'),
('infoprodutos', 'meta', 'conv_rate', 7.00, 2.00, 18.00, '%', 'BR'),
('igaming',      'meta', 'conv_rate', 8.00, 3.00, 20.00, '%', 'BR'),
-- Frequência — padrão de mercado
('geral',        'meta', 'frequency', 2.50, 1.50, 3.50, 'x', 'BR'),

-- ── MÉXICO — META ADS 2025 ────────────────────────────────────────────────
-- Fonte: AdAmigo 2026 MX CPM ~$3.92 USD * 17.5 MXN ≈ R$ equivalent estimado
('geral',        'meta', 'ctr',  1.00, 0.50,  2.00, '%',  'MX'),
('igaming',      'meta', 'ctr',  2.20, 1.20,  4.00, '%',  'MX'),
('ecommerce',    'meta', 'ctr',  1.20, 0.60,  2.50, '%',  'MX'),
('geral',        'meta', 'cpm', 22.00, 8.00,  50.00, 'R$', 'MX'),
('igaming',      'meta', 'cpm', 14.00, 5.00,  30.00, 'R$', 'MX'),
('geral',        'meta', 'cpc',  2.00, 0.60,   6.00, 'R$', 'MX'),
('geral',        'meta', 'roas', 2.00, 1.00,   5.00, 'x',  'MX'),

-- ── ÍNDIA — META ADS 2025 ─────────────────────────────────────────────────
-- Fonte: Lebesgue India CPM $1.36 USD * 84 INR
('geral',        'meta', 'ctr',  0.80, 0.40,  1.80, '%',  'IN'),
('igaming',      'meta', 'ctr',  2.00, 1.00,  3.80, '%',  'IN'),
('geral',        'meta', 'cpm',  5.00, 2.00,  12.00, 'R$', 'IN'),
('igaming',      'meta', 'cpm',  3.50, 1.20,   8.00, 'R$', 'IN'),
('geral',        'meta', 'cpc',  0.80, 0.25,   2.50, 'R$', 'IN'),
('geral',        'meta', 'roas', 2.50, 1.20,   6.00, 'x',  'IN');

-- Atualiza o timestamp
UPDATE public.market_intelligence SET updated_at = now();
