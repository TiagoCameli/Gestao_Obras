-- Audit Frete (Item #2 do frete-audit.md): tighten RLS em pagamentos_frete
-- e pedidos_material. Mesmo padrão de 20260520180000_tighten_rls_fretes.sql.
--
-- Antes: ambas com "Authenticated full access" (USING true) → qualquer
-- usuário authenticated podia DELETE direto via PostgREST, burlando
-- soft-delete e a UI.
--
-- Depois: 4 policies separadas, gated por private.current_has_action().
-- Cargo = 'Administrador' bypassa (lógica do private.current_has_action).
--
-- Mapeamento de ações (verificado em funcionarios.acoes_permitidas):
--   pagamentos_frete:
--     SELECT → ver_frete  (não existe ver_pagamento_frete; reuso ver_frete)
--     INSERT → criar_pagamento_frete
--     UPDATE → editar_pagamento_frete
--     DELETE → excluir_pagamento_frete
--   pedidos_material:
--     SELECT → ver_pedidos_material  (plural — formato existente)
--     INSERT → criar_pedido_material_frete
--     UPDATE → editar_pedido_material_frete
--     DELETE → excluir_pedido_material_frete
--
-- Idempotente.

-- ============================================================================
-- pagamentos_frete
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated full access" ON public.pagamentos_frete;
DROP POLICY IF EXISTS pagamentos_frete_select_authorized ON public.pagamentos_frete;
DROP POLICY IF EXISTS pagamentos_frete_insert_authorized ON public.pagamentos_frete;
DROP POLICY IF EXISTS pagamentos_frete_update_authorized ON public.pagamentos_frete;
DROP POLICY IF EXISTS pagamentos_frete_delete_authorized ON public.pagamentos_frete;

CREATE POLICY pagamentos_frete_select_authorized
  ON public.pagamentos_frete FOR SELECT TO authenticated
  USING (private.current_has_action('ver_frete'));

CREATE POLICY pagamentos_frete_insert_authorized
  ON public.pagamentos_frete FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('criar_pagamento_frete'));

CREATE POLICY pagamentos_frete_update_authorized
  ON public.pagamentos_frete FOR UPDATE TO authenticated
  USING (private.current_has_action('editar_pagamento_frete'))
  WITH CHECK (private.current_has_action('editar_pagamento_frete'));

CREATE POLICY pagamentos_frete_delete_authorized
  ON public.pagamentos_frete FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_pagamento_frete'));

-- ============================================================================
-- pedidos_material
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated full access" ON public.pedidos_material;
DROP POLICY IF EXISTS pedidos_material_select_authorized ON public.pedidos_material;
DROP POLICY IF EXISTS pedidos_material_insert_authorized ON public.pedidos_material;
DROP POLICY IF EXISTS pedidos_material_update_authorized ON public.pedidos_material;
DROP POLICY IF EXISTS pedidos_material_delete_authorized ON public.pedidos_material;

CREATE POLICY pedidos_material_select_authorized
  ON public.pedidos_material FOR SELECT TO authenticated
  USING (private.current_has_action('ver_pedidos_material'));

CREATE POLICY pedidos_material_insert_authorized
  ON public.pedidos_material FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('criar_pedido_material_frete'));

CREATE POLICY pedidos_material_update_authorized
  ON public.pedidos_material FOR UPDATE TO authenticated
  USING (private.current_has_action('editar_pedido_material_frete'))
  WITH CHECK (private.current_has_action('editar_pedido_material_frete'));

CREATE POLICY pedidos_material_delete_authorized
  ON public.pedidos_material FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_pedido_material_frete'));
