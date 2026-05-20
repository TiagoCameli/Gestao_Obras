-- Audit Bloco 1.2 — RLS plano substituido por policies granulares
-- Tabelas: perfis_permissao, audit_log, funcionarios, colaboradores, financeiro_lancamentos
--
-- Antes: todas tinham "FOR ALL TO authenticated USING (true) WITH CHECK (true)"
--        (financeiro_lancamentos era TO public — pior, aceitava anon)
-- Depois: SELECT/INSERT/UPDATE/DELETE separados, gated por private.current_has_action()
--
-- Idempotente: pode ser re-rodado sem erro.

-- ============================================================================
-- 1. Schema privado + helpers SECURITY DEFINER
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.current_funcionario_id()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT id FROM public.funcionarios WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.current_has_action(p_action text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1 FROM public.funcionarios
      WHERE auth_user_id = auth.uid()
        AND (cargo = 'Administrador' OR p_action = ANY(acoes_permitidas))
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION private.current_funcionario_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.current_has_action(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_funcionario_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_has_action(text) TO authenticated;

-- ============================================================================
-- 2. perfis_permissao
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated full access" ON public.perfis_permissao;
DROP POLICY IF EXISTS "perfis_permissao_select_own_or_admin" ON public.perfis_permissao;
DROP POLICY IF EXISTS "perfis_permissao_insert_admin" ON public.perfis_permissao;
DROP POLICY IF EXISTS "perfis_permissao_update_admin" ON public.perfis_permissao;
DROP POLICY IF EXISTS "perfis_permissao_delete_admin" ON public.perfis_permissao;

CREATE POLICY "perfis_permissao_select_own_or_admin"
  ON public.perfis_permissao FOR SELECT TO authenticated
  USING (
    funcionario_id = private.current_funcionario_id()
    OR private.current_has_action('ver_funcionarios')
  );

CREATE POLICY "perfis_permissao_insert_admin"
  ON public.perfis_permissao FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('gerenciar_permissoes'));

CREATE POLICY "perfis_permissao_update_admin"
  ON public.perfis_permissao FOR UPDATE TO authenticated
  USING (private.current_has_action('gerenciar_permissoes'))
  WITH CHECK (private.current_has_action('gerenciar_permissoes'));

CREATE POLICY "perfis_permissao_delete_admin"
  ON public.perfis_permissao FOR DELETE TO authenticated
  USING (private.current_has_action('gerenciar_permissoes'));

-- ============================================================================
-- 3. audit_log (append-only: sem UPDATE/DELETE)
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated full access" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_select_admin" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_insert_authenticated" ON public.audit_log;

CREATE POLICY "audit_log_select_admin"
  ON public.audit_log FOR SELECT TO authenticated
  USING (private.current_has_action('ver_auditoria'));

CREATE POLICY "audit_log_insert_authenticated"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (true);

-- Intencionalmente sem UPDATE/DELETE — tabela imutavel.

-- ============================================================================
-- 4. funcionarios
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated full access" ON public.funcionarios;
DROP POLICY IF EXISTS "funcionarios_select_own_or_admin" ON public.funcionarios;
DROP POLICY IF EXISTS "funcionarios_insert_admin" ON public.funcionarios;
DROP POLICY IF EXISTS "funcionarios_update_admin" ON public.funcionarios;
DROP POLICY IF EXISTS "funcionarios_delete_admin" ON public.funcionarios;

CREATE POLICY "funcionarios_select_own_or_admin"
  ON public.funcionarios FOR SELECT TO authenticated
  USING (
    auth_user_id = (SELECT auth.uid())
    OR private.current_has_action('ver_funcionarios')
  );

CREATE POLICY "funcionarios_insert_admin"
  ON public.funcionarios FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('criar_funcionarios'));

CREATE POLICY "funcionarios_update_admin"
  ON public.funcionarios FOR UPDATE TO authenticated
  USING (private.current_has_action('editar_funcionarios'))
  WITH CHECK (private.current_has_action('editar_funcionarios'));

CREATE POLICY "funcionarios_delete_admin"
  ON public.funcionarios FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_funcionarios'));

-- ============================================================================
-- 5. colaboradores (SELECT aberto: operadores precisam ler em apontamento)
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated full access" ON public.colaboradores;
DROP POLICY IF EXISTS "colaboradores_select_authenticated" ON public.colaboradores;
DROP POLICY IF EXISTS "colaboradores_insert_authorized" ON public.colaboradores;
DROP POLICY IF EXISTS "colaboradores_update_authorized" ON public.colaboradores;
DROP POLICY IF EXISTS "colaboradores_delete_authorized" ON public.colaboradores;

CREATE POLICY "colaboradores_select_authenticated"
  ON public.colaboradores FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "colaboradores_insert_authorized"
  ON public.colaboradores FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('criar_colaboradores'));

CREATE POLICY "colaboradores_update_authorized"
  ON public.colaboradores FOR UPDATE TO authenticated
  USING (private.current_has_action('editar_colaboradores'))
  WITH CHECK (private.current_has_action('editar_colaboradores'));

CREATE POLICY "colaboradores_delete_authorized"
  ON public.colaboradores FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_colaboradores'));

-- ============================================================================
-- 6. financeiro_lancamentos (era TO public — pior que authenticated)
-- ============================================================================

DROP POLICY IF EXISTS "financeiro_lancamentos_all" ON public.financeiro_lancamentos;
DROP POLICY IF EXISTS "financeiro_lancamentos_select_authorized" ON public.financeiro_lancamentos;
DROP POLICY IF EXISTS "financeiro_lancamentos_insert_authorized" ON public.financeiro_lancamentos;
DROP POLICY IF EXISTS "financeiro_lancamentos_update_authorized" ON public.financeiro_lancamentos;
DROP POLICY IF EXISTS "financeiro_lancamentos_delete_authorized" ON public.financeiro_lancamentos;

CREATE POLICY "financeiro_lancamentos_select_authorized"
  ON public.financeiro_lancamentos FOR SELECT TO authenticated
  USING (private.current_has_action('ver_financeiro'));

CREATE POLICY "financeiro_lancamentos_insert_authorized"
  ON public.financeiro_lancamentos FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('criar_lancamento_financeiro'));

CREATE POLICY "financeiro_lancamentos_update_authorized"
  ON public.financeiro_lancamentos FOR UPDATE TO authenticated
  USING (private.current_has_action('editar_lancamento_financeiro'))
  WITH CHECK (private.current_has_action('editar_lancamento_financeiro'));

CREATE POLICY "financeiro_lancamentos_delete_authorized"
  ON public.financeiro_lancamentos FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_lancamento_financeiro'));
