-- Rollback de 20260526150000_engenharia_tables_fix.sql
-- Ordem reversa para respeitar FKs.

begin;

drop table if exists public.engenharia_locks            cascade;
drop table if exists public.engenharia_arquivos         cascade;
drop table if exists public.engenharia_calculos_versoes cascade;
drop table if exists public.engenharia_calculos         cascade;
drop table if exists public.engenharia_notas_versoes    cascade;
drop table if exists public.engenharia_notas            cascade;
drop table if exists public.engenharia_pastas           cascade;

commit;
