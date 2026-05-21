-- HF.10 — Função calcular_preco_medio_tanque_na_data
--
-- Calcula o preço médio ponderado de combustível em um tanque NA DATA
-- especificada — incluindo apenas entradas e transferências recebidas
-- com data_hora <= p_data_hora e deleted_at IS NULL.
--
-- Diferença pra recalcular_nivel_deposito: aquela função soma TODOS
-- os registros até hoje pra recalcular saldo corrente. Esta função
-- calcula o preço que teria valido no momento exato p_data_hora,
-- útil pra backfill de snapshots históricos.
--
-- Retorna 0 se não houver dados antes de p_data_hora.

CREATE OR REPLACE FUNCTION public.calcular_preco_medio_tanque_na_data(
  p_tanque_id text,
  p_data_hora text
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_entradas_litros numeric := 0;
  v_entradas_valor numeric := 0;
  v_transf_litros numeric := 0;
  v_transf_valor numeric := 0;
  v_total_litros numeric;
  v_total_valor numeric;
BEGIN
  -- Entradas no tanque até a data
  SELECT
    COALESCE(SUM(quantidade_litros), 0),
    COALESCE(SUM(valor_total), 0)
    INTO v_entradas_litros, v_entradas_valor
    FROM public.entradas_combustivel
   WHERE deposito_id = p_tanque_id
     AND data_hora <= p_data_hora
     AND deleted_at IS NULL;

  -- Transferências recebidas até a data
  SELECT
    COALESCE(SUM(quantidade_litros), 0),
    COALESCE(SUM(valor_total), 0)
    INTO v_transf_litros, v_transf_valor
    FROM public.transferencias_combustivel
   WHERE deposito_destino_id = p_tanque_id
     AND data_hora <= p_data_hora
     AND deleted_at IS NULL;

  v_total_litros := v_entradas_litros + v_transf_litros;
  v_total_valor := v_entradas_valor + v_transf_valor;

  RETURN CASE WHEN v_total_litros > 0 THEN v_total_valor / v_total_litros ELSE 0 END;
END;
$$;
