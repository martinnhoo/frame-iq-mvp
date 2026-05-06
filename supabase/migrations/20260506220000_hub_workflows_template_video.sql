-- Template "Promo animada": image-gen → video (Kling 3.0 image-to-video) → output
--
-- Caso de uso: gera um still primeiro com gpt-image-2 (controle visual da
-- composição) e depois anima ele com Kling 3.0. Isso é o use case principal
-- do Brilliant — same character/scene moving.

insert into public.hub_workflows (user_id, name, description, brand_id, graph, is_template, created_at)
values (
  null,
  'Promo animada',
  'Imagem gerada (gpt-image-2) vira vídeo animado (Kling 3.0). 5s, 720p, sem áudio.',
  'betbus',
  '{
    "version": 1,
    "nodes": [
      {
        "id": "n1",
        "type": "brand",
        "position": { "x": 60, "y": 80 },
        "data": { "brand_id": "betbus", "market": "MX", "include_disclaimer": false }
      },
      {
        "id": "n2",
        "type": "prompt",
        "position": { "x": 60, "y": 280 },
        "data": { "text": "Cristiano Ronaldo celebrating a goal in the Portugal national team kit, fireworks in stadium background, dramatic lighting, cinematic." }
      },
      {
        "id": "n3",
        "type": "image-gen",
        "position": { "x": 380, "y": 200 },
        "data": { "aspect_ratio": "16:9", "quality": "medium" }
      },
      {
        "id": "n4",
        "type": "prompt",
        "position": { "x": 380, "y": 460 },
        "data": { "text": "Subtle camera push-in towards the player. Crowd cheering motion in background. Fireworks pulse." }
      },
      {
        "id": "n5",
        "type": "video",
        "position": { "x": 700, "y": 280 },
        "data": { "duration": 5, "aspect_ratio": "16:9", "mode": "std", "resolution": "720p", "enable_audio": false, "provider": "piapi" }
      },
      {
        "id": "n6",
        "type": "output",
        "position": { "x": 1020, "y": 280 },
        "data": { "name_template": "{brand}_{market}_video_{date}_{slug}", "save_to_library": true }
      }
    ],
    "edges": [
      { "id": "e1", "source": "n1", "target": "n3", "targetHandle": "brand" },
      { "id": "e2", "source": "n2", "target": "n3", "targetHandle": "prompt" },
      { "id": "e3", "source": "n3", "target": "n5", "targetHandle": "image" },
      { "id": "e4", "source": "n4", "target": "n5", "targetHandle": "prompt" },
      { "id": "e5", "source": "n1", "target": "n5", "targetHandle": "brand" },
      { "id": "e6", "source": "n5", "target": "n6", "targetHandle": "asset" }
    ]
  }'::jsonb,
  true,
  now()
)
on conflict do nothing;
