-- HF.3 — Combustível: SET search_path em SECURITY DEFINER functions.
--
-- Finding 1 do audit (HIGH): funções SECDEF sem search_path fixo permitem
-- schema shadowing. Usuário malicioso pode criar tabelas em schema próprio
-- e manipular search_path da sessão, fazendo função privilegiada referenciar
-- objetos fantasmas.
--
-- recalcular_nivel_deposito e calcular_estoque_combustivel_na_data já
-- recebem SET search_path em HF.1 via CREATE OR REPLACE. Esta migration
-- cobre as legacy wrappers que ainda existem antes de serem dropadas em HF.4.
--
-- Nota de descoberta (21/05/2026):
--   - trigger_*_nivel tinham search_path=pg_catalog,public — atualizados para public,pg_temp
--   - calcular_estoque_material_na_data tem 4 args (não 3) — assinatura corrigida
-- Idempotente.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_entrada_combustivel_nivel' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.trigger_entrada_combustivel_nivel() SET search_path = public, pg_temp';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_transferencia_combustivel_nivel' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.trigger_transferencia_combustivel_nivel() SET search_path = public, pg_temp';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_abastecimento_nivel' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.trigger_abastecimento_nivel() SET search_path = public, pg_temp';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calcular_estoque_material' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.calcular_estoque_material(text, text) SET search_path = public, pg_temp';
  END IF;

  -- 4 args: p_deposito_material_id text, p_insumo_id text, p_data_hora text, p_excluir_id text DEFAULT NULL
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calcular_estoque_material_na_data' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.calcular_estoque_material_na_data(text, text, text, text) SET search_path = public, pg_temp';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calcular_todo_estoque_material' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.calcular_todo_estoque_material() SET search_path = public, pg_temp';
  END IF;
END$$;
