-- hub_assets: adiciona kind='hub_video'
--
-- Hub agora tem geração de vídeo (Kling 3.0 via PiAPI default).
-- Cada vídeo gerado vira 1 row em hub_assets com:
--   kind: 'hub_video'
--   content: {
--     video_url (URL hospedada pelo provider — PiAPI 30+ dias),
--     image_url (input pra image-to-video, ou null pra text-to-video),
--     prompt, final_prompt,
--     duration_s, aspect_ratio, resolution ('720p'|'1080p'),
--     mode ('std'|'pro'), enable_audio,
--     provider ('piapi'|'falai'|...), task_id, model ('kling-3.0'),
--     brand_id, market
--   }

alter table public.hub_assets drop constraint if exists hub_assets_kind_check;
alter table public.hub_assets add constraint hub_assets_kind_check
  check (kind in ('hub_image', 'hub_png', 'hub_storyboard', 'hub_carousel', 'hub_transcribe', 'hub_voice', 'hub_video'));
