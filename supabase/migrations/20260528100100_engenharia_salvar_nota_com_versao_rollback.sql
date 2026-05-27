-- Rollback de 20260528100000_engenharia_salvar_nota_com_versao_fix.sql

begin;

drop function if exists public.engenharia_salvar_nota_com_versao(uuid, text, jsonb, int);

commit;
