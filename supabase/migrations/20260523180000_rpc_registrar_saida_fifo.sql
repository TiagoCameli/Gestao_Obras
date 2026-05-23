-- =============================================================================
-- FI.3 — RPC registrar_saida_combustivel_fifo (atomic insert)
-- =============================================================================
-- Cliente passa payload da saída + array detalhamento (calculado pelo helper
-- fifoCombustivel.ts) + litrosSemSuprimento. RPC insere os 3 atomicamente:
--   1. saidas_combustivel
--   2. N saidas_lotes (rateio FIFO)
--   3. (opcional) saidas_sem_suprimento (audit row)
--
-- SECURITY DEFINER com search_path fixo + permission check no início
-- (defesa em profundidade). RLS continua aplicada via current_has_action.

CREATE OR REPLACE FUNCTION public.registrar_saida_combustivel_fifo(
  p_saida jsonb,
  p_lotes jsonb,
  p_litros_sem_suprimento numeric DEFAULT 0
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_saida_id text;
  v_lote jsonb;
BEGIN
  -- 0. Permission check (defesa em profundidade — RLS já protege INSERT na
  --    tabela, mas SECDEF bypassa RLS, então validamos aqui explicitamente).
  IF NOT (
    private.current_has_action('criar_saida_combustivel')
    OR private.current_has_action('criar_abastecimento_carreta')
  ) THEN
    RAISE EXCEPTION 'Permissão negada para registrar saída de combustível';
  END IF;

  -- 1. Insert da saída principal
  INSERT INTO public.saidas_combustivel (
    id, data, origem, tipo_consumidor,
    tanque_id, equipamento_id, transportadora_id, placa,
    obra_id, etapa_id, alocacoes,
    tipo_combustivel, litros,
    preco_medio_tanque_snapshot, taxa_litro, preco_unitario, valor_total,
    preco_combustivel, preco_combustivel_areacre,
    foto_urls, arquivo_urls,
    observacoes, pago, pago_em, movimento_id, motorista,
    medicao_no_abastecimento, tipo_medicao_snapshot,
    created_by, updated_by
  ) VALUES (
    p_saida->>'id',
    (p_saida->>'data')::timestamp,                       -- wall-clock (sem TZ)
    p_saida->>'origem',
    p_saida->>'tipo_consumidor',
    NULLIF(p_saida->>'tanque_id', ''),
    NULLIF(p_saida->>'equipamento_id', ''),
    NULLIF(p_saida->>'transportadora_id', ''),
    NULLIF(p_saida->>'placa', ''),
    NULLIF(p_saida->>'obra_id', ''),
    NULLIF(p_saida->>'etapa_id', ''),
    p_saida->'alocacoes',
    p_saida->>'tipo_combustivel',
    (p_saida->>'litros')::numeric,
    NULLIF(p_saida->>'preco_medio_tanque_snapshot', '')::numeric,
    COALESCE((p_saida->>'taxa_litro')::numeric, 0),
    (p_saida->>'preco_unitario')::numeric,
    (p_saida->>'valor_total')::numeric,
    NULLIF(p_saida->>'preco_combustivel', '')::numeric,
    NULLIF(p_saida->>'preco_combustivel_areacre', '')::numeric,
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(p_saida->'foto_urls')),
      '{}'::text[]
    ),
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(p_saida->'arquivo_urls')),
      '{}'::text[]
    ),
    p_saida->>'observacoes',
    COALESCE((p_saida->>'pago')::boolean, false),
    NULLIF(p_saida->>'pago_em', '')::timestamptz,
    NULLIF(p_saida->>'movimento_id', ''),
    COALESCE(p_saida->>'motorista', ''),
    NULLIF(p_saida->>'medicao_no_abastecimento', '')::numeric,
    NULLIF(p_saida->>'tipo_medicao_snapshot', ''),
    NULLIF(p_saida->>'created_by', ''),
    NULLIF(p_saida->>'updated_by', '')
  )
  RETURNING id INTO v_saida_id;

  -- 2. Insert dos lotes consumidos (rateio FIFO)
  FOR v_lote IN SELECT * FROM jsonb_array_elements(p_lotes)
  LOOP
    INSERT INTO public.saidas_lotes (saida_id, fonte_tipo, fonte_id, litros, preco_lote)
    VALUES (
      v_saida_id,
      v_lote->>'fonte_tipo',
      v_lote->>'fonte_id',
      (v_lote->>'litros')::numeric,
      (v_lote->>'preco_lote')::numeric
    );
  END LOOP;

  -- 3. Audit row quando há litros consumidos antes de qualquer entrada/transf
  IF p_litros_sem_suprimento > 0 THEN
    INSERT INTO public.saidas_sem_suprimento (
      saida_id, tanque_id, data_saida,
      litros_solicitados, litros_supridos, litros_sem_suprimento
    ) VALUES (
      v_saida_id,
      NULLIF(p_saida->>'tanque_id', ''),
      (p_saida->>'data')::timestamp,
      (p_saida->>'litros')::numeric,
      (p_saida->>'litros')::numeric - p_litros_sem_suprimento,
      p_litros_sem_suprimento
    );
  END IF;

  RETURN v_saida_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_saida_combustivel_fifo(jsonb, jsonb, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_saida_combustivel_fifo(jsonb, jsonb, numeric) TO authenticated;

COMMENT ON FUNCTION public.registrar_saida_combustivel_fifo(jsonb, jsonb, numeric) IS
  'FI.3: Insert atômico de saida_combustivel + saidas_lotes (rateio FIFO) + '
  '(opcional) saidas_sem_suprimento. Cliente passa payload pré-calculado pelo '
  'helper fifoCombustivel.ts. SECDEF + permission check (criar_saida_combustivel '
  'OR criar_abastecimento_carreta).';
