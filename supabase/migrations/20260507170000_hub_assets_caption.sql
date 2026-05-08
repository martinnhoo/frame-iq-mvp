-- hub_assets: adiciona kind='hub_caption' (gerador de legendas TikTok+FB)
--
-- Cada legenda gerada vira 1 row em hub_assets com:
--   kind: 'hub_caption'
--   content: {
--     image_url (imagem analisada),
--     fb_caption (4 linhas com emojis, formato user request),
--     tiktok_caption (≤95 chars sem emojis),
--     brand_id, market, language ('pt-BR'/'es-MX'/'hinglish'/etc),
--     model: 'claude-haiku-4-5-20251001'
--   }

alter table public.hub_assets drop constraint if exists hub_assets_kind_check;
alter table public.hub_assets add constraint hub_assets_kind_check
  check (kind in (
    'hub_image',
    'hub_png',
    'hub_storyboard',
    'hub_carousel',
    'hub_transcribe',
    'hub_voice',
    'hub_video',
    'hub_faceswap',
    'hub_caption'
  ));
