-- Audit Fase 5 #1: 13 tabelas com policy `TO public` (anon-key acessa sem login)
--
-- Antes desta migration, qualquer pessoa com a anon-key publicada no frontend
-- Vite conseguia ler/inserir/atualizar/deletar financeiro_pagamentos,
-- ordens_compra, pedidos_compra, compras_auditoria etc. sem login.
--
-- Padrão idêntico ao 20260520120000_tighten_rls_critical_tables: SELECT/
-- INSERT/UPDATE/DELETE separados por verbo, gated por
-- private.current_has_action(<acao>).

-- ============================================================================
-- compras_anexos
-- ============================================================================
DROP POLICY IF EXISTS "compras_anexos_all" ON public.compras_anexos;

CREATE POLICY "compras_anexos_select" ON public.compras_anexos
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_compras'));

CREATE POLICY "compras_anexos_insert" ON public.compras_anexos
  FOR INSERT TO authenticated
  WITH CHECK (
    private.current_has_action('anexar_pdf_cotacao')
    OR private.current_has_action('criar_ordem_compra')
    OR private.current_has_action('criar_pedido_compra')
  );

CREATE POLICY "compras_anexos_update" ON public.compras_anexos
  FOR UPDATE TO authenticated
  USING (private.current_has_action('editar_cotacao') OR private.current_has_action('editar_ordem_compra'))
  WITH CHECK (private.current_has_action('editar_cotacao') OR private.current_has_action('editar_ordem_compra'));

CREATE POLICY "compras_anexos_delete" ON public.compras_anexos
  FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_permanente_compras'));

-- ============================================================================
-- compras_auditoria (append-only — sem UPDATE/DELETE)
-- ============================================================================
DROP POLICY IF EXISTS "compras_auditoria_all" ON public.compras_auditoria;

CREATE POLICY "compras_auditoria_select" ON public.compras_auditoria
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_auditoria_compras'));

CREATE POLICY "compras_auditoria_insert" ON public.compras_auditoria
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('ver_compras'));

-- Sem UPDATE/DELETE: tabela imutável.

-- ============================================================================
-- compras_lixeira
-- ============================================================================
DROP POLICY IF EXISTS "compras_lixeira_all" ON public.compras_lixeira;

CREATE POLICY "compras_lixeira_select" ON public.compras_lixeira
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_compras'));

CREATE POLICY "compras_lixeira_insert" ON public.compras_lixeira
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('ver_compras'));

CREATE POLICY "compras_lixeira_update" ON public.compras_lixeira
  FOR UPDATE TO authenticated
  USING (private.current_has_action('restaurar_lixeira_compras'))
  WITH CHECK (private.current_has_action('restaurar_lixeira_compras'));

CREATE POLICY "compras_lixeira_delete" ON public.compras_lixeira
  FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_permanente_compras'));

-- ============================================================================
-- compras_notificacoes
-- ============================================================================
DROP POLICY IF EXISTS "compras_notificacoes_all" ON public.compras_notificacoes;

CREATE POLICY "compras_notificacoes_select" ON public.compras_notificacoes
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_compras'));

CREATE POLICY "compras_notificacoes_insert" ON public.compras_notificacoes
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('ver_compras'));

CREATE POLICY "compras_notificacoes_update" ON public.compras_notificacoes
  FOR UPDATE TO authenticated
  USING (private.current_has_action('ver_compras'))
  WITH CHECK (private.current_has_action('ver_compras'));

CREATE POLICY "compras_notificacoes_delete" ON public.compras_notificacoes
  FOR DELETE TO authenticated
  USING (private.current_has_action('ver_compras'));

-- ============================================================================
-- depositos_lixeira
-- ============================================================================
DROP POLICY IF EXISTS "depositos_lixeira_all" ON public.depositos_lixeira;

CREATE POLICY "depositos_lixeira_select" ON public.depositos_lixeira
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_depositos'));

CREATE POLICY "depositos_lixeira_insert" ON public.depositos_lixeira
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('ver_depositos'));

CREATE POLICY "depositos_lixeira_update" ON public.depositos_lixeira
  FOR UPDATE TO authenticated
  USING (private.current_has_action('restaurar_lixeira_depositos'))
  WITH CHECK (private.current_has_action('restaurar_lixeira_depositos'));

CREATE POLICY "depositos_lixeira_delete" ON public.depositos_lixeira
  FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_permanente_depositos'));

-- ============================================================================
-- depositos_obras (vínculo M:N entre depositos e obras)
-- ============================================================================
DROP POLICY IF EXISTS "depositos_obras_all" ON public.depositos_obras;

CREATE POLICY "depositos_obras_select" ON public.depositos_obras
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_depositos'));

CREATE POLICY "depositos_obras_insert" ON public.depositos_obras
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('editar_combustivel') OR private.current_has_action('ver_depositos'));

CREATE POLICY "depositos_obras_update" ON public.depositos_obras
  FOR UPDATE TO authenticated
  USING (private.current_has_action('editar_combustivel') OR private.current_has_action('ver_depositos'))
  WITH CHECK (private.current_has_action('editar_combustivel') OR private.current_has_action('ver_depositos'));

CREATE POLICY "depositos_obras_delete" ON public.depositos_obras
  FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_combustivel') OR private.current_has_action('ver_depositos'));

-- ============================================================================
-- financeiro_categorias
-- ============================================================================
DROP POLICY IF EXISTS "financeiro_categorias_all" ON public.financeiro_categorias;

CREATE POLICY "financeiro_categorias_select" ON public.financeiro_categorias
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_financeiro'));

CREATE POLICY "financeiro_categorias_insert" ON public.financeiro_categorias
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('gerenciar_categorias_financeiro'));

CREATE POLICY "financeiro_categorias_update" ON public.financeiro_categorias
  FOR UPDATE TO authenticated
  USING (private.current_has_action('gerenciar_categorias_financeiro'))
  WITH CHECK (private.current_has_action('gerenciar_categorias_financeiro'));

CREATE POLICY "financeiro_categorias_delete" ON public.financeiro_categorias
  FOR DELETE TO authenticated
  USING (private.current_has_action('gerenciar_categorias_financeiro'));

-- Drop policy obsoleta com auth.jwt() ->> 'role' = 'admin' (audit Fase 9.3).
DROP POLICY IF EXISTS "Admins can manage categorias_material" ON public.categorias_material;

-- ============================================================================
-- financeiro_pagamentos
-- ============================================================================
DROP POLICY IF EXISTS "financeiro_pagamentos_all" ON public.financeiro_pagamentos;

CREATE POLICY "financeiro_pagamentos_select" ON public.financeiro_pagamentos
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_financeiro'));

CREATE POLICY "financeiro_pagamentos_insert" ON public.financeiro_pagamentos
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('registrar_pagamento_financeiro'));

CREATE POLICY "financeiro_pagamentos_update" ON public.financeiro_pagamentos
  FOR UPDATE TO authenticated
  USING (private.current_has_action('registrar_pagamento_financeiro'))
  WITH CHECK (private.current_has_action('registrar_pagamento_financeiro'));

CREATE POLICY "financeiro_pagamentos_delete" ON public.financeiro_pagamentos
  FOR DELETE TO authenticated
  USING (private.current_has_action('estornar_pagamento_financeiro'));

-- ============================================================================
-- financeiro_parcelas
-- ============================================================================
DROP POLICY IF EXISTS "financeiro_parcelas_all" ON public.financeiro_parcelas;

CREATE POLICY "financeiro_parcelas_select" ON public.financeiro_parcelas
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_financeiro'));

CREATE POLICY "financeiro_parcelas_insert" ON public.financeiro_parcelas
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('criar_lancamento_financeiro'));

CREATE POLICY "financeiro_parcelas_update" ON public.financeiro_parcelas
  FOR UPDATE TO authenticated
  USING (private.current_has_action('editar_lancamento_financeiro'))
  WITH CHECK (private.current_has_action('editar_lancamento_financeiro'));

CREATE POLICY "financeiro_parcelas_delete" ON public.financeiro_parcelas
  FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_lancamento_financeiro'));

-- ============================================================================
-- financeiro_rateios
-- ============================================================================
DROP POLICY IF EXISTS "financeiro_rateios_all" ON public.financeiro_rateios;

CREATE POLICY "financeiro_rateios_select" ON public.financeiro_rateios
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_financeiro'));

CREATE POLICY "financeiro_rateios_insert" ON public.financeiro_rateios
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('criar_lancamento_financeiro'));

CREATE POLICY "financeiro_rateios_update" ON public.financeiro_rateios
  FOR UPDATE TO authenticated
  USING (private.current_has_action('editar_lancamento_financeiro'))
  WITH CHECK (private.current_has_action('editar_lancamento_financeiro'));

CREATE POLICY "financeiro_rateios_delete" ON public.financeiro_rateios
  FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_lancamento_financeiro'));

-- ============================================================================
-- ordens_compra
-- ============================================================================
DROP POLICY IF EXISTS "ordens_compra_all" ON public.ordens_compra;

CREATE POLICY "ordens_compra_select" ON public.ordens_compra
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_compras'));

CREATE POLICY "ordens_compra_insert" ON public.ordens_compra
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('criar_ordem_compra'));

CREATE POLICY "ordens_compra_update" ON public.ordens_compra
  FOR UPDATE TO authenticated
  USING (
    private.current_has_action('editar_ordem_compra')
    OR private.current_has_action('aprovar_ordem_compra')
    OR private.current_has_action('cancelar_ordem_compra')
    OR private.current_has_action('marcar_oc_recebida')
  )
  WITH CHECK (
    private.current_has_action('editar_ordem_compra')
    OR private.current_has_action('aprovar_ordem_compra')
    OR private.current_has_action('cancelar_ordem_compra')
    OR private.current_has_action('marcar_oc_recebida')
  );

CREATE POLICY "ordens_compra_delete" ON public.ordens_compra
  FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_permanente_compras'));

-- ============================================================================
-- pedidos_compra
-- ============================================================================
DROP POLICY IF EXISTS "pedidos_compra_all" ON public.pedidos_compra;

CREATE POLICY "pedidos_compra_select" ON public.pedidos_compra
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_compras'));

CREATE POLICY "pedidos_compra_insert" ON public.pedidos_compra
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('criar_pedido_compra') OR private.current_has_action('criar_pedido_material'));

CREATE POLICY "pedidos_compra_update" ON public.pedidos_compra
  FOR UPDATE TO authenticated
  USING (private.current_has_action('editar_pedido_compra') OR private.current_has_action('aprovar_pedido'))
  WITH CHECK (private.current_has_action('editar_pedido_compra') OR private.current_has_action('aprovar_pedido'));

CREATE POLICY "pedidos_compra_delete" ON public.pedidos_compra
  FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_permanente_compras'));

-- ============================================================================
-- recebimentos_oc
-- ============================================================================
DROP POLICY IF EXISTS "recebimentos_oc_all" ON public.recebimentos_oc;

CREATE POLICY "recebimentos_oc_select" ON public.recebimentos_oc
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_compras'));

CREATE POLICY "recebimentos_oc_insert" ON public.recebimentos_oc
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('marcar_oc_recebida') OR private.current_has_action('gerar_entrada_estoque_oc'));

CREATE POLICY "recebimentos_oc_update" ON public.recebimentos_oc
  FOR UPDATE TO authenticated
  USING (private.current_has_action('marcar_oc_recebida') OR private.current_has_action('gerar_entrada_estoque_oc'))
  WITH CHECK (private.current_has_action('marcar_oc_recebida') OR private.current_has_action('gerar_entrada_estoque_oc'));

CREATE POLICY "recebimentos_oc_delete" ON public.recebimentos_oc
  FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_permanente_compras'));
