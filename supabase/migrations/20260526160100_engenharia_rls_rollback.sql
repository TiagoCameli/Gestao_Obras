-- Rollback de 20260526160000_engenharia_rls_fix.sql

begin;

alter table public.engenharia_pastas            disable row level security;
alter table public.engenharia_notas             disable row level security;
alter table public.engenharia_notas_versoes     disable row level security;
alter table public.engenharia_calculos          disable row level security;
alter table public.engenharia_calculos_versoes  disable row level security;
alter table public.engenharia_arquivos          disable row level security;
alter table public.engenharia_locks             disable row level security;

drop policy if exists engenharia_pastas_select          on public.engenharia_pastas;
drop policy if exists engenharia_pastas_select_lixeira  on public.engenharia_pastas;
drop policy if exists engenharia_pastas_insert          on public.engenharia_pastas;
drop policy if exists engenharia_pastas_update          on public.engenharia_pastas;
drop policy if exists engenharia_pastas_delete          on public.engenharia_pastas;

drop policy if exists engenharia_notas_select          on public.engenharia_notas;
drop policy if exists engenharia_notas_select_lixeira  on public.engenharia_notas;
drop policy if exists engenharia_notas_insert          on public.engenharia_notas;
drop policy if exists engenharia_notas_update          on public.engenharia_notas;
drop policy if exists engenharia_notas_delete          on public.engenharia_notas;

drop policy if exists engenharia_notas_versoes_select on public.engenharia_notas_versoes;
drop policy if exists engenharia_notas_versoes_insert on public.engenharia_notas_versoes;
drop policy if exists engenharia_notas_versoes_delete on public.engenharia_notas_versoes;

drop policy if exists engenharia_calculos_select          on public.engenharia_calculos;
drop policy if exists engenharia_calculos_select_lixeira  on public.engenharia_calculos;
drop policy if exists engenharia_calculos_insert          on public.engenharia_calculos;
drop policy if exists engenharia_calculos_update          on public.engenharia_calculos;
drop policy if exists engenharia_calculos_delete          on public.engenharia_calculos;

drop policy if exists engenharia_calculos_versoes_select on public.engenharia_calculos_versoes;
drop policy if exists engenharia_calculos_versoes_insert on public.engenharia_calculos_versoes;
drop policy if exists engenharia_calculos_versoes_delete on public.engenharia_calculos_versoes;

drop policy if exists engenharia_arquivos_select          on public.engenharia_arquivos;
drop policy if exists engenharia_arquivos_select_lixeira  on public.engenharia_arquivos;
drop policy if exists engenharia_arquivos_insert          on public.engenharia_arquivos;
drop policy if exists engenharia_arquivos_update          on public.engenharia_arquivos;
drop policy if exists engenharia_arquivos_delete          on public.engenharia_arquivos;

drop policy if exists engenharia_locks_select on public.engenharia_locks;
drop policy if exists engenharia_locks_insert on public.engenharia_locks;
drop policy if exists engenharia_locks_update on public.engenharia_locks;
drop policy if exists engenharia_locks_delete on public.engenharia_locks;

commit;
