-- HF.1 — Combustível: filtrar deleted_at IS NULL nas funções de saldo.
--
-- Bug: recalcular_nivel_deposito e calcular_estoque_combustivel_na_data
-- somam registros soft-deletados (deleted_at IS NOT NULL), inflando o saldo
-- do tanque após soft-delete via UI. Resultado: nível e custo errados.
--
-- Fix: adicionar AND deleted_at IS NULL nos SELECTs.
-- Idempotente via CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.recalcular_nivel_deposito(p_deposito_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entradas numeric := 0;
  v_transf_in numeric := 0;
  v_saidas numeric := 0;
  v_transf_out numeric := 0;
  v_esvazia numeric := 0;
  v_nivel numeric;
  v_ultimo_insumo text;
BEGIN
  SELECT COALESCE(SUM(quantidade_litros), 0)
    INTO v_entradas
    FROM public.entradas_combustivel
   WHERE deposito_id = p_deposito_id
     AND deleted_at IS NULL;

  SELECT COALESCE(SUM(quantidade_litros), 0)
    INTO v_transf_in
    FROM public.transferencias_combustivel
   WHERE deposito_destino_id = p_deposito_id
     AND deleted_at IS NULL;

  SELECT COALESCE(SUM(litros), 0)
    INTO v_saidas
    FROM public.saidas_combustivel
   WHERE tanque_id = p_deposito_id
     AND deleted_at IS NULL;

  SELECT COALESCE(SUM(quantidade_litros), 0)
    INTO v_transf_out
    FROM public.transferencias_combustivel
   WHERE deposito_origem_id = p_deposito_id
     AND deleted_at IS NULL;

  SELECT COALESCE(SUM(litros_descartados), 0)
    INTO v_esvazia
    FROM public.esvaziamentos_tanque
   WHERE deposito_id = p_deposito_id;

  v_nivel := GREATEST(v_entradas + v_transf_in - v_saidas - v_transf_out - v_esvazia, 0);

  SELECT tipo_combustivel
    INTO v_ultimo_insumo
    FROM public.entradas_combustivel
   WHERE deposito_id = p_deposito_id
     AND deleted_at IS NULL
     AND data_hora >= COALESCE(
       (SELECT MAX(data_hora::text) FROM public.esvaziamentos_tanque WHERE deposito_id = p_deposito_id),
       '1970-01-01'
     )
   ORDER BY data_hora DESC
   LIMIT 1;

  UPDATE public.depositos
     SET nivel_atual_litros = v_nivel,
         combustivel_atual_id = v_ultimo_insumo
   WHERE id = p_deposito_id;
END;
$$;


CREATE OR REPLACE FUNCTION public.calcular_estoque_combustivel_na_data(
  p_deposito_id text,
  p_data_hora text,
  p_excluir_id text DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entradas numeric := 0;
  v_transf_in numeric := 0;
  v_saidas numeric := 0;
  v_transf_out numeric := 0;
  v_esvazia numeric := 0;
BEGIN
  SELECT COALESCE(SUM(quantidade_litros), 0)
    INTO v_entradas
    FROM public.entradas_combustivel
   WHERE deposito_id = p_deposito_id
     AND data_hora <= p_data_hora
     AND deleted_at IS NULL
     AND (p_excluir_id IS NULL OR id <> p_excluir_id);

  SELECT COALESCE(SUM(quantidade_litros), 0)
    INTO v_transf_in
    FROM public.transferencias_combustivel
   WHERE deposito_destino_id = p_deposito_id
     AND data_hora <= p_data_hora
     AND deleted_at IS NULL
     AND (p_excluir_id IS NULL OR id <> p_excluir_id);

  SELECT COALESCE(SUM(litros), 0)
    INTO v_saidas
    FROM public.saidas_combustivel
   WHERE tanque_id = p_deposito_id
     AND data::text <= p_data_hora
     AND deleted_at IS NULL
     AND (p_excluir_id IS NULL OR id <> p_excluir_id);

  SELECT COALESCE(SUM(quantidade_litros), 0)
    INTO v_transf_out
    FROM public.transferencias_combustivel
   WHERE deposito_origem_id = p_deposito_id
     AND data_hora <= p_data_hora
     AND deleted_at IS NULL
     AND (p_excluir_id IS NULL OR id <> p_excluir_id);

  SELECT COALESCE(SUM(litros_descartados), 0)
    INTO v_esvazia
    FROM public.esvaziamentos_tanque
   WHERE deposito_id = p_deposito_id
     AND data_hora::text <= p_data_hora;

  RETURN GREATEST(v_entradas + v_transf_in - v_saidas - v_transf_out - v_esvazia, 0);
END;
$$;
