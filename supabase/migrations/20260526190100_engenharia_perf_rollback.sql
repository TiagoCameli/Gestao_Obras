-- Rollback de 20260526190000_engenharia_perf_fix.sql
-- Restaura policy com auth.uid() inline (formato antigo).

begin;

drop policy if exists engenharia_locks_delete on public.engenharia_locks;

create policy engenharia_locks_delete on public.engenharia_locks
  for delete to authenticated
  using (
    usuario_id = auth.uid()
    or private.current_has_action('gerenciar_locks_engenharia')
  );

commit;
