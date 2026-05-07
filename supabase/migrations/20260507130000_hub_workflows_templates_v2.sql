-- Templates v2: focados em iGaming Meta Ads (BETBUS, ELUCK, FUNILIVE).
--
-- Substitui os templates genéricos por workflows realmente úteis pro
-- caso de uso de criação de criativos pra Meta Ads de cassino:
--   1. Pacote Meta Multi-Formato — 1 prompt × 3 placements
--   2. A/B Hooks — 5 copies × 1 formato (Feed)
--   3. Matriz Hooks × Formatos — 5 copies × 3 formatos = 15 outputs
--   4. Promo de Boas-Vindas — 4 ofertas × 3 formatos = 12 outputs
--   5. Reel com Voz — image → storyboard 4 cenas → voz
--
-- Os antigos (Promo de jogo, Promo multi-formato, Voice over) ficam
-- como base mas são complementados — usuários novos verão a lista
-- completa.

-- ── 1. Pacote Meta Multi-Formato ────────────────────────────────────
-- Mesmo criativo otimizado pras 3 placements principais do Meta:
--   1:1   → Feed
--   9:16  → Stories / Reels
--   4:5   → Feed mobile (mais altura visível)
insert into public.hub_workflows (user_id, name, description, brand_id, graph, is_template, created_at)
values (
  null,
  'Pacote Meta Multi-Formato',
  'Lança 1 criativo em todas as colocações Meta (Feed 1:1, Stories 9:16, Carrossel 4:5).',
  'betbus',
  '{
    "version": 1,
    "nodes": [
      { "id": "n1", "type": "brand", "position": { "x": 60, "y": 80 },
        "data": { "brand_id": "betbus", "market": "MX", "include_disclaimer": true } },
      { "id": "n2", "type": "prompt", "position": { "x": 60, "y": 280 },
        "data": { "text": "Bônus de boas-vindas 200% até R$ 500. Slot machine com símbolos dourados, luzes neon, atmosfera de Las Vegas. Banner de promoção centralizado." } },
      { "id": "n3", "type": "variation", "position": { "x": 360, "y": 200 },
        "data": { "axis": "aspect_ratio", "values": ["1:1", "9:16", "4:5"] } },
      { "id": "n4", "type": "image-gen", "position": { "x": 620, "y": 200 },
        "data": { "aspect_ratio": "1:1", "quality": "medium" } },
      { "id": "n5", "type": "output", "position": { "x": 920, "y": 200 },
        "data": { "name_template": "{brand}_{market}_meta_{slug}", "save_to_library": true } }
    ],
    "edges": [
      { "id": "e1", "source": "n2", "target": "n3", "targetHandle": "in" },
      { "id": "e2", "source": "n3", "target": "n4", "targetHandle": "prompt" },
      { "id": "e3", "source": "n1", "target": "n4", "targetHandle": "brand" },
      { "id": "e4", "source": "n4", "target": "n5", "targetHandle": "asset" }
    ]
  }'::jsonb,
  true,
  now()
)
on conflict do nothing;

-- ── 2. A/B Hooks ────────────────────────────────────────────────────
-- 5 copies diferentes, mesmo formato (Feed 1:1). Pra rodar test budget
-- pequeno e descobrir qual hook converte melhor antes de escalar.
insert into public.hub_workflows (user_id, name, description, brand_id, graph, is_template, created_at)
values (
  null,
  'A/B Hooks (5 copies)',
  '5 hooks diferentes com mesma arte/marca. Testa qual converte antes de escalar.',
  'betbus',
  '{
    "version": 1,
    "nodes": [
      { "id": "n1", "type": "brand", "position": { "x": 60, "y": 80 },
        "data": { "brand_id": "betbus", "market": "MX", "include_disclaimer": true } },
      { "id": "n2", "type": "variation", "position": { "x": 360, "y": 200 },
        "data": { "axis": "prompt", "values": [
          "Ganhe 100 rodadas grátis no primeiro depósito. Slot machine com luzes douradas explodindo de moedas.",
          "Bônus de R$ 500 pra começar. Cassino estilo Las Vegas, neon brilhante, atmosfera vibrante.",
          "Cashback 10% toda semana. Roleta com fichas voando, cores quentes, fundo elegante.",
          "Saque na mesma hora. Pessoa sorrindo recebendo dinheiro do celular, fundo limpo claro.",
          "Multiplicador x10 nos slots de hoje. Símbolos dourados em cascata, fundo escuro com brilho."
        ] } },
      { "id": "n3", "type": "image-gen", "position": { "x": 620, "y": 200 },
        "data": { "aspect_ratio": "1:1", "quality": "medium" } },
      { "id": "n4", "type": "output", "position": { "x": 920, "y": 200 },
        "data": { "name_template": "{brand}_{market}_hook_{slug}", "save_to_library": true } }
    ],
    "edges": [
      { "id": "e1", "source": "n2", "target": "n3", "targetHandle": "prompt" },
      { "id": "e2", "source": "n1", "target": "n3", "targetHandle": "brand" },
      { "id": "e3", "source": "n3", "target": "n4", "targetHandle": "asset" }
    ]
  }'::jsonb,
  true,
  now()
)
on conflict do nothing;

-- ── 3. Matriz Hooks × Formatos ──────────────────────────────────────
-- 5 hooks × 3 formatos = 15 outputs. Matriz completa pra rodar test
-- budget significativo. Pega os 2 winners e escala.
insert into public.hub_workflows (user_id, name, description, brand_id, graph, is_template, created_at)
values (
  null,
  'Matriz Hooks × Formatos (15 imagens)',
  '5 copies × 3 formatos. Matriz pra rodar test budget e identificar combinação winner antes de escalar.',
  'betbus',
  '{
    "version": 1,
    "nodes": [
      { "id": "n1", "type": "brand", "position": { "x": 60, "y": 80 },
        "data": { "brand_id": "betbus", "market": "MX", "include_disclaimer": true } },
      { "id": "n2", "type": "variation", "position": { "x": 320, "y": 120 },
        "data": { "axis": "prompt", "values": [
          "Ganhe 100 rodadas grátis no primeiro depósito. Slot machine com luzes douradas.",
          "Bônus de R$ 500 pra começar. Cassino Las Vegas, neon brilhante.",
          "Cashback 10% toda semana. Roleta com fichas voando, cores quentes.",
          "Saque na mesma hora. Pessoa sorrindo com dinheiro no celular.",
          "Multiplicador x10 nos slots. Símbolos dourados em cascata."
        ] } },
      { "id": "n3", "type": "variation", "position": { "x": 600, "y": 200 },
        "data": { "axis": "aspect_ratio", "values": ["1:1", "9:16", "4:5"] } },
      { "id": "n4", "type": "image-gen", "position": { "x": 880, "y": 200 },
        "data": { "aspect_ratio": "1:1", "quality": "medium" } },
      { "id": "n5", "type": "output", "position": { "x": 1180, "y": 200 },
        "data": { "name_function": "{brand}_{market}_matrix_{slug}", "save_to_library": true } }
    ],
    "edges": [
      { "id": "e1", "source": "n2", "target": "n3", "targetHandle": "in" },
      { "id": "e2", "source": "n3", "target": "n4", "targetHandle": "prompt" },
      { "id": "e3", "source": "n1", "target": "n4", "targetHandle": "brand" },
      { "id": "e4", "source": "n4", "target": "n5", "targetHandle": "asset" }
    ]
  }'::jsonb,
  true,
  now()
)
on conflict do nothing;

-- ── 4. Promo de Boas-Vindas ─────────────────────────────────────────
-- 4 tiers de bônus × 3 formatos = 12 outputs. Cada tier é uma oferta
-- segmentada por audiência (low ticket → high ticket).
insert into public.hub_workflows (user_id, name, description, brand_id, graph, is_template, created_at)
values (
  null,
  'Promo Boas-Vindas (4 ofertas × 3 formatos)',
  '4 tiers de bônus (10/20/50/100 rodadas) em 3 formatos. Pacote completo pra segmentar audiência por ticket.',
  'betbus',
  '{
    "version": 1,
    "nodes": [
      { "id": "n1", "type": "brand", "position": { "x": 60, "y": 80 },
        "data": { "brand_id": "betbus", "market": "MX", "include_disclaimer": true } },
      { "id": "n2", "type": "variation", "position": { "x": 320, "y": 120 },
        "data": { "axis": "prompt", "values": [
          "Ganhe 10 rodadas grátis no cadastro. Sem depósito. Slot machine com cifrão dourado destacado, fundo neon.",
          "Ganhe 20 rodadas grátis ao depositar R$ 30. Slot symbol explodindo moedas, atmosfera Las Vegas.",
          "Ganhe 50 rodadas grátis ao depositar R$ 100. Cassino premium com fichas e cartas, cores quentes.",
          "Ganhe 100 rodadas grátis ao depositar R$ 200. Mega slot jackpot, luzes de neón intensas, ambiente VIP."
        ] } },
      { "id": "n3", "type": "variation", "position": { "x": 600, "y": 200 },
        "data": { "axis": "aspect_ratio", "values": ["1:1", "9:16", "4:5"] } },
      { "id": "n4", "type": "image-gen", "position": { "x": 880, "y": 200 },
        "data": { "aspect_ratio": "1:1", "quality": "medium" } },
      { "id": "n5", "type": "output", "position": { "x": 1180, "y": 200 },
        "data": { "name_template": "{brand}_{market}_welcome_{slug}", "save_to_library": true } }
    ],
    "edges": [
      { "id": "e1", "source": "n2", "target": "n3", "targetHandle": "in" },
      { "id": "e2", "source": "n3", "target": "n4", "targetHandle": "prompt" },
      { "id": "e3", "source": "n1", "target": "n4", "targetHandle": "brand" },
      { "id": "e4", "source": "n4", "target": "n5", "targetHandle": "asset" }
    ]
  }'::jsonb,
  true,
  now()
)
on conflict do nothing;

-- ── 5. Reel com Voz (Storyboard + Voiceover) ────────────────────────
-- Pra criar Reels Meta com narração: imagem hero → storyboard 4 cenas
-- (sequência narrativa) + voiceover em PT-BR com voz Bella (ElevenLabs).
-- User só precisa ajustar o script antes de rodar.
insert into public.hub_workflows (user_id, name, description, brand_id, graph, is_template, created_at)
values (
  null,
  'Reel com Voz (Storyboard + VO)',
  '4 cenas em sequência narrativa 9:16 + voiceover PT-BR. Pronto pra editar e publicar como Reel.',
  'betbus',
  '{
    "version": 1,
    "nodes": [
      { "id": "n1", "type": "brand", "position": { "x": 60, "y": 80 },
        "data": { "brand_id": "betbus", "market": "MX", "include_disclaimer": true } },
      { "id": "n2", "type": "prompt", "position": { "x": 60, "y": 280 },
        "data": { "text": "Cara, você sabia que o BetBus paga 10 USD pra cada gol do Cristiano Ronaldo? Eu apostei 50 reais e tirei 800 no jogo de ontem. Cadastra agora pelo link na bio que tem 100 rodadas grátis te esperando." } },
      { "id": "n3", "type": "storyboard", "position": { "x": 360, "y": 180 },
        "data": { "scene_count": 4, "aspect_ratio": "9:16", "quality": "medium" } },
      { "id": "n4", "type": "voice", "position": { "x": 360, "y": 420 },
        "data": { "voice_id": "EXAVITQu4vr4xnSDxMaL", "voice_name": "Bella" } },
      { "id": "n5", "type": "output", "position": { "x": 720, "y": 280 },
        "data": { "name_template": "{brand}_{market}_reel_{slug}", "save_to_library": true } }
    ],
    "edges": [
      { "id": "e1", "source": "n2", "target": "n3", "targetHandle": "prompt" },
      { "id": "e2", "source": "n1", "target": "n3", "targetHandle": "brand" },
      { "id": "e3", "source": "n2", "target": "n4", "targetHandle": "text" },
      { "id": "e4", "source": "n3", "target": "n5", "targetHandle": "asset" }
    ]
  }'::jsonb,
  true,
  now()
)
on conflict do nothing;
