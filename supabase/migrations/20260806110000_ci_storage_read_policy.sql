-- Permite que o dono LEIA os objetos da própria marca no bucket privado.
-- Sem isto a página não consegue assinar URL de keyframe: o bucket é privado e
-- o cliente não tem service role. A policy amarra o path (brands/{brand_id}/…)
-- ao dono da marca, então continua sendo impossível ler o bucket de outro.
drop policy if exists ci_media_read_own on storage.objects;
create policy ci_media_read_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'ci-media'
    and exists (
      select 1 from public.ci_brands b
       where b.user_id = auth.uid()
         and b.id::text = split_part(name, '/', 2)
    )
  );
