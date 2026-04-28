-- ═══════════════════════════════════════════════════════════════════════════
-- Apontamento — remove "centro de custo" (consolidado com Obra)
-- e torna a alocação (obra/equipe) opcional, pois passa a ser gerenciada
-- numa aba dedicada do módulo, separada do cadastro do funcionário.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Drop FK + coluna centro_custo_id de apont_funcionarios
alter table public.apont_funcionarios
  drop column if exists centro_custo_id;

-- 2) Torna obra/equipe nullable
alter table public.apont_funcionarios
  alter column obra_id   drop not null,
  alter column equipe_id drop not null;

-- 3) Drop tabela apont_centros_custo (não há mais referências)
drop table if exists public.apont_centros_custo cascade;
