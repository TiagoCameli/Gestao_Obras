-- Audit Bloco 1.2 extensão: tighten RLS na tabela fretes
--
-- Identificado pelo /security-review do feat/frete-foto-chegada-drawer:
-- fretes ainda tinha "FOR ALL TO authenticated USING (true)" pré-existente
-- (não estava na lista das 5 críticas do Bloco 1.2 original).
--
-- Mesmo padrão: usa private.current_has_action() criado em 5dddb3a.
-- Cargo='Administrador' bypassa.

DROP POLICY IF EXISTS "Authenticated full access" ON public.fretes;
DROP POLICY IF EXISTS "fretes_select_authorized" ON public.fretes;
DROP POLICY IF EXISTS "fretes_insert_authorized" ON public.fretes;
DROP POLICY IF EXISTS "fretes_update_authorized" ON public.fretes;
DROP POLICY IF EXISTS "fretes_delete_authorized" ON public.fretes;

CREATE POLICY "fretes_select_authorized"
  ON public.fretes FOR SELECT TO authenticated
  USING (private.current_has_action('ver_frete'));

CREATE POLICY "fretes_insert_authorized"
  ON public.fretes FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('criar_frete'));

CREATE POLICY "fretes_update_authorized"
  ON public.fretes FOR UPDATE TO authenticated
  USING (private.current_has_action('editar_frete'))
  WITH CHECK (private.current_has_action('editar_frete'));

CREATE POLICY "fretes_delete_authorized"
  ON public.fretes FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_frete'));
