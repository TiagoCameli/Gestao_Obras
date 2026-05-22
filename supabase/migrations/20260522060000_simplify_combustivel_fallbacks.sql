-- HF.8 — Combustível: simplifica fallbacks de transferência usando a coluna
-- denormalizada `transferencias_combustivel.tipo_combustivel` (HF.7).
--
-- Antes: o fallback fazia JOIN com `depositos` e lia `d.combustivel_atual_id`
-- (valor atual da origem — bug que motivou HF.7). Agora lê `t.tipo_combustivel`
-- direto, que foi congelado no momento da transferência.
--
-- Recria as duas funções com CREATE OR REPLACE (idempotente) e roda
-- recalcular_nivel_deposito em todos os tanques pra reparar quem tinha
-- combustivel_atual_id errado.

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

    -- Fallback: tanque abastecido só por transferência. Lê o tipo congelado
    -- na transferência (HF.7), não o combustivel_atual_id atual da origem.
    IF v_ultimo_insumo IS NULL THEN
      SELECT t.tipo_combustivel
        INTO v_ultimo_insumo
        FROM public.transferencias_combustivel t
       WHERE t.deposito_destino_id = p_deposito_id
         AND t.deleted_at IS NULL
         AND t.tipo_combustivel IS NOT NULL
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

  -- Mesmo fallback simplificado: lê tipo da transferência (HF.7).
  IF v_combustivel IS NULL THEN
    SELECT t.tipo_combustivel
      INTO v_combustivel
      FROM public.transferencias_combustivel t
     WHERE t.deposito_destino_id = p_deposito_id
       AND t.deleted_at IS NULL
       AND t.tipo_combustivel IS NOT NULL
       AND t.data_hora <= p_data_hora
       AND t.data_hora >= COALESCE(v_ultimo_esvazia, '1970-01-01')
     ORDER BY t.data_hora DESC
     LIMIT 1;
  END IF;

  RETURN v_combustivel;
END;
$$;

-- Sanity: recalcular todos os tanques pra reparar combustivel_atual_id
-- de quem estava lendo do origem-atual em vez do tipo congelado.
DO $$
DECLARE
  v record;
  v_corrigidos int := 0;
  v_antes text;
  v_depois text;
BEGIN
  FOR v IN SELECT id, combustivel_atual_id FROM public.depositos LOOP
    v_antes := v.combustivel_atual_id;
    PERFORM public.recalcular_nivel_deposito(v.id);
    SELECT combustivel_atual_id INTO v_depois
      FROM public.depositos WHERE id = v.id;
    IF v_antes IS DISTINCT FROM v_depois THEN
      v_corrigidos := v_corrigidos + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'HF.8 recalcular: % tanque(s) com combustivel_atual_id atualizado.', v_corrigidos;
END $$;
