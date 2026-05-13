-- Marco 5 / PR25: bucket dedicado pra fotos de checklist (obrigatória quando resposta = 'nao').
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('checklist-fotos', 'checklist-fotos', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

do $$ begin
  create policy "Authenticated upload checklist-fotos" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'checklist-fotos');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Authenticated read checklist-fotos" on storage.objects
    for select to authenticated
    using (bucket_id = 'checklist-fotos');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Authenticated update checklist-fotos" on storage.objects
    for update to authenticated
    using (bucket_id = 'checklist-fotos')
    with check (bucket_id = 'checklist-fotos');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Authenticated delete checklist-fotos" on storage.objects
    for delete to authenticated
    using (bucket_id = 'checklist-fotos');
exception when duplicate_object then null; end $$;
