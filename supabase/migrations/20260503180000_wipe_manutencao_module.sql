-- ============================================================================
-- WIPE: remove o módulo de Manutenção inteiro do banco.
-- Inclui:
--   • 8 tabelas (equipamento_modelos, manutencao_tarefas, manutencao_fluidos,
--     manutencao_pecas, manutencao_horimetro_leituras, manutencao_agendamentos,
--     manutencao_registros, manutencao_alertas) — cascade
--   • 6 colunas adicionadas à tabela equipamentos
--   • function manutencao_set_updated_at()
--   • policies de storage do bucket manutencao-fotos
--   • o próprio bucket (e tudo dentro)
-- ============================================================================
-- IRREVERSÍVEL.
-- ============================================================================

-- Drop policies de storage primeiro (bucket já removido via Storage API)
drop policy if exists "manutencao_fotos_authenticated_read"   on storage.objects;
drop policy if exists "manutencao_fotos_authenticated_write"  on storage.objects;
drop policy if exists "manutencao_fotos_authenticated_delete" on storage.objects;
-- NOTA: bucket `manutencao-fotos` e seus objetos foram removidos previamente
-- via Storage API (DELETE direto em storage.* não é permitido no Supabase).

-- Drop tabelas em ordem (cascade resolve FKs cruzadas)
drop table if exists public.manutencao_alertas             cascade;
drop table if exists public.manutencao_registros           cascade;
drop table if exists public.manutencao_agendamentos        cascade;
drop table if exists public.manutencao_horimetro_leituras  cascade;
drop table if exists public.manutencao_tarefas             cascade;
drop table if exists public.equipamento_modelos            cascade;
drop table if exists public.manutencao_pecas               cascade;
drop table if exists public.manutencao_fluidos             cascade;

-- Drop colunas adicionadas à tabela equipamentos
alter table public.equipamentos
  drop column if exists modelo_id,
  drop column if exists prefixo_serie,
  drop column if exists horimetro_funcional,
  drop column if exists horimetro_atual,
  drop column if exists notas_unidade,
  drop column if exists alertas_criticos;

-- Drop function genérica de updated_at do módulo
drop function if exists public.manutencao_set_updated_at() cascade;
