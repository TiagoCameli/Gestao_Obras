-- Fix: RLS de equipamentos aceitava só *_equipamentos (grupo Cadastros),
-- mas o módulo Frota usa *_veiculo. Usuários com permissão de Frota viam o
-- botão "+", abriam o form, mas o INSERT era bloqueado silenciosamente.
--
-- Solução: aceitar EITHER action — preserva o controle granular existente,
-- elimina o bug.
--
-- Tabela afetada: public.equipamentos
-- Policies afetadas: equipamentos_insert, equipamentos_update, equipamentos_delete
-- (equipamentos_select segue USING true — não muda)

DROP POLICY IF EXISTS "equipamentos_insert" ON public.equipamentos;
CREATE POLICY "equipamentos_insert" ON public.equipamentos
  FOR INSERT TO authenticated
  WITH CHECK (
    private.current_has_action('criar_equipamentos')
    OR private.current_has_action('criar_veiculo')
  );

DROP POLICY IF EXISTS "equipamentos_update" ON public.equipamentos;
CREATE POLICY "equipamentos_update" ON public.equipamentos
  FOR UPDATE TO authenticated
  USING (
    private.current_has_action('editar_equipamentos')
    OR private.current_has_action('editar_veiculo')
  )
  WITH CHECK (
    private.current_has_action('editar_equipamentos')
    OR private.current_has_action('editar_veiculo')
  );

DROP POLICY IF EXISTS "equipamentos_delete" ON public.equipamentos;
CREATE POLICY "equipamentos_delete" ON public.equipamentos
  FOR DELETE TO authenticated
  USING (
    private.current_has_action('excluir_equipamentos')
    OR private.current_has_action('excluir_veiculo')
  );
