-- Audit Frete (Item #7 do frete-audit.md): tighten RLS em fornecedores
-- e obras. Eram blanket "Authenticated full access" (USING true) — qualquer
-- usuário authenticated podia DELETE/UPDATE direto via PostgREST, flipar
-- flag eh_transportadora ou zerar taxa_litro_padrao em fornecedores, ou
-- editar orçamento de obras.
--
-- Decisão SELECT aberto (USING true): fornecedores e obras são lookup
-- tables consumidas por quase todos os módulos (combustível, frete,
-- manutenção, apontamentos, materiais). Mesmo padrão de colaboradores em
-- 20260520120000_tighten_rls_critical_tables.sql. Se quiser apertar SELECT
-- depois, criar ações ver_fornecedores/ver_obras_v2 nos perfis primeiro
-- pra não quebrar dashboards de outros módulos.
--
-- INSERT/UPDATE/DELETE gated por ações existentes em
-- funcionarios.acoes_permitidas (criar_fornecedores, editar_fornecedores,
-- excluir_fornecedores, criar_obras, editar_obras, excluir_obras).
-- Cargo = 'Administrador' bypassa via private.current_has_action.
--
-- Idempotente.

-- ============================================================================
-- fornecedores
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated full access" ON public.fornecedores;
DROP POLICY IF EXISTS fornecedores_select_authenticated ON public.fornecedores;
DROP POLICY IF EXISTS fornecedores_insert_authorized ON public.fornecedores;
DROP POLICY IF EXISTS fornecedores_update_authorized ON public.fornecedores;
DROP POLICY IF EXISTS fornecedores_delete_authorized ON public.fornecedores;

CREATE POLICY fornecedores_select_authenticated
  ON public.fornecedores FOR SELECT TO authenticated
  USING (true);

CREATE POLICY fornecedores_insert_authorized
  ON public.fornecedores FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('criar_fornecedores'));

CREATE POLICY fornecedores_update_authorized
  ON public.fornecedores FOR UPDATE TO authenticated
  USING (private.current_has_action('editar_fornecedores'))
  WITH CHECK (private.current_has_action('editar_fornecedores'));

CREATE POLICY fornecedores_delete_authorized
  ON public.fornecedores FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_fornecedores'));

-- ============================================================================
-- obras
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated full access" ON public.obras;
DROP POLICY IF EXISTS obras_select_authenticated ON public.obras;
DROP POLICY IF EXISTS obras_insert_authorized ON public.obras;
DROP POLICY IF EXISTS obras_update_authorized ON public.obras;
DROP POLICY IF EXISTS obras_delete_authorized ON public.obras;

CREATE POLICY obras_select_authenticated
  ON public.obras FOR SELECT TO authenticated
  USING (true);

CREATE POLICY obras_insert_authorized
  ON public.obras FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('criar_obras'));

CREATE POLICY obras_update_authorized
  ON public.obras FOR UPDATE TO authenticated
  USING (private.current_has_action('editar_obras'))
  WITH CHECK (private.current_has_action('editar_obras'));

CREATE POLICY obras_delete_authorized
  ON public.obras FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_obras'));
