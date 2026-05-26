-- Rollback de 20260526180000_engenharia_locks_functions_fix.sql

begin;

drop function if exists public.engenharia_acquire_lock(text, uuid, int);
drop function if exists public.engenharia_release_lock(text, uuid);

commit;
