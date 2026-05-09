-- hub-captions bucket — vídeos de origem do Caption Generator (até 100MB)
--
-- Por que separar de hub-images:
--   hub-images guarda imagens (PNG/JPG/WEBP) usadas em todo o Hub
--   (image-gen, faceswap, png-gen, storyboard, carousel). Aceita até
--   25MB pra cobrir os MP4s legados do Faceswap/Kling. Bumpar pra 100MB
--   pra cobrir vídeos do Caption Gen permitiria PNG de 100MB em qualquer
--   lugar — desperdício de storage.
--
--   Solução: bucket dedicado pra vídeos do Caption Gen. Limite alto
--   (100MB) só onde faz sentido (vídeos curtos pra Whisper + vision).
--   hub-images volta pra 25MB.
--
-- RLS: mesma pattern de hub-images — usuário só escreve no próprio
-- prefixo {user_id}/, leitura pública (URLs em <video src>).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hub-captions',
  'hub-captions',
  true,
  100 * 1024 * 1024, -- 100MB pra cobrir Reels/TikTok ads (15-30s 1080p)
  array['video/mp4']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Reverte hub-images pra 25MB (era 100MB depois da migration de ontem).
-- 25MB cobre Kling 3.0 + frames extraídos de vídeo (PNG/JPG ~500KB cada).
update storage.buckets
set file_size_limit = 25 * 1024 * 1024
where id = 'hub-images';

-- RLS pra hub-captions
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'hub_captions_user_upload'
  ) then
    create policy hub_captions_user_upload
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'hub-captions'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'hub_captions_user_read'
  ) then
    create policy hub_captions_user_read
      on storage.objects for select
      to authenticated
      using (
        bucket_id = 'hub-captions'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'hub_captions_user_delete'
  ) then
    create policy hub_captions_user_delete
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'hub-captions'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'hub_captions_public_read'
  ) then
    create policy hub_captions_public_read
      on storage.objects for select
      to anon
      using (bucket_id = 'hub-captions');
  end if;
end $$;
