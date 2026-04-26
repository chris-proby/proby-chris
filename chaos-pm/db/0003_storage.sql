-- ============================================================
-- Supabase Storage bucket + policies for canvas file uploads
-- Run AFTER 0002_rls_policies.sql
-- ============================================================

-- create the bucket (private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'canvas-files',
  'canvas-files',
  false,
  10 * 1024 * 1024,                -- 10MB per file
  array[
    'image/png','image/jpeg','image/gif','image/webp','image/svg+xml',
    'application/pdf','text/plain','text/markdown','text/csv',
    'application/json','application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- storage policies
-- path convention: {user_id}/{canvas_id}/{file_id}-{filename}
drop policy if exists "users read own files" on storage.objects;
drop policy if exists "users insert own files" on storage.objects;
drop policy if exists "users delete own files" on storage.objects;

create policy "users read own files" on storage.objects
  for select using (
    bucket_id = 'canvas-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users insert own files" on storage.objects
  for insert with check (
    bucket_id = 'canvas-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users delete own files" on storage.objects
  for delete using (
    bucket_id = 'canvas-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
