-- Rollback de 20260630130000_remover_modulos_compras_financeiro_fix.sql
--
-- ATENÇÃO: NÃO restaura os dados de Compras/Financeiro (apagados pela _fix e
-- só recuperáveis por backup/PITR do Supabase). Para reconstruir a ESTRUTURA,
-- re-aplique as migrations originais dos dois módulos, que seguem no repo:
--   Compras:    20260218100000_create_compras_tables.sql e seguintes
--               (recebimentos_oc, portal de cotação, auditoria/notificações/
--               lixeira/anexos, RLS) até ~20260522140500.
--   Financeiro: 20260518100000_create_financeiro_module.sql,
--               20260522140500_tighten_rls_financeiro_operacional.sql,
--               20260522140600_privatize_financeiro_anexos_bucket.sql.
-- E reverta o commit de remoção no frontend (pages/Compras, pages/Financeiro,
-- pages/PortalCotacao, components/compras, components/financeiro, hooks/utils,
-- e as referências em App.tsx, Header.tsx e src/utils/permissions.ts).
--
-- NÃO afeta o "Financeiro do equipamento" da Frota (financeiro_equipamento),
-- que nunca foi removido.

DO $$
BEGIN
  RAISE NOTICE 'Rollback de remover_modulos_compras_financeiro e apenas informativo: re-aplique as migrations originais de Compras (a partir de 20260218100000) e Financeiro (20260518100000, 20260522140500, 20260522140600) para recriar a estrutura. Dados nao sao restaurados aqui.';
END $$;
