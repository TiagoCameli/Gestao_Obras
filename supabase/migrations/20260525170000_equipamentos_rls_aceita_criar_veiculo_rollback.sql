-- Rollback do fix de RLS dos equipamentos (volta ao estado da migration
-- 20260522140500_tighten_rls_financeiro_operacional.sql — só *_equipamentos).

DROP POLICY IF EXISTS "equipamentos_insert" ON public.equipamentos;
CREATE POLICY "equipamentos_insert" ON public.equipamentos
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('criar_equipamentos'));

DROP POLICY IF EXISTS "equipamentos_update" ON public.equipamentos;
CREATE POLICY "equipamentos_update" ON public.equipamentos
  FOR UPDATE TO authenticated
  USING (private.current_has_action('editar_equipamentos'))
  WITH CHECK (private.current_has_action('editar_equipamentos'));

DROP POLICY IF EXISTS "equipamentos_delete" ON public.equipamentos;
CREATE POLICY "equipamentos_delete" ON public.equipamentos
  FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_equipamentos'));
