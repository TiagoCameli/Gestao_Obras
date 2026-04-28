-- ═══════════════════════════════════════════════════════════════════════════
-- Apontamento — passa a usar as obras do módulo Medição (rodotracker_obras).
-- Drop apont_obras e altera FKs em apont_equipes / apont_funcionarios pra
-- text referenciando rodotracker_obras(id).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Drop FKs antigas pra apont_obras
alter table public.apont_equipes
  drop constraint if exists apont_equipes_obra_id_fkey;
alter table public.apont_funcionarios
  drop constraint if exists apont_funcionarios_obra_id_fkey;

-- 2) Converte coluna obra_id de uuid → text (tabelas vazias até então)
alter table public.apont_equipes
  alter column obra_id type text using obra_id::text;
alter table public.apont_funcionarios
  alter column obra_id type text using obra_id::text;

-- 3) Cria novas FKs apontando pra rodotracker_obras
alter table public.apont_equipes
  add constraint apont_equipes_obra_fk
  foreign key (obra_id) references public.rodotracker_obras(id) on delete restrict;
alter table public.apont_funcionarios
  add constraint apont_funcionarios_obra_fk
  foreign key (obra_id) references public.rodotracker_obras(id) on delete restrict;

-- 4) Drop tabela apont_obras (não é mais usada)
drop table if exists public.apont_obras cascade;
