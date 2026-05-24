-- Fix: recalcular_nivel_deposito comparava timestamp >= text por causa de
-- MAX(data_hora::text) e literal '1970-01-01' (text). Quebrava QUALQUER
-- INSERT/UPDATE/DELETE em saidas_combustivel ao disparar
-- trg_saidas_combustivel_recalc_nivel.
--
-- Sintoma: usuário tentava salvar saída de combustível e UI mostrava
-- "Erro ao salvar saída". Log Postgres: "operator does not exist:
-- timestamp without time zone >= text" em recalcular_nivel_deposito line 45.
--
-- Reproduzido manualmente via INSERT direto (mesma stack do trigger).
-- Após fix, INSERT funciona.

CREATE OR REPLACE FUNCTION public.recalcular_nivel_deposito(p_deposito_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_entradas numeric := 0;
  v_transf_in numeric := 0;
  v_saidas numeric := 0;
  v_transf_out numeric := 0;
  v_esvazia numeric := 0;
  v_nivel numeric;
  v_ultimo_insumo text;
  v_ultimo_esvazia timestamp;
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

  SELECT MAX(data_hora) INTO v_ultimo_esvazia
    FROM public.esvaziamentos_tanque
   WHERE deposito_id = p_deposito_id;

  IF v_nivel <= 0 THEN
    v_ultimo_insumo := NULL;
  ELSE
    SELECT tipo_combustivel
      INTO v_ultimo_insumo
      FROM public.entradas_combustivel
     WHERE deposito_id = p_deposito_id
       AND deleted_at IS NULL
       AND data_hora >= COALESCE(v_ultimo_esvazia, '1970-01-01'::timestamp)
     ORDER BY data_hora DESC
     LIMIT 1;

    IF v_ultimo_insumo IS NULL THEN
      SELECT t.tipo_combustivel
        INTO v_ultimo_insumo
        FROM public.transferencias_combustivel t
       WHERE t.deposito_destino_id = p_deposito_id
         AND t.deleted_at IS NULL
         AND t.tipo_combustivel IS NOT NULL
         AND t.data_hora >= COALESCE(v_ultimo_esvazia, '1970-01-01'::timestamp)
       ORDER BY t.data_hora DESC
       LIMIT 1;
    END IF;
  END IF;

  UPDATE public.depositos
     SET nivel_atual_litros = v_nivel,
         combustivel_atual_id = v_ultimo_insumo
   WHERE id = p_deposito_id;
END;
$function$;
