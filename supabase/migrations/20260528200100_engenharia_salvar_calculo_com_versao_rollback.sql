-- Rollback de 20260528200000_engenharia_salvar_calculo_com_versao_fix.sql

begin;

drop function if exists public.engenharia_salvar_calculo_com_versao(uuid, text, jsonb, boolean, int);

commit;
