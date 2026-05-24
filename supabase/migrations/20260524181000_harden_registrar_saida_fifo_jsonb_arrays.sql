-- Hardening: registrar_saida_combustivel_fifo quebrava com
-- "cannot extract elements from a scalar" quando foto_urls ou arquivo_urls
-- chegavam como jsonb 'null' (e não como array []). Mapper do front foi
-- corrigido em paralelo (src/lib/mappers.ts saidaCombustivelToDb), mas
-- tornamos a função robusta também — defesa em profundidade.

CREATE OR REPLACE FUNCTION public.registrar_saida_combustivel_fifo(
  p_saida jsonb,
  p_lotes jsonb,
  p_litros_sem_suprimento numeric DEFAULT 0
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_saida_id text;
  v_lote jsonb;
  v_foto_urls jsonb := p_saida->'foto_urls';
  v_arquivo_urls jsonb := p_saida->'arquivo_urls';
BEGIN
  IF NOT (
    private.current_has_action('criar_saida_combustivel')
    OR private.current_has_action('criar_abastecimento_carreta')
  ) THEN
    RAISE EXCEPTION 'Permissão negada para registrar saída de combustível';
  END IF;

  IF v_foto_urls IS NULL OR jsonb_typeof(v_foto_urls) <> 'array' THEN
    v_foto_urls := '[]'::jsonb;
  END IF;
  IF v_arquivo_urls IS NULL OR jsonb_typeof(v_arquivo_urls) <> 'array' THEN
    v_arquivo_urls := '[]'::jsonb;
  END IF;

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
    (p_saida->>'data')::timestamp,
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
    ARRAY(SELECT jsonb_array_elements_text(v_foto_urls)),
    ARRAY(SELECT jsonb_array_elements_text(v_arquivo_urls)),
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

  IF p_lotes IS NOT NULL AND jsonb_typeof(p_lotes) = 'array' THEN
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
  END IF;

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
$function$;
