-- HF.3 — Combustível: fallback de transferência em recalcular_nivel_deposito.
--
-- Bug: a HF.1 (20260521120000) também removeu o fallback que pegava o
-- combustível da última transferência recebida quando o tanque tinha
-- nível mas não tinha entrada direta (existia na F11 original, linhas
-- 99-109 de 20260513000000_f11_lock_combustivel_por_tanque.sql).
--
-- Sintoma: tanque abastecido apenas por transferência fica com
-- combustivel_atual_id NULL mesmo com líquido dentro. A validação
-- fn_validate_entrada_combustivel (e a UI defensiva) entendem NULL como
-- "vazio" e liberam qualquer combustível — abre porta pra mistura
-- silenciosa (ex: "Meloza EMT" com 3000 L vindos de transferência
-- aceitaria gasolina sem aviso).
--
-- Fix: restaurar o fallback. Pega o combustivel_atual_id do tanque
-- origem da última transferência recebida pós-último-esvaziamento.
-- Idempotente via CREATE OR REPLACE. Roda recalcular em todos os tanques
-- pra repopular quem está com NULL indevido.

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

  IF v_nivel <= 0 THEN
    v_ultimo_insumo := NULL;
  ELSE
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

    -- Fallback: tanque com nível mas sem entrada pós-esvaziamento → pega
    -- da última transferência recebida (origem do líquido). Cobre tanques
    -- abastecidos exclusivamente por transferência.
    IF v_ultimo_insumo IS NULL THEN
      SELECT d.combustivel_atual_id
        INTO v_ultimo_insumo
        FROM public.transferencias_combustivel t
        JOIN public.depositos d ON d.id = t.deposito_origem_id
       WHERE t.deposito_destino_id = p_deposito_id
         AND t.deleted_at IS NULL
         AND t.data_hora >= COALESCE(
           (SELECT MAX(data_hora::text) FROM public.esvaziamentos_tanque WHERE deposito_id = p_deposito_id),
           '1970-01-01'
         )
       ORDER BY t.data_hora DESC
       LIMIT 1;
    END IF;
  END IF;

  UPDATE public.depositos
     SET nivel_atual_litros = v_nivel,
         combustivel_atual_id = v_ultimo_insumo
   WHERE id = p_deposito_id;
END;
$$;

-- Sanity: recalcular todos os tanques pra repopular combustivel_atual_id
-- de quem estava com NULL por causa do fallback ausente.
DO $$
DECLARE v record;
BEGIN
  FOR v IN SELECT id FROM public.depositos LOOP
    PERFORM public.recalcular_nivel_deposito(v.id);
  END LOOP;
END $$;
