-- Rollback: volta a constraint pra aceitar só 'nota'/'calculo'.
-- ATENÇÃO: só aplicar se não houver locks de prancha vivos (senão a constraint
-- falha ao validar linhas existentes). Em geral os locks expiram por TTL.
begin;

alter table public.engenharia_locks
  drop constraint if exists engenharia_locks_recurso_tipo_check;

alter table public.engenharia_locks
  add constraint engenharia_locks_recurso_tipo_check
  check (recurso_tipo = any (array['nota'::text, 'calculo'::text]));

commit;
