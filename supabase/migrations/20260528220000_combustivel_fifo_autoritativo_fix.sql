-- =============================================================================
-- COMB.FIFO.AUTOR — FIFO de saídas de combustível AUTORITATIVO no servidor
-- =============================================================================
-- PROBLEMA (causa raiz confirmada):
--   O preço FIFO das saídas era calculado no CLIENTE (fifoCombustivel.ts) com o
--   cache do React Query possivelmente desatualizado, e CONGELADO na linha
--   (preco_unitario / preco_medio_tanque_snapshot). O RPC confiava no valor do
--   cliente e nada recalculava quando a linha do tempo do tanque mudava (ex:
--   saídas lançadas em lote, fora de ordem cronológica). Resultado: o preço da
--   saída não correspondia ao combustível que estava no tanque naquele momento.
--   Ex. tanque mpllf6ahb5s9p: saídas de 27/05 gravadas a 7,10 (lote velho já
--   esgotado) quando o FIFO real era 7,08 (lote novo).
--
-- SOLUÇÃO:
--   1. private.recompute_fifo_tanque(tanque) — fonte ÚNICA da verdade. Replay
--      cronológico (data, created_at, id), consome lotes FIFO, reconstrói
--      saidas_lotes + saidas_sem_suprimento e atualiza preco_unitario/
--      valor_total/snapshot SÓ das saídas equipamento_proprio. Carreta consome
--      lote (físico correto) mas tem o preço negociado PRESERVADO.
--   2. Triggers em entradas/transferencias/saidas → recalculam o(s) tanque(s)
--      afetado(s) automaticamente. Guarda anti-recursão via GUC app.fifo_recomputing.
--   3. RPC registrar_saida_combustivel_fifo passa a inserir só a saída; os lotes
--      são reconstruídos pelo trigger (evita duplicidade e ignora preço do cliente).
--   4. Backfill de todos os tanques (corrige o histórico).
--
-- Modelo de custo: FIFO. Comparação de datas wall-clock (timestamp sem TZ),
-- consistente com a convenção do projeto.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Função canônica de recálculo FIFO de um tanque
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.recompute_fifo_tanque(p_tanque_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_saida   record;
  v_lote    record;
  v_restante      numeric;
  v_consome       numeric;
  v_total_valor   numeric;
  v_total_litros  numeric;
  v_preco         numeric;
  v_externo       boolean;
BEGIN
  IF p_tanque_id IS NULL THEN
    RETURN;
  END IF;

  -- Marca recálculo em andamento (trigger pula reentrância) — local à transação.
  PERFORM set_config('app.fifo_recomputing', '1', true);

  -- Tanque EXTERNO (de transportadora): não tem lotes de compra, preço é
  -- externo (areacre / negociado). FIFO não se aplica — limpa qualquer
  -- artefato FIFO e sai sem mexer em preço.
  SELECT eh_externo INTO v_externo FROM public.depositos WHERE id = p_tanque_id;
  IF COALESCE(v_externo, false) THEN
    DELETE FROM public.consumos_lote
    WHERE consumo_tipo = 'saida'
      AND consumo_id IN (SELECT id FROM public.saidas_combustivel WHERE tanque_id = p_tanque_id);
    DELETE FROM public.saidas_sem_suprimento WHERE tanque_id = p_tanque_id;
    PERFORM set_config('app.fifo_recomputing', '', true);
    RETURN;
  END IF;

  -- Tabela temporária com o saldo mutável dos lotes deste tanque.
  CREATE TEMP TABLE IF NOT EXISTS _fifo_lotes (
    seq          bigserial PRIMARY KEY,
    fonte_tipo   text NOT NULL,
    fonte_id     text NOT NULL,
    data_origem  timestamp NOT NULL,
    saldo        numeric NOT NULL,
    preco        numeric NOT NULL
  ) ON COMMIT DROP;
  TRUNCATE _fifo_lotes RESTART IDENTITY;

  -- Lotes = ENTRADAS (compras) + TRANSFERÊNCIAS recebidas (destino).
  INSERT INTO _fifo_lotes (fonte_tipo, fonte_id, data_origem, saldo, preco)
  SELECT 'entrada', e.id, e.data_hora, e.quantidade_litros,
         CASE WHEN e.quantidade_litros > 0 THEN e.valor_total / e.quantidade_litros ELSE 0 END
  FROM public.entradas_combustivel e
  WHERE e.deposito_id = p_tanque_id AND e.deleted_at IS NULL;

  INSERT INTO _fifo_lotes (fonte_tipo, fonte_id, data_origem, saldo, preco)
  SELECT 'transferencia', t.id, t.data_hora, t.quantidade_litros,
         CASE WHEN t.quantidade_litros > 0 THEN t.valor_total / t.quantidade_litros ELSE 0 END
  FROM public.transferencias_combustivel t
  WHERE t.deposito_destino_id = p_tanque_id AND t.deleted_at IS NULL;

  -- Limpa detalhamento anterior das saídas deste tanque (reconstrução total).
  -- saidas_lotes é VIEW de compat; gravamos direto em consumos_lote (consumo_tipo='saida').
  DELETE FROM public.consumos_lote
  WHERE consumo_tipo = 'saida'
    AND consumo_id IN (SELECT id FROM public.saidas_combustivel WHERE tanque_id = p_tanque_id);
  DELETE FROM public.saidas_sem_suprimento
  WHERE tanque_id = p_tanque_id;

  -- Itera TODAS as saídas origem=tanque (equipamento + carreta) em ordem
  -- cronológica determinística. Carreta consome lote (físico) mas não tem
  -- preço alterado.
  FOR v_saida IN
    SELECT id, data, litros, tipo_consumidor
    FROM public.saidas_combustivel
    WHERE tanque_id = p_tanque_id
      AND origem = 'tanque'
      AND deleted_at IS NULL
    ORDER BY data ASC, created_at ASC, id ASC
  LOOP
    v_restante := v_saida.litros;
    v_total_valor := 0;
    v_total_litros := 0;

    -- Consome lotes elegíveis (data_origem <= data da saída) em ordem FIFO.
    FOR v_lote IN
      SELECT seq, fonte_tipo, fonte_id, saldo, preco
      FROM _fifo_lotes
      WHERE data_origem <= v_saida.data AND saldo > 0
      ORDER BY data_origem ASC, seq ASC
    LOOP
      EXIT WHEN v_restante <= 0;
      v_preco := v_lote.preco;
      v_consome := LEAST(v_restante, v_lote.saldo);

      INSERT INTO public.consumos_lote (consumo_id, consumo_tipo, fonte_tipo, fonte_id, litros, preco_lote)
      VALUES (v_saida.id, 'saida', v_lote.fonte_tipo, v_lote.fonte_id, v_consome, v_preco);

      UPDATE _fifo_lotes SET saldo = saldo - v_consome WHERE seq = v_lote.seq;

      v_total_valor := v_total_valor + v_consome * v_preco;
      v_total_litros := v_total_litros + v_consome;
      v_restante := v_restante - v_consome;
    END LOOP;

    -- Atualiza preço SÓ para equipamento próprio (carreta = preço negociado).
    IF v_saida.tipo_consumidor = 'equipamento_proprio' AND v_total_litros > 0 THEN
      UPDATE public.saidas_combustivel
      SET preco_unitario               = v_total_valor / v_total_litros,
          preco_medio_tanque_snapshot  = v_total_valor / v_total_litros,
          valor_total                  = (v_total_valor / v_total_litros) * v_saida.litros
      WHERE id = v_saida.id;
    END IF;

    -- Litros sem lote disponível na data (saída antes de qualquer suprimento).
    IF v_restante > 0 THEN
      INSERT INTO public.saidas_sem_suprimento (
        saida_id, tanque_id, data_saida,
        litros_solicitados, litros_supridos, litros_sem_suprimento
      ) VALUES (
        v_saida.id, p_tanque_id, v_saida.data,
        v_saida.litros, v_total_litros, v_restante
      );
    END IF;
  END LOOP;

  -- Libera a guarda.
  PERFORM set_config('app.fifo_recomputing', '', true);
END;
$$;

REVOKE ALL ON FUNCTION private.recompute_fifo_tanque(text) FROM PUBLIC, anon;

COMMENT ON FUNCTION private.recompute_fifo_tanque(text) IS
  'COMB.FIFO.AUTOR: recálculo FIFO autoritativo de um tanque. Replay cronológico, '
  'reconstrói saidas_lotes/saidas_sem_suprimento e atualiza preço das saídas '
  'equipamento_proprio. Carreta consome lote mas mantém preço negociado.';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Triggers de recálculo automático (entradas / transferencias / saidas)
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.trg_recompute_fifo_saida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
BEGIN
  IF COALESCE(current_setting('app.fifo_recomputing', true), '') = '1' THEN
    RETURN NULL;
  END IF;
  IF TG_OP <> 'INSERT' AND OLD.tanque_id IS NOT NULL THEN
    PERFORM private.recompute_fifo_tanque(OLD.tanque_id);
  END IF;
  IF TG_OP <> 'DELETE' AND NEW.tanque_id IS NOT NULL
     AND NEW.tanque_id IS DISTINCT FROM (CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.tanque_id END) THEN
    PERFORM private.recompute_fifo_tanque(NEW.tanque_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION private.trg_recompute_fifo_entrada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
BEGIN
  IF COALESCE(current_setting('app.fifo_recomputing', true), '') = '1' THEN
    RETURN NULL;
  END IF;
  IF TG_OP <> 'INSERT' AND OLD.deposito_id IS NOT NULL THEN
    PERFORM private.recompute_fifo_tanque(OLD.deposito_id);
  END IF;
  IF TG_OP <> 'DELETE' AND NEW.deposito_id IS NOT NULL
     AND NEW.deposito_id IS DISTINCT FROM (CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.deposito_id END) THEN
    PERFORM private.recompute_fifo_tanque(NEW.deposito_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION private.trg_recompute_fifo_transferencia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_tanques text[] := '{}';
  v_t text;
BEGIN
  IF COALESCE(current_setting('app.fifo_recomputing', true), '') = '1' THEN
    RETURN NULL;
  END IF;
  IF TG_OP <> 'INSERT' THEN
    IF OLD.deposito_origem_id  IS NOT NULL THEN v_tanques := v_tanques || OLD.deposito_origem_id;  END IF;
    IF OLD.deposito_destino_id IS NOT NULL THEN v_tanques := v_tanques || OLD.deposito_destino_id; END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    IF NEW.deposito_origem_id  IS NOT NULL THEN v_tanques := v_tanques || NEW.deposito_origem_id;  END IF;
    IF NEW.deposito_destino_id IS NOT NULL THEN v_tanques := v_tanques || NEW.deposito_destino_id; END IF;
  END IF;
  FOREACH v_t IN ARRAY (SELECT ARRAY(SELECT DISTINCT unnest(v_tanques)))
  LOOP
    PERFORM private.recompute_fifo_tanque(v_t);
  END LOOP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_fifo_recompute_saida ON public.saidas_combustivel;
CREATE TRIGGER trg_fifo_recompute_saida
  AFTER INSERT OR UPDATE OR DELETE ON public.saidas_combustivel
  FOR EACH ROW EXECUTE FUNCTION private.trg_recompute_fifo_saida();

DROP TRIGGER IF EXISTS trg_fifo_recompute_entrada ON public.entradas_combustivel;
CREATE TRIGGER trg_fifo_recompute_entrada
  AFTER INSERT OR UPDATE OR DELETE ON public.entradas_combustivel
  FOR EACH ROW EXECUTE FUNCTION private.trg_recompute_fifo_entrada();

DROP TRIGGER IF EXISTS trg_fifo_recompute_transferencia ON public.transferencias_combustivel;
CREATE TRIGGER trg_fifo_recompute_transferencia
  AFTER INSERT OR UPDATE OR DELETE ON public.transferencias_combustivel
  FOR EACH ROW EXECUTE FUNCTION private.trg_recompute_fifo_transferencia();

-- ─────────────────────────────────────────────────────────────────────────
-- 3. RPC passa a inserir só a saída; lotes/sem_suprimento são do trigger
-- ─────────────────────────────────────────────────────────────────────────
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
BEGIN
  IF NOT (
    private.current_has_action('criar_saida_combustivel')
    OR private.current_has_action('criar_abastecimento_carreta')
  ) THEN
    RAISE EXCEPTION 'Permissão negada para registrar saída de combustível';
  END IF;

  -- Insert da saída. saidas_lotes + saidas_sem_suprimento são reconstruídos
  -- pelo trigger trg_fifo_recompute_saida (FIFO autoritativo no servidor).
  -- p_lotes / p_litros_sem_suprimento são ignorados (compat de assinatura).
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
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_saida->'foto_urls')), '{}'::text[]),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_saida->'arquivo_urls')), '{}'::text[]),
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

  RETURN v_saida_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_saida_combustivel_fifo(jsonb, jsonb, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_saida_combustivel_fifo(jsonb, jsonb, numeric) TO authenticated;

COMMENT ON FUNCTION public.registrar_saida_combustivel_fifo(jsonb, jsonb, numeric) IS
  'COMB.FIFO.AUTOR: insere a saída; saidas_lotes/saidas_sem_suprimento e o preço '
  'FIFO das saídas equipamento_proprio são reconstruídos pelo trigger autoritativo. '
  'p_lotes/p_litros_sem_suprimento mantidos só por compat de assinatura.';

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Backup do estado atual + backfill de todos os tanques
-- ─────────────────────────────────────────────────────────────────────────
-- Backup pra permitir rollback exato dos valores financeiros.
DROP TABLE IF EXISTS private._fifo_backfill_backup_20260528;
CREATE TABLE private._fifo_backfill_backup_20260528 AS
SELECT id, preco_unitario, valor_total, preco_medio_tanque_snapshot
FROM public.saidas_combustivel
WHERE origem = 'tanque';

DO $$
DECLARE
  v_tanque record;
  v_n int := 0;
BEGIN
  -- Triggers desabilitados no backfill massivo (recompute é chamado explícito).
  SET LOCAL session_replication_role = 'replica';
  FOR v_tanque IN
    SELECT DISTINCT tanque_id AS id
    FROM public.saidas_combustivel
    WHERE origem = 'tanque' AND tanque_id IS NOT NULL
  LOOP
    PERFORM private.recompute_fifo_tanque(v_tanque.id);
    v_n := v_n + 1;
  END LOOP;
  SET LOCAL session_replication_role = 'origin';
  RAISE NOTICE 'Backfill FIFO autoritativo concluído: % tanques recalculados', v_n;
END$$;
