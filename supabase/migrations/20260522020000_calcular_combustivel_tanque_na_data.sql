-- HF.4 — Combustível: point-in-time pra tipo de combustível no tanque.
--
-- Função `calcular_combustivel_tanque_na_data(p_deposito_id, p_data_hora)`
-- retorna o tipo_combustivel que o tanque continha naquela data — mesma
-- lógica do recalcular_nivel_deposito (HF.3) mas parametrizada por data.
--
-- Usada por:
--   - trigger fn_validate_saida_combustivel (HF.5) → auto-stampar o tipo
--     correto em saidas_combustivel.
--   - migração HF.6 de backfill → corrigir saídas históricas com tipo
--     errado.
--
-- Lógica (espelha recalcular_nivel_deposito pós-HF.3):
--   1. Última entrada (data_hora <= p_data_hora) após o último
--      esvaziamento <= p_data_hora.
--   2. Fallback: combustivel_atual_id do tanque origem da última
--      transferência recebida sob mesmo critério.
--   3. NULL se nenhuma fonte se aplica.
--
-- Filtra deleted_at IS NULL nas três tabelas. Idempotente via CREATE OR
-- REPLACE.

CREATE OR REPLACE FUNCTION public.calcular_combustivel_tanque_na_data(
  p_deposito_id text,
  p_data_hora text
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_combustivel text;
  v_ultimo_esvazia text;
BEGIN
  IF p_deposito_id IS NULL OR p_data_hora IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT MAX(data_hora::text)
    INTO v_ultimo_esvazia
    FROM public.esvaziamentos_tanque
   WHERE deposito_id = p_deposito_id
     AND data_hora::text <= p_data_hora;

  SELECT tipo_combustivel
    INTO v_combustivel
    FROM public.entradas_combustivel
   WHERE deposito_id = p_deposito_id
     AND deleted_at IS NULL
     AND data_hora <= p_data_hora
     AND data_hora >= COALESCE(v_ultimo_esvazia, '1970-01-01')
   ORDER BY data_hora DESC
   LIMIT 1;

  IF v_combustivel IS NULL THEN
    SELECT d.combustivel_atual_id
      INTO v_combustivel
      FROM public.transferencias_combustivel t
      JOIN public.depositos d ON d.id = t.deposito_origem_id
     WHERE t.deposito_destino_id = p_deposito_id
       AND t.deleted_at IS NULL
       AND t.data_hora <= p_data_hora
       AND t.data_hora >= COALESCE(v_ultimo_esvazia, '1970-01-01')
     ORDER BY t.data_hora DESC
     LIMIT 1;
  END IF;

  RETURN v_combustivel;
END;
$$;
