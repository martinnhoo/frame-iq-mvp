-- Template "Voice over": prompt simples → áudio MP3 ElevenLabs.
-- Útil pra gerar voiceovers rápidos pra editar no After/Premiere.
--
-- Grafo:
--   prompt ─→ voice ─→ output
-- (output detecta audio_url ao invés de image_url e baixa MP3)

insert into public.hub_workflows (user_id, name, description, brand_id, graph, is_template, created_at)
values (
  null,
  'Voice over',
  'Texto vira áudio MP3 via ElevenLabs (voz Rachel default).',
  null,
  '{
    "version": 1,
    "nodes": [
      {
        "id": "n1",
        "type": "prompt",
        "position": { "x": 80, "y": 200 },
        "data": { "text": "Olá! Aposte agora na BETBUS e ganhe 10 dólares a cada gol do Cristiano Ronaldo." }
      },
      {
        "id": "n2",
        "type": "voice",
        "position": { "x": 400, "y": 200 },
        "data": { "voice_id": "21m00Tcm4TlvDq8ikWAM", "voice_name": "Rachel" }
      },
      {
        "id": "n3",
        "type": "output",
        "position": { "x": 720, "y": 200 },
        "data": { "name_template": "voiceover_{date}_{slug}", "save_to_library": true }
      }
    ],
    "edges": [
      { "id": "e1", "source": "n1", "target": "n2", "targetHandle": "text" },
      { "id": "e2", "source": "n2", "target": "n3", "targetHandle": "asset" }
    ]
  }'::jsonb,
  true,
  now()
)
on conflict do nothing;
