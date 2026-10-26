-- Eworks: mevcut Supabase hesabına özel beyanname dosyaları.
begin;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('eworks-declarations','eworks-declarations',false,20971520,array['application/pdf'])
on conflict (id) do nothing;
do $$ begin
 if exists(select 1 from storage.buckets where id='eworks-declarations' and public) then
  raise exception 'Beyanname deposu özel olmalı; açık depo kullanılamaz';
 end if;
end $$;
drop policy if exists eworks_documents_read on storage.objects;
create policy eworks_documents_read on storage.objects for select to authenticated
 using (bucket_id='eworks-declarations' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists eworks_documents_insert on storage.objects;
create policy eworks_documents_insert on storage.objects for insert to authenticated
 with check (bucket_id='eworks-declarations' and (storage.foldername(name))[1]=(select auth.uid())::text
 and array_length(storage.foldername(name),1)=3 and storage.extension(name)='pdf');
-- Dosyalar içerik özetiyle adreslenir; güncelleme/silme yetkisi gerekmez.
commit;
