-- HF.2 — Combustível: zerar combustivel_atual_id quando o tanque fica vazio.
--
-- Bug: a migração HF.1 (20260521120000_combustivel_deleted_at_filter.sql)
-- removeu a checagem `if nivel <= 0 then combustivel := null` que existia
-- na F11 original (20260513000000). Resultado: tanque com nivel_atual_litros
-- = 0 ficava preso com combustivel_atual_id da última entrada, bloqueando
-- novas entradas de combustível diferente (ex: "Meloza Colorado" travado
-- em Diesel S10 com 0 L, impedindo entrada de S100).
--
-- Fix: restaurar o reset do combustivel_atual_id quando o nível final é 0.
-- Idempotente via CREATE OR REPLACE. Roda recalcular_nivel_deposito em
-- todos os tanques no final pra destravar quem já estava nesse estado.

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

  -- Tanque vazio → libera combustivel_atual_id pra próxima entrada.
  -- Sem essa linha, o tanque fica "preso" no último combustível mesmo a 0 L.
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
  END IF;

  UPDATE public.depositos
     SET nivel_atual_litros = v_nivel,
         combustivel_atual_id = v_ultimo_insumo
   WHERE id = p_deposito_id;
END;
$$;

-- Sanity: roda recalcular em todos os tanques pra destravar quem ficou
-- preso pela regressão da HF.1.
DO $$
DECLARE v record;
BEGIN
  FOR v IN SELECT id FROM public.depositos LOOP
    PERFORM public.recalcular_nivel_deposito(v.id);
  END LOOP;
END $$;
