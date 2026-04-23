-- ═══════════════════════════════════════════════════════════════════════════
-- Afrouxa o RLS do RodoTracker: todos os usuários autenticados veem e
-- editam os mesmos dados (modo "team tool"). Mantém a coluna `user_id`
-- pra atribuição/auditoria, mas não filtra por ela.
-- ═══════════════════════════════════════════════════════════════════════════

-- Tabelas
drop policy if exists "rt_obras_own"          on public.rodotracker_obras;
drop policy if exists "rt_activities_own"     on public.rodotracker_activities;
drop policy if exists "rt_plan_items_own"     on public.rodotracker_plan_items;
drop policy if exists "rt_contract_items_own" on public.rodotracker_contract_items;
drop policy if exists "rt_medicao_own"        on public.rodotracker_medicao;

create policy "rt_obras_authed" on public.rodotracker_obras
  for all to authenticated using (true) with check (true);

create policy "rt_activities_authed" on public.rodotracker_activities
  for all to authenticated using (true) with check (true);

create policy "rt_plan_items_authed" on public.rodotracker_plan_items
  for all to authenticated using (true) with check (true);

create policy "rt_contract_items_authed" on public.rodotracker_contract_items
  for all to authenticated using (true) with check (true);

create policy "rt_medicao_authed" on public.rodotracker_medicao
  for all to authenticated using (true) with check (true);

-- Storage: qualquer autenticado lê/escreve em qualquer sub-pasta dos
-- buckets do módulo. (O user_id/folder continua como caminho pra organizar
-- os uploads, mas qualquer um vê todos.)
drop policy if exists "rt_photos_read_own"   on storage.objects;
drop policy if exists "rt_photos_write_own"  on storage.objects;
drop policy if exists "rt_photos_update_own" on storage.objects;
drop policy if exists "rt_photos_delete_own" on storage.objects;
drop policy if exists "rt_pdfs_read_own"     on storage.objects;
drop policy if exists "rt_pdfs_write_own"    on storage.objects;
drop policy if exists "rt_pdfs_update_own"   on storage.objects;
drop policy if exists "rt_pdfs_delete_own"   on storage.objects;

create policy "rt_photos_authed_all"
  on storage.objects for all to authenticated
  using (bucket_id = 'rodotracker-photos')
  with check (bucket_id = 'rodotracker-photos');

create policy "rt_pdfs_authed_all"
  on storage.objects for all to authenticated
  using (bucket_id = 'rodotracker-pdfs')
  with check (bucket_id = 'rodotracker-pdfs');
