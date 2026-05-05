-- hub_assets: adiciona kind='hub_transcribe'
--
-- Hub agora tem transcrição (Whisper-based via analyze-video edge
-- function). Cada transcrição vira uma row em hub_assets com:
--   kind: 'hub_transcribe'
--   content: { transcript, language, source_filename, duration }

alter table public.hub_assets drop constraint if exists hub_assets_kind_check;
alter table public.hub_assets add constraint hub_assets_kind_check
  check (kind in ('hub_image', 'hub_png', 'hub_storyboard', 'hub_carousel', 'hub_transcribe'));
