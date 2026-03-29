begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-documents',
  'chat-documents',
  false,
  5242880,
  array['text/plain', 'text/markdown', 'application/pdf']
)
on conflict (id) do nothing;

drop policy if exists "chat_documents_select_own" on storage.objects;
create policy "chat_documents_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'chat-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "chat_documents_insert_own" on storage.objects;
create policy "chat_documents_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'chat-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "chat_documents_update_own" on storage.objects;
create policy "chat_documents_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'chat-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'chat-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "chat_documents_delete_own" on storage.objects;
create policy "chat_documents_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'chat-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;
