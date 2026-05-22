-- HF.10 — Combustível: corrige duas funções centrais de cálculo point-in-time.
--
-- Bug 1 — `calcular_estoque_combustivel_na_data` ignorava a HORA escolhida:
--   Comparação textual `data::text <= p_data_hora` confundia formatos
--   ("2026-05-21 14:43:00+00" com espaço vs "2026-05-21T14:43" com T).
--   Byte "T" > " " fazia toda comparação `"...T..."` englobar o dia inteiro.
--   Resultado: qualquer hora de um dia retornava o saldo de FIM do dia,
--   bagunçando o TransferenciaForm e a auto-stampagem de tipo_combustivel
--   nas saídas/transferências backdated.
--
-- Bug 2 — `calcular_combustivel_tanque_na_data` retornava tipo MESMO com
--   saldo zero: usuário via "Diesel S10 — 0 L disponíveis"; trigger
--   carimbava tipo "fantasma" em transferências de tanque vazio.
--
-- Fix: castar tudo para timestamptz e comparar nativamente. Adicionar guard
-- saldo<=0 → NULL na função de combustível.
--
-- Idempotente via CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.calcular_estoque_combustivel_na_data(
  p_deposito_id text,
  p_data_hora text,
  p_excluir_id text DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entradas numeric := 0;
  v_transf_in numeric := 0;
  v_saidas numeric := 0;
  v_transf_out numeric := 0;
  v_esvazia numeric := 0;
  v_data_ts timestamptz;
BEGIN
  IF p_deposito_id IS NULL OR p_data_hora IS NULL THEN
    RETURN 0;
  END IF;

  v_data_ts := p_data_hora::timestamptz;

  -- entradas_combustivel.data_hora é TEXT (formato "YYYY-MM-DDTHH:MM"
  -- vindo do datetime-local). Cast pra timestamptz pra comparação nativa.
  SELECT COALESCE(SUM(quantidade_litros), 0)
    INTO v_entradas
    FROM public.entradas_combustivel
   WHERE deposito_id = p_deposito_id
     AND deleted_at IS NULL
     AND data_hora::timestamptz <= v_data_ts
     AND (p_excluir_id IS NULL OR id <> p_excluir_id);

  -- transferencias_combustivel.data_hora também é TEXT.
  SELECT COALESCE(SUM(quantidade_litros), 0)
    INTO v_transf_in
    FROM public.transferencias_combustivel
   WHERE deposito_destino_id = p_deposito_id
     AND deleted_at IS NULL
     AND data_hora::timestamptz <= v_data_ts
     AND (p_excluir_id IS NULL OR id <> p_excluir_id);

  -- saidas_combustivel.data é TIMESTAMPTZ nativo — compara direto.
  SELECT COALESCE(SUM(litros), 0)
    INTO v_saidas
    FROM public.saidas_combustivel
   WHERE tanque_id = p_deposito_id
     AND deleted_at IS NULL
     AND data <= v_data_ts
     AND (p_excluir_id IS NULL OR id <> p_excluir_id);

  SELECT COALESCE(SUM(quantidade_litros), 0)
    INTO v_transf_out
    FROM public.transferencias_combustivel
   WHERE deposito_origem_id = p_deposito_id
     AND deleted_at IS NULL
     AND data_hora::timestamptz <= v_data_ts
     AND (p_excluir_id IS NULL OR id <> p_excluir_id);

  -- esvaziamentos_tanque.data_hora é TIMESTAMPTZ.
  SELECT COALESCE(SUM(litros_descartados), 0)
    INTO v_esvazia
    FROM public.esvaziamentos_tanque
   WHERE deposito_id = p_deposito_id
     AND data_hora <= v_data_ts;

  RETURN GREATEST(v_entradas + v_transf_in - v_saidas - v_transf_out - v_esvazia, 0);
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
  v_data_ts timestamptz;
  v_ultimo_esvazia timestamptz;
  v_saldo numeric;
BEGIN
  IF p_deposito_id IS NULL OR p_data_hora IS NULL THEN
    RETURN NULL;
  END IF;

  v_data_ts := p_data_hora::timestamptz;

  -- Guard: tanque vazio na data → sem combustível. Resolve UI/trigger
  -- estampando tipo "fantasma" em tanque sem líquido.
  v_saldo := public.calcular_estoque_combustivel_na_data(p_deposito_id, p_data_hora);
  IF v_saldo <= 0 THEN
    RETURN NULL;
  END IF;

  -- Último esvaziamento ≤ data — limite inferior pra busca.
  SELECT MAX(data_hora)
    INTO v_ultimo_esvazia
    FROM public.esvaziamentos_tanque
   WHERE deposito_id = p_deposito_id
     AND data_hora <= v_data_ts;

  -- Última entrada na origem ≤ data, posterior ao último esvaziamento.
  SELECT tipo_combustivel
    INTO v_combustivel
    FROM public.entradas_combustivel
   WHERE deposito_id = p_deposito_id
     AND deleted_at IS NULL
     AND data_hora::timestamptz <= v_data_ts
     AND data_hora::timestamptz >= COALESCE(v_ultimo_esvazia, '1970-01-01'::timestamptz)
   ORDER BY data_hora::timestamptz DESC
   LIMIT 1;

  -- Fallback: tipo congelado na última transferência recebida (HF.7).
  IF v_combustivel IS NULL THEN
    SELECT t.tipo_combustivel
      INTO v_combustivel
      FROM public.transferencias_combustivel t
     WHERE t.deposito_destino_id = p_deposito_id
       AND t.deleted_at IS NULL
       AND t.tipo_combustivel IS NOT NULL
       AND t.data_hora::timestamptz <= v_data_ts
       AND t.data_hora::timestamptz >= COALESCE(v_ultimo_esvazia, '1970-01-01'::timestamptz)
     ORDER BY t.data_hora::timestamptz DESC
     LIMIT 1;
  END IF;

  RETURN v_combustivel;
END;
$$;
