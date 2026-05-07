-- hub_assets: adiciona kind='hub_faceswap'
--
-- Hub agora tem face swap (PiAPI Qubico/image-toolkit + Qubico/video-toolkit).
-- Cada troca gerada vira 1 row em hub_assets com:
--   kind: 'hub_faceswap'
--   content: {
--     mode ('image'|'video'),
--     output_url (URL persistente — Supabase Storage hub-images/{user}/faceswap/),
--     piapi_url (URL raw do PiAPI — backup),
--     image_url ou video_url (== output_url, pra Library reaproveitar parser),
--     target_url, swap_image_url (inputs originais),
--     task_id, model ('Qubico/image-toolkit'|'Qubico/video-toolkit'),
--     brand_id
--   }
--
-- Sem essa migration, INSERT em hub_assets com kind='hub_faceswap' falha
-- com violação do CHECK constraint hub_assets_kind_check, e o asset não
-- aparece na Library.

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
    'hub_faceswap'
  ));
