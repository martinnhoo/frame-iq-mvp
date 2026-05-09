-- hub-images bucket: bumpa file_size_limit pra 100MB pra cobrir videos
-- Meta Ads (Reels, In-Feed, TikTok ads).
--
-- Whisper API limit ainda é 25MB — vídeos maiores skipam transcript
-- e geram legenda só com base nos frames visuais (server já trata).
--
-- Antes: 25MB (cobria Kling 3.0 ~10s 1080p) — qualquer vídeo de
-- creative real (15-30s 1080p ~30-80MB) batia no limite.
--
-- Depois: 100MB cobre creative médio (15s 1080p ~30MB, 30s 1080p ~60MB,
-- 60s comprimido ~80MB). Limite Meta Ads pra Reels é 4GB mas vídeos
-- assim grandes não fazem sentido pra caption-gen (downsample manual).

update storage.buckets
set file_size_limit = 100 * 1024 * 1024  -- 100MB
where id = 'hub-images';
