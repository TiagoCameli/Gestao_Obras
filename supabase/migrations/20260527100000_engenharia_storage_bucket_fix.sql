-- Engenharia — Onda 2.1: bucket privado + RLS policies em storage.objects.
-- Espelha padrão de checklist-fotos (20260513140000), com gates por chaves
-- de permissão Engenharia (criadas na Onda 1).
-- Rollback: 20260527100100_engenharia_storage_bucket_rollback.sql.

begin;

-- 1) Bucket privado com limite 50 MB e MIME types permitidos
-- 50 MB = 52428800 bytes (D-7 2026-05-26).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'engenharia-arquivos',
  'engenharia-arquivos',
  false,
  52428800,
  array[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/csv',
    'text/plain',
    'application/zip',
    'application/x-zip-compressed',
    'image/vnd.dwg',
    'application/acad',
    'application/dxf',
    'application/octet-stream'  -- DWG/DXF muitas vezes chegam com este MIME
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  public = excluded.public;

-- 2) Policies em storage.objects (4: select/insert/update/delete)
-- Cada uma filtra por bucket_id = 'engenharia-arquivos' AND chave de
-- permissão correspondente.

do $$ begin
  create policy engenharia_arquivos_storage_select on storage.objects
    for select to authenticated
    using (
      bucket_id = 'engenharia-arquivos'
      and private.current_has_action('ver_engenharia')
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy engenharia_arquivos_storage_insert on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'engenharia-arquivos'
      and private.current_has_action('upload_engenharia_arquivo')
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy engenharia_arquivos_storage_update on storage.objects
    for update to authenticated
    using (
      bucket_id = 'engenharia-arquivos'
      and private.current_has_action('upload_engenharia_arquivo')
    )
    with check (
      bucket_id = 'engenharia-arquivos'
      and private.current_has_action('upload_engenharia_arquivo')
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy engenharia_arquivos_storage_delete on storage.objects
    for delete to authenticated
    using (
      bucket_id = 'engenharia-arquivos'
      and (
        private.current_has_action('excluir_engenharia_arquivo')
        or private.current_has_action('excluir_permanente_engenharia')
      )
    );
exception when duplicate_object then null; end $$;

commit;
