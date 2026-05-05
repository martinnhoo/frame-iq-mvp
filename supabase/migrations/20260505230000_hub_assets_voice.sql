-- hub_assets: adiciona kind='hub_voice'
--
-- Hub agora tem geração de voz (ElevenLabs TTS). Cada áudio gerado
-- vira uma row em hub_assets com:
--   kind: 'hub_voice'
--   content: {
--     audio_url (data URL mp3),
--     text (script),
--     voice_id, voice_name,
--     model_id,
--     stability, similarity_boost,
--     characters, duration_estimate
--   }

alter table public.hub_assets drop constraint if exists hub_assets_kind_check;
alter table public.hub_assets add constraint hub_assets_kind_check
  check (kind in ('hub_image', 'hub_png', 'hub_storyboard', 'hub_carousel', 'hub_transcribe', 'hub_voice'));
