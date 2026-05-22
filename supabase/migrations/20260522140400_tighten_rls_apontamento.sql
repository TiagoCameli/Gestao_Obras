-- Audit Fase 5 #3a: endurecer RLS das tabelas de Apontamento RH
--
-- Antes desta migration, qualquer authenticated lia PII + salário, editava
-- adiantamentos, alterava fechamento de folha, deletava trilha de auditoria,
-- ou setava as próprias permissões via apont_permissoes_usuario.
--
-- Padrão B (private.current_has_action) com chaves do grupo "Apontamento RH"
-- de ACOES_PLATAFORMA.

-- ============================================================================
-- apont_funcionarios (PII + salário base)
-- ============================================================================
DROP POLICY IF EXISTS "apont_funcionarios_authed" ON public.apont_funcionarios;

CREATE POLICY "apont_funcionarios_select" ON public.apont_funcionarios
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_apontamento_rh'));

CREATE POLICY "apont_funcionarios_insert" ON public.apont_funcionarios
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('criar_func_rh'));

CREATE POLICY "apont_funcionarios_update" ON public.apont_funcionarios
  FOR UPDATE TO authenticated
  USING (private.current_has_action('editar_func_rh'))
  WITH CHECK (private.current_has_action('editar_func_rh'));

CREATE POLICY "apont_funcionarios_delete" ON public.apont_funcionarios
  FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_func_rh'));

-- ============================================================================
-- apont_adiantamentos
-- ============================================================================
DROP POLICY IF EXISTS "apont_adiantamentos_authed" ON public.apont_adiantamentos;

CREATE POLICY "apont_adiantamentos_select" ON public.apont_adiantamentos
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_apontamento_rh'));

CREATE POLICY "apont_adiantamentos_insert" ON public.apont_adiantamentos
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('lancar_adiantamento'));

CREATE POLICY "apont_adiantamentos_update" ON public.apont_adiantamentos
  FOR UPDATE TO authenticated
  USING (private.current_has_action('lancar_adiantamento'))
  WITH CHECK (private.current_has_action('lancar_adiantamento'));

CREATE POLICY "apont_adiantamentos_delete" ON public.apont_adiantamentos
  FOR DELETE TO authenticated
  USING (private.current_has_action('lancar_adiantamento') AND private.current_has_action('editar_apontamentos'));

-- ============================================================================
-- apont_fechamentos_folha
-- ============================================================================
DROP POLICY IF EXISTS "apont_fechamentos_folha_authed" ON public.apont_fechamentos_folha;

CREATE POLICY "apont_fechamentos_folha_select" ON public.apont_fechamentos_folha
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_apontamento_rh'));

CREATE POLICY "apont_fechamentos_folha_insert" ON public.apont_fechamentos_folha
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('fechar_folha'));

CREATE POLICY "apont_fechamentos_folha_update" ON public.apont_fechamentos_folha
  FOR UPDATE TO authenticated
  USING (private.current_has_action('reabrir_periodo'))
  WITH CHECK (private.current_has_action('reabrir_periodo'));

CREATE POLICY "apont_fechamentos_folha_delete" ON public.apont_fechamentos_folha
  FOR DELETE TO authenticated
  USING (private.current_has_action('reabrir_periodo'));

-- ============================================================================
-- apont_permissoes_usuario (controle de permissões!)
-- ============================================================================
DROP POLICY IF EXISTS "apont_permissoes_usuario_authed" ON public.apont_permissoes_usuario;

CREATE POLICY "apont_permissoes_usuario_select" ON public.apont_permissoes_usuario
  FOR SELECT TO authenticated
  USING (private.current_has_action('gerenciar_permissoes') OR private.current_has_action('ver_funcionarios'));

CREATE POLICY "apont_permissoes_usuario_insert" ON public.apont_permissoes_usuario
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('gerenciar_permissoes'));

CREATE POLICY "apont_permissoes_usuario_update" ON public.apont_permissoes_usuario
  FOR UPDATE TO authenticated
  USING (private.current_has_action('gerenciar_permissoes'))
  WITH CHECK (private.current_has_action('gerenciar_permissoes'));

CREATE POLICY "apont_permissoes_usuario_delete" ON public.apont_permissoes_usuario
  FOR DELETE TO authenticated
  USING (private.current_has_action('gerenciar_permissoes'));

-- ============================================================================
-- apont_auditoria (append-only — sem UPDATE/DELETE)
-- ============================================================================
DROP POLICY IF EXISTS "apont_auditoria_authed" ON public.apont_auditoria;

CREATE POLICY "apont_auditoria_select" ON public.apont_auditoria
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_auditoria') OR private.current_has_action('ver_apontamento_rh'));

CREATE POLICY "apont_auditoria_insert" ON public.apont_auditoria
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('ver_apontamento_rh'));

-- Sem UPDATE/DELETE: tabela imutável.

-- ============================================================================
-- registros_horas_diaristas
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated full access" ON public.registros_horas_diaristas;

CREATE POLICY "registros_horas_diaristas_select" ON public.registros_horas_diaristas
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_apontamento_rh'));

CREATE POLICY "registros_horas_diaristas_insert" ON public.registros_horas_diaristas
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('lancar_apontamento_servico') OR private.current_has_action('editar_apontamentos'));

CREATE POLICY "registros_horas_diaristas_update" ON public.registros_horas_diaristas
  FOR UPDATE TO authenticated
  USING (private.current_has_action('editar_apontamento_servico') OR private.current_has_action('editar_apontamentos'))
  WITH CHECK (private.current_has_action('editar_apontamento_servico') OR private.current_has_action('editar_apontamentos'));

CREATE POLICY "registros_horas_diaristas_delete" ON public.registros_horas_diaristas
  FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_apontamentos'));

-- ============================================================================
-- apont_apontamentos_servico (sensível — produção)
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated full access" ON public.apont_apontamentos_servico;

CREATE POLICY "apont_apontamentos_servico_select" ON public.apont_apontamentos_servico
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_apontamento_rh'));

CREATE POLICY "apont_apontamentos_servico_insert" ON public.apont_apontamentos_servico
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('lancar_apontamento_servico'));

CREATE POLICY "apont_apontamentos_servico_update" ON public.apont_apontamentos_servico
  FOR UPDATE TO authenticated
  USING (private.current_has_action('editar_apontamento_servico') OR private.current_has_action('editar_apontamentos'))
  WITH CHECK (private.current_has_action('editar_apontamento_servico') OR private.current_has_action('editar_apontamentos'));

CREATE POLICY "apont_apontamentos_servico_delete" ON public.apont_apontamentos_servico
  FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_apontamentos'));
