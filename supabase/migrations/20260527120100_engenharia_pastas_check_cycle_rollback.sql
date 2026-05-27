-- Rollback de 20260527120000_engenharia_pastas_check_cycle_fix.sql

begin;

drop trigger if exists trg_engenharia_pastas_check_no_cycle on public.engenharia_pastas;
drop function if exists public.engenharia_pastas_check_no_cycle();

commit;
