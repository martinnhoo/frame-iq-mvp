-- Storage bucket pra Hub: hub-images
--
-- Por que precisa: URLs que a OpenAI retorna são temporárias (~1h).
-- Pra que a Biblioteca interna do Hub mostre as imagens depois desse
-- prazo, edge function baixa a imagem da OpenAI e sobe pro Storage,
-- gravando a URL permanente no creative_memory.
--
-- Bucket é público pra leitura (URLs direto-acessíveis no <img>),
-- mas escrita só com auth — RLS em storage.objects garante que
-- cada usuário só pode escrever no próprio prefixo {user_id}/.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hub-images',
  'hub-images',
  true,
  10 * 1024 * 1024, -- 10MB max
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- RLS — usuário só pode dar INSERT no próprio prefixo
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'hub_images_user_upload'
  ) then
    create policy hub_images_user_upload
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'hub-images'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'hub_images_user_read'
  ) then
    create policy hub_images_user_read
      on storage.objects for select
      to authenticated
      using (
        bucket_id = 'hub-images'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'hub_images_user_update'
  ) then
    create policy hub_images_user_update
      on storage.objects for update
      to authenticated
      using (
        bucket_id = 'hub-images'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
      with check (
        bucket_id = 'hub-images'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  -- Leitura pública pra <img> conseguir carregar sem auth.
  -- Bucket já é public:true, mas garantimos com policy explícita.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'hub_images_public_read'
  ) then
    create policy hub_images_public_read
      on storage.objects for select
      to anon
      using (bucket_id = 'hub-images');
  end if;
end $$;
