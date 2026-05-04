-- ============================================================================
-- WIPE: aba "Manutenção" do módulo Frota (pré-existente, antes do módulo
-- /manutencao). Remove todas as tabelas e referências.
-- ============================================================================
-- Tabelas: ordens_servico, itens_os, planos_manutencao, historico_medicoes,
--          checklists_equipamento, historico_inspecao
-- ============================================================================

drop table if exists public.itens_os                cascade;
drop table if exists public.ordens_servico          cascade;
drop table if exists public.planos_manutencao       cascade;
drop table if exists public.historico_medicoes      cascade;
drop table if exists public.historico_inspecao      cascade;
drop table if exists public.checklists_equipamento  cascade;
