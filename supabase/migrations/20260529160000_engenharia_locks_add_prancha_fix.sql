-- Engenharia — inclui 'prancha' nos tipos aceitos pelo lock pessimista.
-- Faltou na migration da Prancha v1 (20260529120000): o frontend já chama
-- engenharia_acquire_lock('prancha', ...) e a constraint só permitia
-- 'nota'/'calculo', estourando "violates check constraint
-- engenharia_locks_recurso_tipo_check" ao editar uma prancha.
-- Rollback: 20260529160100_engenharia_locks_add_prancha_rollback.sql

begin;

alter table public.engenharia_locks
  drop constraint if exists engenharia_locks_recurso_tipo_check;

alter table public.engenharia_locks
  add constraint engenharia_locks_recurso_tipo_check
  check (recurso_tipo = any (array['nota'::text, 'calculo'::text, 'prancha'::text]));

commit;
