-- Audit Fase 5 #3b: endurecer RLS de tabelas operacionais sensíveis
--
-- Nota: pagamentos_frete, fornecedores e obras já foram endurecidas em
-- 20260522100100_tighten_rls_pagamentos_pedidos.sql e
-- 20260522100400_tighten_rls_fornecedores_obras.sql — não duplicar aqui.
--
-- Esta migration cobre: empresas, ordens_servico, equipamentos,
-- tipos_equipamento (era pseudo-granular blanket), cotacoes,
-- cotacao_links_publicos, cotacao_respostas_fornecedor.

-- ============================================================================
-- empresas (SELECT amplo — usada em filtros multi-empresa)
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated full access" ON public.empresas;

CREATE POLICY "empresas_select" ON public.empresas
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "empresas_insert" ON public.empresas
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('criar_empresas'));

CREATE POLICY "empresas_update" ON public.empresas
  FOR UPDATE TO authenticated
  USING (private.current_has_action('editar_empresas'))
  WITH CHECK (private.current_has_action('editar_empresas'));

CREATE POLICY "empresas_delete" ON public.empresas
  FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_empresas'));

-- ============================================================================
-- ordens_servico (custo MO + peças)
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated full access" ON public.ordens_servico;

CREATE POLICY "ordens_servico_select" ON public.ordens_servico
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_manutencao'));

CREATE POLICY "ordens_servico_insert" ON public.ordens_servico
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('criar_os'));

CREATE POLICY "ordens_servico_update" ON public.ordens_servico
  FOR UPDATE TO authenticated
  USING (
    private.current_has_action('editar_os')
    OR private.current_has_action('aprovar_os')
    OR private.current_has_action('cancelar_os')
    OR private.current_has_action('mudar_status_os')
  )
  WITH CHECK (
    private.current_has_action('editar_os')
    OR private.current_has_action('aprovar_os')
    OR private.current_has_action('cancelar_os')
    OR private.current_has_action('mudar_status_os')
  );

CREATE POLICY "ordens_servico_delete" ON public.ordens_servico
  FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_os'));

-- ============================================================================
-- equipamentos (SELECT amplo — lido em quase toda tela)
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated full access" ON public.equipamentos;

CREATE POLICY "equipamentos_select" ON public.equipamentos
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "equipamentos_insert" ON public.equipamentos
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('criar_equipamentos'));

CREATE POLICY "equipamentos_update" ON public.equipamentos
  FOR UPDATE TO authenticated
  USING (private.current_has_action('editar_equipamentos'))
  WITH CHECK (private.current_has_action('editar_equipamentos'));

CREATE POLICY "equipamentos_delete" ON public.equipamentos
  FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_equipamentos'));

-- ============================================================================
-- tipos_equipamento (pseudo-granular: as 4 policies anteriores eram USING true)
-- ============================================================================
DROP POLICY IF EXISTS "tipos_equipamento_select" ON public.tipos_equipamento;
DROP POLICY IF EXISTS "tipos_equipamento_insert" ON public.tipos_equipamento;
DROP POLICY IF EXISTS "tipos_equipamento_update" ON public.tipos_equipamento;
DROP POLICY IF EXISTS "tipos_equipamento_delete" ON public.tipos_equipamento;

CREATE POLICY "tipos_equipamento_select" ON public.tipos_equipamento
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "tipos_equipamento_insert" ON public.tipos_equipamento
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('gerenciar_tipos_equipamento_obra'));

CREATE POLICY "tipos_equipamento_update" ON public.tipos_equipamento
  FOR UPDATE TO authenticated
  USING (private.current_has_action('gerenciar_tipos_equipamento_obra'))
  WITH CHECK (private.current_has_action('gerenciar_tipos_equipamento_obra'));

CREATE POLICY "tipos_equipamento_delete" ON public.tipos_equipamento
  FOR DELETE TO authenticated
  USING (private.current_has_action('gerenciar_tipos_equipamento_obra'));

-- ============================================================================
-- cotacoes
-- ============================================================================
DROP POLICY IF EXISTS "cotacoes_authenticated" ON public.cotacoes;

CREATE POLICY "cotacoes_select" ON public.cotacoes
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_compras'));

CREATE POLICY "cotacoes_insert" ON public.cotacoes
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('criar_cotacao'));

CREATE POLICY "cotacoes_update" ON public.cotacoes
  FOR UPDATE TO authenticated
  USING (private.current_has_action('editar_cotacao'))
  WITH CHECK (private.current_has_action('editar_cotacao'));

CREATE POLICY "cotacoes_delete" ON public.cotacoes
  FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_permanente_compras'));

-- ============================================================================
-- cotacao_links_publicos (gerado por SECDEF; INSERT restrito)
-- ============================================================================
DROP POLICY IF EXISTS "cotacao_links_publicos_authenticated" ON public.cotacao_links_publicos;

CREATE POLICY "cotacao_links_publicos_select" ON public.cotacao_links_publicos
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_compras'));

CREATE POLICY "cotacao_links_publicos_insert" ON public.cotacao_links_publicos
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('enviar_cotacao_fornecedor'));

CREATE POLICY "cotacao_links_publicos_update" ON public.cotacao_links_publicos
  FOR UPDATE TO authenticated
  USING (private.current_has_action('enviar_cotacao_fornecedor'))
  WITH CHECK (private.current_has_action('enviar_cotacao_fornecedor'));

CREATE POLICY "cotacao_links_publicos_delete" ON public.cotacao_links_publicos
  FOR DELETE TO authenticated
  USING (private.current_has_action('enviar_cotacao_fornecedor'));

-- ============================================================================
-- cotacao_respostas_fornecedor (escrita via SECDEF responder_cotacao)
-- ============================================================================
DROP POLICY IF EXISTS "cotacao_respostas_authenticated" ON public.cotacao_respostas_fornecedor;

CREATE POLICY "cotacao_respostas_select" ON public.cotacao_respostas_fornecedor
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_compras'));

-- INSERT/UPDATE/DELETE só via responder_cotacao (SECURITY DEFINER) ou admin
-- com gerenciar_permissoes. Cliente authenticated não escreve direto.
CREATE POLICY "cotacao_respostas_insert" ON public.cotacao_respostas_fornecedor
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('gerenciar_permissoes'));

CREATE POLICY "cotacao_respostas_update" ON public.cotacao_respostas_fornecedor
  FOR UPDATE TO authenticated
  USING (private.current_has_action('gerenciar_permissoes'))
  WITH CHECK (private.current_has_action('gerenciar_permissoes'));

CREATE POLICY "cotacao_respostas_delete" ON public.cotacao_respostas_fornecedor
  FOR DELETE TO authenticated
  USING (private.current_has_action('gerenciar_permissoes'));
