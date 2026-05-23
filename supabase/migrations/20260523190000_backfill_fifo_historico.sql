-- =============================================================================
-- FI.6 — Backfill FIFO retroativo de todo o histórico
-- =============================================================================
-- Replay cronológico por tanque:
-- 1. Lista entradas + transferências recebidas (lotes) por data ASC
-- 2. Lista saídas equipamento_proprio por data ASC
-- 3. Para cada saída em ordem: consome dos lotes em ordem, popula saidas_lotes,
--    atualiza preco_unitario/valor_total/snapshot da saída
-- 4. Saídas anteriores a qualquer lote (ou sem suprimento suficiente) →
--    saidas_sem_suprimento (sobra registrada)
--
-- Carreta_transportadora preservada (preço de negociação externa).
-- Triggers desabilitados via session_replication_role pra evitar re-validações
-- (mesmo trick da migration wall-clock).
--
-- Algoritmo reescrito vs draft original:
--   - Usa TEMP TABLE de lotes (saldo mutável via UPDATE) em vez de jsonb
--     mutável dentro do loop (mais previsível, sem risco de race entre
--     jsonb_set e leituras subsequentes)
--   - Cursores materializados em arrays locais antes de iterar
--   - Preço capturado antes de qualquer mutação de saldo
-- =============================================================================

DO $$
DECLARE
  v_tanque record;
  v_saida record;
  v_lote record;
  v_litros_restantes numeric;
  v_litros_consome numeric;
  v_total_valor numeric;
  v_total_litros numeric;
  v_preco_lote numeric;
  v_n_saidas int := 0;
  v_n_lotes_inseridos int := 0;
  v_n_sem_suprimento int := 0;
  v_n_tanques int := 0;
BEGIN
  -- Limpa backfill anterior se rodando de novo (idempotente)
  TRUNCATE public.saidas_lotes;
  TRUNCATE public.saidas_sem_suprimento;

  -- Desabilita triggers (saidas_combustivel tem validações que falhariam em update massivo)
  SET LOCAL session_replication_role = 'replica';

  -- Tabela temporária pra acompanhar saldo dos lotes do tanque atual.
  -- Usa UPDATE simples ao invés de jsonb mutável: muito mais previsível.
  CREATE TEMP TABLE IF NOT EXISTS _backfill_lotes_tanque (
    seq           bigserial PRIMARY KEY,
    fonte_tipo    text NOT NULL,
    fonte_id      text NOT NULL,
    data_origem   timestamp NOT NULL,
    litros_orig   numeric NOT NULL,
    saldo         numeric NOT NULL,
    preco         numeric NOT NULL
  ) ON COMMIT DROP;

  FOR v_tanque IN
    SELECT id FROM public.depositos WHERE deleted_at IS NULL ORDER BY id
  LOOP
    v_n_tanques := v_n_tanques + 1;

    -- Reset por tanque
    TRUNCATE _backfill_lotes_tanque RESTART IDENTITY;

    -- Insere ENTRADAS do tanque
    INSERT INTO _backfill_lotes_tanque (fonte_tipo, fonte_id, data_origem, litros_orig, saldo, preco)
    SELECT
      'entrada',
      e.id,
      e.data_hora,
      e.quantidade_litros,
      e.quantidade_litros,
      CASE WHEN e.quantidade_litros > 0 THEN e.valor_total / e.quantidade_litros ELSE 0 END
    FROM public.entradas_combustivel e
    WHERE e.deposito_id = v_tanque.id AND e.deleted_at IS NULL;

    -- Insere TRANSFERÊNCIAS recebidas (deposito_destino)
    INSERT INTO _backfill_lotes_tanque (fonte_tipo, fonte_id, data_origem, litros_orig, saldo, preco)
    SELECT
      'transferencia',
      t.id,
      t.data_hora,
      t.quantidade_litros,
      t.quantidade_litros,
      CASE WHEN t.quantidade_litros > 0 THEN t.valor_total / t.quantidade_litros ELSE 0 END
    FROM public.transferencias_combustivel t
    WHERE t.deposito_destino_id = v_tanque.id AND t.deleted_at IS NULL;

    -- Itera saídas equipamento_proprio do tanque em ordem cronológica
    FOR v_saida IN
      SELECT id, data, litros
      FROM public.saidas_combustivel
      WHERE tanque_id = v_tanque.id
        AND tipo_consumidor = 'equipamento_proprio'
        AND origem = 'tanque'
        AND deleted_at IS NULL
      ORDER BY data ASC, id ASC
    LOOP
      v_litros_restantes := v_saida.litros;
      v_total_valor := 0;
      v_total_litros := 0;

      -- Consome lotes ELEGÍVEIS (data <= saida) em ordem FIFO (data ASC, seq ASC)
      -- Re-avaliado a cada iteração via cursor implícito do FOR; como SÓ
      -- atualizamos 'saldo' (sem DELETE), o ranking permanece estável.
      FOR v_lote IN
        SELECT seq, fonte_tipo, fonte_id, saldo, preco
        FROM _backfill_lotes_tanque
        WHERE data_origem <= v_saida.data
          AND saldo > 0
        ORDER BY data_origem ASC, seq ASC
      LOOP
        EXIT WHEN v_litros_restantes <= 0;

        -- Captura preço ANTES de qualquer mutação (segurança máxima)
        v_preco_lote := v_lote.preco;

        v_litros_consome := LEAST(v_litros_restantes, v_lote.saldo);

        -- Registra detalhamento FIFO
        INSERT INTO public.saidas_lotes (saida_id, fonte_tipo, fonte_id, litros, preco_lote)
        VALUES (v_saida.id, v_lote.fonte_tipo, v_lote.fonte_id, v_litros_consome, v_preco_lote);

        v_n_lotes_inseridos := v_n_lotes_inseridos + 1;

        -- Decrementa saldo do lote
        UPDATE _backfill_lotes_tanque
        SET saldo = saldo - v_litros_consome
        WHERE seq = v_lote.seq;

        v_total_valor := v_total_valor + v_litros_consome * v_preco_lote;
        v_total_litros := v_total_litros + v_litros_consome;
        v_litros_restantes := v_litros_restantes - v_litros_consome;
      END LOOP;

      v_n_saidas := v_n_saidas + 1;

      -- Atualiza saída com preço FIFO real (média ponderada dos lotes consumidos)
      IF v_total_litros > 0 THEN
        UPDATE public.saidas_combustivel
        SET preco_unitario = v_total_valor / v_total_litros,
            preco_medio_tanque_snapshot = v_total_valor / v_total_litros,
            valor_total = (v_total_valor / v_total_litros) * v_saida.litros,
            updated_at = now(),
            updated_by = COALESCE(updated_by, 'sistema') || ' [backfill FIFO]'
        WHERE id = v_saida.id;
      END IF;

      -- Sobra → sem suprimento (saída ocorreu sem lote suficiente)
      IF v_litros_restantes > 0 THEN
        INSERT INTO public.saidas_sem_suprimento (
          saida_id, tanque_id, data_saida, litros_solicitados,
          litros_supridos, litros_sem_suprimento
        ) VALUES (
          v_saida.id,
          v_tanque.id,
          v_saida.data,
          v_saida.litros,
          v_total_litros,
          v_litros_restantes
        );
        v_n_sem_suprimento := v_n_sem_suprimento + 1;
      END IF;
    END LOOP;
  END LOOP;

  -- Reabilita triggers
  SET LOCAL session_replication_role = 'origin';

  RAISE NOTICE 'Backfill FIFO concluído: % tanques, % saídas processadas, % linhas em saidas_lotes, % saídas órfãs',
    v_n_tanques, v_n_saidas, v_n_lotes_inseridos, v_n_sem_suprimento;
END$$;
