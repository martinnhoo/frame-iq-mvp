-- Template "Promo multi-formato": gera 3 variações de aspect ratio do
-- mesmo prompt em paralelo (1:1, 9:16, 16:9). Usa variation node.
--
-- Grafo:
--   brand ──┐
--   prompt ─┼─→ variation [1:1, 9:16, 16:9] ─→ image-gen ─→ output
--           │
--   (variation expande no executor: 3x image-gen+output em paralelo)

insert into public.hub_workflows (user_id, name, description, brand_id, graph, is_template, created_at)
values (
  null,
  'Promo multi-formato',
  'Mesmo prompt em 3 aspect ratios (Feed/Stories/Banner) em paralelo.',
  'betbus',
  '{
    "version": 1,
    "nodes": [
      {
        "id": "n1",
        "type": "brand",
        "position": { "x": 60, "y": 80 },
        "data": { "brand_id": "betbus", "market": "MX", "include_disclaimer": true }
      },
      {
        "id": "n2",
        "type": "prompt",
        "position": { "x": 60, "y": 280 },
        "data": { "text": "10 USD a cada gol do Cristiano Ronaldo se a pessoa apostou na vitória de Portugal." }
      },
      {
        "id": "n3",
        "type": "variation",
        "position": { "x": 360, "y": 200 },
        "data": { "axis": "aspect_ratio", "values": ["1:1", "9:16", "16:9"] }
      },
      {
        "id": "n4",
        "type": "image-gen",
        "position": { "x": 620, "y": 200 },
        "data": { "aspect_ratio": "1:1", "quality": "medium" }
      },
      {
        "id": "n5",
        "type": "output",
        "position": { "x": 920, "y": 200 },
        "data": { "name_template": "{brand}_{market}_{date}_{slug}", "save_to_library": true }
      }
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
