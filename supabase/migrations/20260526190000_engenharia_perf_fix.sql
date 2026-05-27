-- Engenharia — Onda 1.5 (perf): fix WARN do advisors
-- "Auth RLS Initialization Plan" — auth.uid() era re-avaliado por linha
-- em engenharia_locks_delete. Usar (select auth.uid()) avalia 1x por query.
-- Rollback: 20260526190100_engenharia_perf_rollback.sql.

begin;

drop policy if exists engenharia_locks_delete on public.engenharia_locks;

create policy engenharia_locks_delete on public.engenharia_locks
  for delete to authenticated
  using (
    usuario_id = (select auth.uid())
    or private.current_has_action('gerenciar_locks_engenharia')
  );

commit;
