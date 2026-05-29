-- Rollback de 20260529120000_engenharia_pranchas_fix.sql
begin;
drop function if exists public.engenharia_salvar_prancha_com_versao(uuid, text, jsonb, int);
drop table if exists public.engenharia_pranchas_versoes;
drop table if exists public.engenharia_pranchas;
commit;
