-- Tighten RLS nas tabelas RH que ainda estavam em USING(true) / WITH CHECK(true).
--
-- ANTES: 7 tabelas com policy blanket `FOR ALL TO authenticated USING(true)` +
--        1 tabela (apont_apontamentos_servico) com a blanket residual coexistindo
--        com 4 granulares (a blanket sobrescreve via OR; granulares inertes).
--
-- DEPOIS: cada tabela com policies por comando (SELECT/INSERT/UPDATE/DELETE),
--         gated por `private.current_has_action(<acao>)`. O `current_has_action`
--         é SECDEF e tem bypass interno pra `cargo='Administrador'` + match em
--         `acoes_permitidas`.
--
-- Fix #8 do apontamento-rh-audit.md. Cobre também o bug do DROP errado em
-- `tighten_rls_apontamento` (20260522231524), que tentou droppar
-- `"Authenticated full access"` quando a policy real chamava
-- `apont_apontamentos_servico_authed`.
--
-- Rollback: 20260525130100_rollback_tighten_rls_apont_tables.sql.

-- ============================================================================
-- 1) apont_registros_ponto (502 rows)
-- ============================================================================
DROP POLICY IF EXISTS apont_registros_ponto_authed ON public.apont_registros_ponto;

CREATE POLICY apont_registros_ponto_select
  ON public.apont_registros_ponto FOR SELECT TO authenticated
  USING (private.current_has_action('ver_apontamento_rh'));

CREATE POLICY apont_registros_ponto_insert
  ON public.apont_registros_ponto FOR INSERT TO authenticated
  WITH CHECK (
    private.current_has_action('registrar_ponto')
    OR private.current_has_action('registrar_ponto_lote')
    OR private.current_has_action('lancar_ponto_manual')
    OR private.current_has_action('aprovar_apontamento_rh')
  );

CREATE POLICY apont_registros_ponto_update
  ON public.apont_registros_ponto FOR UPDATE TO authenticated
  USING (
    private.current_has_action('editar_batida_ponto')
    OR private.current_has_action('aprovar_lancamento_manual')
    OR private.current_has_action('aprovar_apontamento_rh')
  )
  WITH CHECK (
    private.current_has_action('editar_batida_ponto')
    OR private.current_has_action('aprovar_lancamento_manual')
    OR private.current_has_action('aprovar_apontamento_rh')
  );

CREATE POLICY apont_registros_ponto_delete
  ON public.apont_registros_ponto FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_batida_ponto'));

-- ============================================================================
-- 2) apont_ausencias (0 rows)
-- ============================================================================
DROP POLICY IF EXISTS apont_ausencias_authed ON public.apont_ausencias;

CREATE POLICY apont_ausencias_select
  ON public.apont_ausencias FOR SELECT TO authenticated
  USING (private.current_has_action('ver_apontamento_rh'));

CREATE POLICY apont_ausencias_insert
  ON public.apont_ausencias FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('lancar_ausencia'));

CREATE POLICY apont_ausencias_update
  ON public.apont_ausencias FOR UPDATE TO authenticated
  USING (private.current_has_action('lancar_ausencia'))
  WITH CHECK (private.current_has_action('lancar_ausencia'));

CREATE POLICY apont_ausencias_delete
  ON public.apont_ausencias FOR DELETE TO authenticated
  USING (private.current_has_action('lancar_ausencia'));

-- ============================================================================
-- 3) apont_equipes (14 rows)
-- ============================================================================
DROP POLICY IF EXISTS apont_equipes_authed ON public.apont_equipes;

CREATE POLICY apont_equipes_select
  ON public.apont_equipes FOR SELECT TO authenticated
  USING (private.current_has_action('ver_apontamento_rh'));

CREATE POLICY apont_equipes_insert
  ON public.apont_equipes FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('gerenciar_equipes'));

CREATE POLICY apont_equipes_update
  ON public.apont_equipes FOR UPDATE TO authenticated
  USING (private.current_has_action('gerenciar_equipes'))
  WITH CHECK (private.current_has_action('gerenciar_equipes'));

CREATE POLICY apont_equipes_delete
  ON public.apont_equipes FOR DELETE TO authenticated
  USING (private.current_has_action('gerenciar_equipes'));

-- ============================================================================
-- 4) apont_equipe_obras (9 rows)
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated full access" ON public.apont_equipe_obras;
DROP POLICY IF EXISTS apont_equipe_obras_authed ON public.apont_equipe_obras;

CREATE POLICY apont_equipe_obras_select
  ON public.apont_equipe_obras FOR SELECT TO authenticated
  USING (private.current_has_action('ver_apontamento_rh'));

CREATE POLICY apont_equipe_obras_insert
  ON public.apont_equipe_obras FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('gerenciar_equipes'));

CREATE POLICY apont_equipe_obras_update
  ON public.apont_equipe_obras FOR UPDATE TO authenticated
  USING (private.current_has_action('gerenciar_equipes'))
  WITH CHECK (private.current_has_action('gerenciar_equipes'));

CREATE POLICY apont_equipe_obras_delete
  ON public.apont_equipe_obras FOR DELETE TO authenticated
  USING (private.current_has_action('gerenciar_equipes'));

-- ============================================================================
-- 5) apont_aprovacao_funcionario_dia (154 rows)
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated full access" ON public.apont_aprovacao_funcionario_dia;

CREATE POLICY apont_aprov_func_dia_select
  ON public.apont_aprovacao_funcionario_dia FOR SELECT TO authenticated
  USING (
    private.current_has_action('ver_apontamento_rh')
    OR private.current_has_action('ver_aprovacoes_rh')
  );

CREATE POLICY apont_aprov_func_dia_insert
  ON public.apont_aprovacao_funcionario_dia FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('aprovar_apontamento_rh'));

CREATE POLICY apont_aprov_func_dia_update
  ON public.apont_aprovacao_funcionario_dia FOR UPDATE TO authenticated
  USING (private.current_has_action('aprovar_apontamento_rh'))
  WITH CHECK (private.current_has_action('aprovar_apontamento_rh'));

CREATE POLICY apont_aprov_func_dia_delete
  ON public.apont_aprovacao_funcionario_dia FOR DELETE TO authenticated
  USING (
    private.current_has_action('reverter_aprovacao_rh')
    OR private.current_has_action('aprovar_apontamento_rh')
  );

-- ============================================================================
-- 6) apont_aprovacoes_ponto_dia (0 rows, mas pontoApi.ts ainda referencia)
-- ============================================================================
DROP POLICY IF EXISTS apont_aprovacoes_ponto_dia_authed ON public.apont_aprovacoes_ponto_dia;

CREATE POLICY apont_aprov_ponto_dia_select
  ON public.apont_aprovacoes_ponto_dia FOR SELECT TO authenticated
  USING (private.current_has_action('ver_apontamento_rh'));

CREATE POLICY apont_aprov_ponto_dia_insert
  ON public.apont_aprovacoes_ponto_dia FOR INSERT TO authenticated
  WITH CHECK (
    private.current_has_action('aprovar_ponto_diario')
    OR private.current_has_action('aprovar_apontamento_rh')
  );

CREATE POLICY apont_aprov_ponto_dia_update
  ON public.apont_aprovacoes_ponto_dia FOR UPDATE TO authenticated
  USING (
    private.current_has_action('aprovar_ponto_diario')
    OR private.current_has_action('aprovar_apontamento_rh')
  )
  WITH CHECK (
    private.current_has_action('aprovar_ponto_diario')
    OR private.current_has_action('aprovar_apontamento_rh')
  );

CREATE POLICY apont_aprov_ponto_dia_delete
  ON public.apont_aprovacoes_ponto_dia FOR DELETE TO authenticated
  USING (
    private.current_has_action('reabrir_periodo')
    OR private.current_has_action('reverter_aprovacao_rh')
  );

-- ============================================================================
-- 7) apontamentos (legacy, 1925 rows; código TS só faz SELECT)
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated full access" ON public.apontamentos;

CREATE POLICY apontamentos_legacy_select
  ON public.apontamentos FOR SELECT TO authenticated
  USING (
    private.current_has_action('ver_apontamento_rh')
    OR private.current_has_action('ver_historico_apontamentos')
  );

CREATE POLICY apontamentos_legacy_insert
  ON public.apontamentos FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('editar_apontamentos'));

CREATE POLICY apontamentos_legacy_update
  ON public.apontamentos FOR UPDATE TO authenticated
  USING (private.current_has_action('editar_apontamentos'))
  WITH CHECK (private.current_has_action('editar_apontamentos'));

CREATE POLICY apontamentos_legacy_delete
  ON public.apontamentos FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_apontamentos'));

-- ============================================================================
-- 8) apont_apontamentos_servico — bug do DROP errado em tighten_rls_apontamento
-- ============================================================================
-- A migration 20260522231524_tighten_rls_apontamento.sql tentou:
--   DROP POLICY IF EXISTS "Authenticated full access"
--     ON public.apont_apontamentos_servico;
-- ... mas o nome real é `apont_apontamentos_servico_authed`. As 4 policies
-- granulares (select/insert/update/delete) foram criadas, mas a blanket
-- permaneceu e as anulou via OR. Corrigindo agora:
DROP POLICY IF EXISTS apont_apontamentos_servico_authed ON public.apont_apontamentos_servico;
