-- hub-images bucket: permite video/mp4 e amplia file_size_limit
--
-- Bucket original aceitava só image/png, image/jpeg, image/webp e 10MB.
-- Agora também guarda:
--   - vídeos gerados pelo Kling 3.0 (hub-video-gen) → re-upload do MP4
--     do PiAPI pra ter URL persistente
--   - vídeo destino do Faceswap (hub-faceswap mode=video) → user
--     uploada MP4 pra Storage pra passar HTTP URL pro PiAPI
--   - output de vídeo do Faceswap após PiAPI processar
--
-- Limite: 25MB cobre Kling 3.0 ~10s 1080p (~12-18MB) e MP4 destino
-- do Faceswap (PiAPI limit é 10MB no input, mas output pode crescer).
--
-- Sem esta migration, upload de qualquer .mp4 retorna:
--   Status 415 — invalid_mime_type — mime type video/mp4 is not supported
-- e o user vê "Não consegui preparar os arquivos. Tenta enviar de novo."

update storage.buckets
set
  file_size_limit = 25 * 1024 * 1024,  -- 25MB
  allowed_mime_types = array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'video/mp4'
  ]
where id = 'hub-images';
