-- Adiciona suporte a fotos nos abastecimentos (saídas de combustível).
-- Storage: bucket privado `abastecimento-fotos` (criado via API).

alter table public.abastecimentos
  add column if not exists fotos_urls text[] not null default '{}';

-- Policies do bucket
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'abastecimento_fotos_authenticated_read' and tablename = 'objects') then
    create policy "abastecimento_fotos_authenticated_read" on storage.objects
      for select to authenticated using (bucket_id = 'abastecimento-fotos');
  end if;
  if not exists (select 1 from pg_policies where policyname = 'abastecimento_fotos_authenticated_write' and tablename = 'objects') then
    create policy "abastecimento_fotos_authenticated_write" on storage.objects
      for insert to authenticated with check (bucket_id = 'abastecimento-fotos');
  end if;
  if not exists (select 1 from pg_policies where policyname = 'abastecimento_fotos_authenticated_delete' and tablename = 'objects') then
    create policy "abastecimento_fotos_authenticated_delete" on storage.objects
      for delete to authenticated using (bucket_id = 'abastecimento-fotos');
  end if;
exception when others then
  raise notice 'Policies de storage precisam ser configuradas via dashboard';
end $$;
