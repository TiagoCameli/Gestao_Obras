-- Engenharia — Onda 1.2: RLS per-command em todas as 7 tabelas.
-- Padrão: private.current_has_action('chave_de_acao') (já existe).
-- Spec: docs/superpowers/plans/2026-05-26-engenharia-modulo.md (seção 4.RLS).
-- Rollback: 20260526160100_engenharia_rls_rollback.sql.

begin;

-- ============================================================
-- 1) engenharia_pastas
-- ============================================================
alter table public.engenharia_pastas enable row level security;

create policy engenharia_pastas_select on public.engenharia_pastas
  for select to authenticated
  using (private.current_has_action('ver_engenharia') and deleted_at is null);

create policy engenharia_pastas_select_lixeira on public.engenharia_pastas
  for select to authenticated
  using (private.current_has_action('ver_lixeira_engenharia') and deleted_at is not null);

create policy engenharia_pastas_insert on public.engenharia_pastas
  for insert to authenticated
  with check (private.current_has_action('criar_engenharia_pasta'));

create policy engenharia_pastas_update on public.engenharia_pastas
  for update to authenticated
  using (
    private.current_has_action('editar_engenharia_pasta')
    or private.current_has_action('excluir_engenharia_pasta')
    or private.current_has_action('restaurar_lixeira_engenharia')
  )
  with check (
    private.current_has_action('editar_engenharia_pasta')
    or private.current_has_action('excluir_engenharia_pasta')
    or private.current_has_action('restaurar_lixeira_engenharia')
  );

create policy engenharia_pastas_delete on public.engenharia_pastas
  for delete to authenticated
  using (private.current_has_action('excluir_permanente_engenharia'));

-- ============================================================
-- 2) engenharia_notas
-- ============================================================
alter table public.engenharia_notas enable row level security;

create policy engenharia_notas_select on public.engenharia_notas
  for select to authenticated
  using (private.current_has_action('ver_engenharia') and deleted_at is null);

create policy engenharia_notas_select_lixeira on public.engenharia_notas
  for select to authenticated
  using (private.current_has_action('ver_lixeira_engenharia') and deleted_at is not null);

create policy engenharia_notas_insert on public.engenharia_notas
  for insert to authenticated
  with check (private.current_has_action('criar_engenharia_nota'));

create policy engenharia_notas_update on public.engenharia_notas
  for update to authenticated
  using (
    private.current_has_action('editar_engenharia_nota')
    or private.current_has_action('excluir_engenharia_nota')
    or private.current_has_action('restaurar_lixeira_engenharia')
  )
  with check (
    private.current_has_action('editar_engenharia_nota')
    or private.current_has_action('excluir_engenharia_nota')
    or private.current_has_action('restaurar_lixeira_engenharia')
  );

create policy engenharia_notas_delete on public.engenharia_notas
  for delete to authenticated
  using (private.current_has_action('excluir_permanente_engenharia'));

-- ============================================================
-- 3) engenharia_notas_versoes
-- ============================================================
alter table public.engenharia_notas_versoes enable row level security;

create policy engenharia_notas_versoes_select on public.engenharia_notas_versoes
  for select to authenticated
  using (private.current_has_action('ver_historico_engenharia'));

create policy engenharia_notas_versoes_insert on public.engenharia_notas_versoes
  for insert to authenticated
  with check (private.current_has_action('editar_engenharia_nota'));

create policy engenharia_notas_versoes_delete on public.engenharia_notas_versoes
  for delete to authenticated
  using (private.current_has_action('excluir_permanente_engenharia'));

-- ============================================================
-- 4) engenharia_calculos
-- ============================================================
alter table public.engenharia_calculos enable row level security;

create policy engenharia_calculos_select on public.engenharia_calculos
  for select to authenticated
  using (private.current_has_action('ver_engenharia') and deleted_at is null);

create policy engenharia_calculos_select_lixeira on public.engenharia_calculos
  for select to authenticated
  using (private.current_has_action('ver_lixeira_engenharia') and deleted_at is not null);

create policy engenharia_calculos_insert on public.engenharia_calculos
  for insert to authenticated
  with check (private.current_has_action('criar_engenharia_calculo'));

create policy engenharia_calculos_update on public.engenharia_calculos
  for update to authenticated
  using (
    private.current_has_action('editar_engenharia_calculo')
    or private.current_has_action('excluir_engenharia_calculo')
    or private.current_has_action('restaurar_lixeira_engenharia')
  )
  with check (
    private.current_has_action('editar_engenharia_calculo')
    or private.current_has_action('excluir_engenharia_calculo')
    or private.current_has_action('restaurar_lixeira_engenharia')
  );

create policy engenharia_calculos_delete on public.engenharia_calculos
  for delete to authenticated
  using (private.current_has_action('excluir_permanente_engenharia'));

-- ============================================================
-- 5) engenharia_calculos_versoes
-- ============================================================
alter table public.engenharia_calculos_versoes enable row level security;

create policy engenharia_calculos_versoes_select on public.engenharia_calculos_versoes
  for select to authenticated
  using (private.current_has_action('ver_historico_engenharia'));

create policy engenharia_calculos_versoes_insert on public.engenharia_calculos_versoes
  for insert to authenticated
  with check (private.current_has_action('editar_engenharia_calculo'));

create policy engenharia_calculos_versoes_delete on public.engenharia_calculos_versoes
  for delete to authenticated
  using (private.current_has_action('excluir_permanente_engenharia'));

-- ============================================================
-- 6) engenharia_arquivos
-- ============================================================
alter table public.engenharia_arquivos enable row level security;

create policy engenharia_arquivos_select on public.engenharia_arquivos
  for select to authenticated
  using (private.current_has_action('ver_engenharia') and deleted_at is null);

create policy engenharia_arquivos_select_lixeira on public.engenharia_arquivos
  for select to authenticated
  using (private.current_has_action('ver_lixeira_engenharia') and deleted_at is not null);

create policy engenharia_arquivos_insert on public.engenharia_arquivos
  for insert to authenticated
  with check (private.current_has_action('upload_engenharia_arquivo'));

create policy engenharia_arquivos_update on public.engenharia_arquivos
  for update to authenticated
  using (
    private.current_has_action('excluir_engenharia_arquivo')
    or private.current_has_action('restaurar_lixeira_engenharia')
  )
  with check (
    private.current_has_action('excluir_engenharia_arquivo')
    or private.current_has_action('restaurar_lixeira_engenharia')
  );

create policy engenharia_arquivos_delete on public.engenharia_arquivos
  for delete to authenticated
  using (private.current_has_action('excluir_permanente_engenharia'));

-- ============================================================
-- 7) engenharia_locks — todos com ver_engenharia podem ler; só o dono ou admin escreve
-- ============================================================
alter table public.engenharia_locks enable row level security;

create policy engenharia_locks_select on public.engenharia_locks
  for select to authenticated
  using (private.current_has_action('ver_engenharia'));

-- INSERT/UPDATE só pela função SECDEF engenharia_acquire_lock (Task 4).
-- Por isso negamos INSERT/UPDATE direto via REST. Mantemos delete só pra admin.
create policy engenharia_locks_insert on public.engenharia_locks
  for insert to authenticated
  with check (false);

create policy engenharia_locks_update on public.engenharia_locks
  for update to authenticated
  using (false)
  with check (false);

create policy engenharia_locks_delete on public.engenharia_locks
  for delete to authenticated
  using (
    -- Dono libera o próprio lock OU admin força liberação
    usuario_id = auth.uid()
    or private.current_has_action('gerenciar_locks_engenharia')
  );

commit;
