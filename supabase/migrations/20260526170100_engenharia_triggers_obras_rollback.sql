-- Rollback de 20260526170000_engenharia_triggers_obras_fix.sql

begin;

drop trigger if exists trg_engenharia_after_insert_obra      on public.obras;
drop trigger if exists trg_engenharia_after_update_obra_nome on public.obras;
drop trigger if exists trg_engenharia_before_delete_obra     on public.obras;

drop function if exists public.engenharia_after_insert_obra();
drop function if exists public.engenharia_after_update_obra_nome();
drop function if exists public.engenharia_before_delete_obra();

commit;
