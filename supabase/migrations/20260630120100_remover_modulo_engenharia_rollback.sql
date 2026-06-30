-- Rollback de 20260630120000_remover_modulo_engenharia_fix.sql
--
-- ATENÇÃO: este rollback NÃO restaura os dados do módulo Engenharia. O conteúdo
-- (pastas, notas, cálculos, pranchas, arquivos, versões e locks) foi apagado
-- pela migration _fix e não é recuperável por aqui (só por backup/PITR do
-- Supabase, se necessário).
--
-- Para reconstruir a ESTRUTURA do módulo (tabelas, RLS, índices, funções,
-- triggers no obras e o bucket de Storage), re-aplique as migrations originais
-- do módulo, que continuam versionadas no repo:
--   20260526150000_engenharia_tables_fix.sql
--   20260526160000_engenharia_rls_fix.sql
--   20260526170000_engenharia_triggers_obras_fix.sql
--   20260526180000_engenharia_locks_functions_fix.sql
--   20260526190000_engenharia_perf_fix.sql
--   20260527100000_engenharia_storage_bucket_fix.sql
--   20260527110000_engenharia_secdef_revoke_fix.sql
--   20260527120000_engenharia_pastas_check_cycle_fix.sql
--   20260528100000_engenharia_salvar_nota_com_versao_fix.sql
--   20260528200000_engenharia_salvar_calculo_com_versao_fix.sql
--   20260528210000_engenharia_backfill_acoes_por_cargo_fix.sql
--   20260529120000_engenharia_pranchas_fix.sql
--   20260529130000_engenharia_backfill_prancha_por_cargo_fix.sql
--   20260529160000_engenharia_locks_add_prancha_fix.sql
-- E reverta o commit de remoção no frontend (src/modules/engenharia + as
-- referências em App.tsx, Header.tsx e src/utils/permissions.ts).

DO $$
BEGIN
  RAISE NOTICE 'Rollback do remover_modulo_engenharia e apenas informativo: re-aplique as migrations originais 20260526150000.._fix .. 20260529160000_fix para recriar a estrutura. Dados nao sao restaurados aqui.';
END $$;
