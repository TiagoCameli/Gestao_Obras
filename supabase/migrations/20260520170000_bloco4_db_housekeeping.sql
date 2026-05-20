-- Audit Bloco 4: housekeeping de DB consolidado
--
-- 4.1: 12 views recompiladas com security_invoker=true. Hoje todas herdam
--      permissões do dono (postgres), bypassando o RLS restritivo aplicado
--      no Bloco 1.2. Com security_invoker, view roda como o usuário que
--      consulta — RLS das tabelas-base é respeitado.
-- 4.2: search_path fixo nas 2 funções fn_apont_escalar_* (advisor
--      function_search_path_mutable). Sem search_path explícito, função
--      vulnerável a schema-shadowing.
-- 4.3: 3 storage policies em financeiro-anexos: TO public → TO authenticated.
--      Bucket continua public=true (URLs diretas funcionam), mas LIST/INSERT/
--      DELETE agora exige auth. Fecha o lint public_bucket_allows_listing.
-- 4.4: drop 11 índices nunca usados (idx_scan=0), não-PK, não-unique,
--      pre-existentes. Pequenos (8-16KB cada). Se voltarem a ser
--      necessários, recriar.
--
-- 4.5 NÃO incluso: drop dos 3 backups (abastecimentos_backup_20260505,
-- abastecimentos_carreta_backup_20260505, etapas_obra_backup_20260505_obra009)
-- planejado pelo dono em 2026-07-04. Falta ~45 dias.

-- ============================================================================
-- 4.1: 12 views recompiladas com security_invoker=true
-- ============================================================================
ALTER VIEW public.transportadora_movimentos_detalhe SET (security_invoker = true);
ALTER VIEW public.transportadora_saldos SET (security_invoker = true);
ALTER VIEW public.v_checklists_nao_conformidades SET (security_invoker = true);
ALTER VIEW public.v_custo_pecas_equipamento_12m SET (security_invoker = true);
ALTER VIEW public.v_custo_pecas_equipamento_mensal SET (security_invoker = true);
ALTER VIEW public.v_documentos_vencendo SET (security_invoker = true);
ALTER VIEW public.v_equipamento_depreciacao SET (security_invoker = true);
ALTER VIEW public.v_equipamento_medicao_atual SET (security_invoker = true);
ALTER VIEW public.v_proximas_preventivas SET (security_invoker = true);
ALTER VIEW public.v_saldo_estoque SET (security_invoker = true);
ALTER VIEW public.v_saldo_estoque_total SET (security_invoker = true);
ALTER VIEW public.vw_saldos_deposito SET (security_invoker = true);

-- ============================================================================
-- 4.2: search_path fixo nas 2 funções
-- ============================================================================
ALTER FUNCTION public.fn_apont_escalar_para_ponto(uuid, date) SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_apont_escalar_apontamentos_para_ponto() SET search_path = public, pg_temp;

-- ============================================================================
-- 4.3: storage policies financeiro-anexos: public → authenticated
-- ============================================================================
DROP POLICY IF EXISTS "financeiro_anexos_select" ON storage.objects;
DROP POLICY IF EXISTS "financeiro_anexos_insert" ON storage.objects;
DROP POLICY IF EXISTS "financeiro_anexos_delete" ON storage.objects;

CREATE POLICY "financeiro_anexos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'financeiro-anexos');

CREATE POLICY "financeiro_anexos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'financeiro-anexos');

CREATE POLICY "financeiro_anexos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'financeiro-anexos');

-- ============================================================================
-- 4.4: drop 11 índices nunca usados (idx_scan=0, não-PK, não-unique)
-- ============================================================================
DROP INDEX IF EXISTS public.fornecedores_eh_transportadora_idx;
DROP INDEX IF EXISTS public.equipamentos_modelo_idx;
DROP INDEX IF EXISTS public.equipamentos_propriedade_idx;
DROP INDEX IF EXISTS public.equipamentos_status_idx;
DROP INDEX IF EXISTS public.saidas_combustivel_transportadora_idx;
DROP INDEX IF EXISTS public.apont_equipe_obras_obra_idx;
DROP INDEX IF EXISTS public.documentos_equipamento_venc_idx;
DROP INDEX IF EXISTS public.apont_func_status_idx;
DROP INDEX IF EXISTS public.financeiro_equipamento_locadora_idx;
DROP INDEX IF EXISTS public.apont_aud_entidade_idx;
DROP INDEX IF EXISTS public.apont_aud_usuario_idx;
