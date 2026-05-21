-- HF.7 — Combustível: granular RLS policies (substituir blanket).
--
-- Finding 6 do audit: todas as tabelas combustível tinham
-- "Authenticated full access" (FOR ALL TO authenticated USING(true) WITH CHECK(true)).
-- Resultado: qualquer usuário authenticated podia DELETE/UPDATE direto
-- via PostgREST, burlando soft-delete e fluxos de aprovação.
--
-- Fix: substituir por policies separadas SELECT/INSERT/UPDATE/DELETE
-- gated por private.current_has_action(), mesmo padrão de
-- 20260520180000_tighten_rls_fretes.sql.
--
-- Tabelas afetadas: depositos, entradas_combustivel, saidas_combustivel,
-- transferencias_combustivel, transportadora_movimentos.
--
-- Note: esvaziamentos_tanque é coberto pela HF.2 (RLS habilitado +
-- policies criadas naquela migration).

-- ============== depositos ==============
DROP POLICY IF EXISTS "Authenticated full access" ON public.depositos;
DROP POLICY IF EXISTS depositos_select ON public.depositos;
DROP POLICY IF EXISTS depositos_insert ON public.depositos;
DROP POLICY IF EXISTS depositos_update ON public.depositos;
DROP POLICY IF EXISTS depositos_delete ON public.depositos;

CREATE POLICY depositos_select ON public.depositos
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_frota'));

CREATE POLICY depositos_insert ON public.depositos
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('editar_combustivel'));

CREATE POLICY depositos_update ON public.depositos
  FOR UPDATE TO authenticated
  USING (private.current_has_action('editar_combustivel'))
  WITH CHECK (private.current_has_action('editar_combustivel'));

CREATE POLICY depositos_delete ON public.depositos
  FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_combustivel'));

-- ============== entradas_combustivel ==============
DROP POLICY IF EXISTS "Authenticated full access" ON public.entradas_combustivel;
DROP POLICY IF EXISTS entradas_combustivel_select ON public.entradas_combustivel;
DROP POLICY IF EXISTS entradas_combustivel_insert ON public.entradas_combustivel;
DROP POLICY IF EXISTS entradas_combustivel_update ON public.entradas_combustivel;
DROP POLICY IF EXISTS entradas_combustivel_delete ON public.entradas_combustivel;

CREATE POLICY entradas_combustivel_select ON public.entradas_combustivel
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_frota'));

CREATE POLICY entradas_combustivel_insert ON public.entradas_combustivel
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('criar_entrada_combustivel'));

CREATE POLICY entradas_combustivel_update ON public.entradas_combustivel
  FOR UPDATE TO authenticated
  USING (private.current_has_action('editar_combustivel'))
  WITH CHECK (private.current_has_action('editar_combustivel'));

CREATE POLICY entradas_combustivel_delete ON public.entradas_combustivel
  FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_combustivel'));

-- ============== saidas_combustivel ==============
DROP POLICY IF EXISTS "Authenticated full access" ON public.saidas_combustivel;
DROP POLICY IF EXISTS saidas_combustivel_select ON public.saidas_combustivel;
DROP POLICY IF EXISTS saidas_combustivel_insert ON public.saidas_combustivel;
DROP POLICY IF EXISTS saidas_combustivel_update ON public.saidas_combustivel;
DROP POLICY IF EXISTS saidas_combustivel_delete ON public.saidas_combustivel;

CREATE POLICY saidas_combustivel_select ON public.saidas_combustivel
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_frota'));

-- INSERT: aceita criar_saida_combustivel (equipamento próprio) OU criar_abastecimento_carreta (carreta)
CREATE POLICY saidas_combustivel_insert ON public.saidas_combustivel
  FOR INSERT TO authenticated
  WITH CHECK (
    private.current_has_action('criar_saida_combustivel')
    OR private.current_has_action('criar_abastecimento_carreta')
  );

CREATE POLICY saidas_combustivel_update ON public.saidas_combustivel
  FOR UPDATE TO authenticated
  USING (private.current_has_action('editar_combustivel'))
  WITH CHECK (private.current_has_action('editar_combustivel'));

CREATE POLICY saidas_combustivel_delete ON public.saidas_combustivel
  FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_combustivel'));

-- ============== transferencias_combustivel ==============
DROP POLICY IF EXISTS "Authenticated full access" ON public.transferencias_combustivel;
DROP POLICY IF EXISTS transferencias_combustivel_select ON public.transferencias_combustivel;
DROP POLICY IF EXISTS transferencias_combustivel_insert ON public.transferencias_combustivel;
DROP POLICY IF EXISTS transferencias_combustivel_update ON public.transferencias_combustivel;
DROP POLICY IF EXISTS transferencias_combustivel_delete ON public.transferencias_combustivel;

CREATE POLICY transferencias_combustivel_select ON public.transferencias_combustivel
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_frota'));

CREATE POLICY transferencias_combustivel_insert ON public.transferencias_combustivel
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('criar_transferencia_combustivel'));

CREATE POLICY transferencias_combustivel_update ON public.transferencias_combustivel
  FOR UPDATE TO authenticated
  USING (private.current_has_action('editar_combustivel'))
  WITH CHECK (private.current_has_action('editar_combustivel'));

CREATE POLICY transferencias_combustivel_delete ON public.transferencias_combustivel
  FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_combustivel'));

-- ============== transportadora_movimentos ==============
-- Tabela é ledger gerada por trigger; UPDATE/DELETE diretos devem ser admin-only.
DROP POLICY IF EXISTS "Authenticated full access" ON public.transportadora_movimentos;
DROP POLICY IF EXISTS transportadora_movimentos_select ON public.transportadora_movimentos;
DROP POLICY IF EXISTS transportadora_movimentos_insert ON public.transportadora_movimentos;
DROP POLICY IF EXISTS transportadora_movimentos_update ON public.transportadora_movimentos;
DROP POLICY IF EXISTS transportadora_movimentos_delete ON public.transportadora_movimentos;

CREATE POLICY transportadora_movimentos_select ON public.transportadora_movimentos
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_frete'));

-- INSERT: feito apenas por trigger fn_saidas_combustivel_movimentos.
-- Operador comum não deve criar movimento direto. Restringe a gerenciar_permissoes (admin gate).
CREATE POLICY transportadora_movimentos_insert ON public.transportadora_movimentos
  FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('gerenciar_permissoes'));

CREATE POLICY transportadora_movimentos_update ON public.transportadora_movimentos
  FOR UPDATE TO authenticated
  USING (private.current_has_action('gerenciar_permissoes'))
  WITH CHECK (private.current_has_action('gerenciar_permissoes'));

CREATE POLICY transportadora_movimentos_delete ON public.transportadora_movimentos
  FOR DELETE TO authenticated
  USING (private.current_has_action('gerenciar_permissoes'));
