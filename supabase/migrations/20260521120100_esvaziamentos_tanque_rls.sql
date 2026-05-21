-- HF.2 — Combustível: habilitar RLS + policies em esvaziamentos_tanque.
--
-- Finding 2 do audit: tabela criada em 20260513000000_f11... sem
-- ENABLE RLS. Qualquer authenticated pode INSERT/UPDATE/DELETE direto
-- via PostgREST, corrompendo o saldo dos tanques.
--
-- Fix: enable RLS + policies por ação (mesmo padrão dos tighten_rls).

ALTER TABLE public.esvaziamentos_tanque ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotente)
DROP POLICY IF EXISTS esvaziamentos_tanque_select ON public.esvaziamentos_tanque;
DROP POLICY IF EXISTS esvaziamentos_tanque_insert ON public.esvaziamentos_tanque;
DROP POLICY IF EXISTS esvaziamentos_tanque_update ON public.esvaziamentos_tanque;
DROP POLICY IF EXISTS esvaziamentos_tanque_delete ON public.esvaziamentos_tanque;

-- SELECT: qualquer authenticated com ver_frota
CREATE POLICY esvaziamentos_tanque_select
  ON public.esvaziamentos_tanque
  FOR SELECT
  TO authenticated
  USING (private.current_has_action('ver_frota'));

-- INSERT: editar_combustivel (mesmo perm que controla saídas/transferências)
CREATE POLICY esvaziamentos_tanque_insert
  ON public.esvaziamentos_tanque
  FOR INSERT
  TO authenticated
  WITH CHECK (private.current_has_action('editar_combustivel'));

-- UPDATE: editar_combustivel
CREATE POLICY esvaziamentos_tanque_update
  ON public.esvaziamentos_tanque
  FOR UPDATE
  TO authenticated
  USING (private.current_has_action('editar_combustivel'))
  WITH CHECK (private.current_has_action('editar_combustivel'));

-- DELETE: excluir_combustivel (mesmo perm que controla outras tabelas combustível)
CREATE POLICY esvaziamentos_tanque_delete
  ON public.esvaziamentos_tanque
  FOR DELETE
  TO authenticated
  USING (private.current_has_action('excluir_combustivel'));
