-- Re-backfill completo dos tanques Canteiro 1 e Canteiro 2:
-- 1) Ajusta hora da entrada do Canteiro 2 (12:43 → 07:43, antes da saída 12:08)
-- 2) Limpa consumos_lote e saidas_sem_suprimento desses 2 tanques
-- 3) Re-aloca FIFO todas as saídas (equipamento_proprio + carreta)
-- 4) Recalcula nível
--
-- Motivo: as 2 saídas dos canteiros (60L e 51L em 01/05) estavam em
-- sem_suprimento porque a entrada inicial do tanque tinha horário posterior
-- à primeira saída do dia. Ajustar a hora exigia editar entrada via UI mas
-- a validação de mistura impedia (tanque já tem outro tipo depois).
-- Frontend foi corrigido em paralelo (EntradaForm.tsx).

DO $$
DECLARE
  v_tanque text;
  v_saida record;
  v_lote record;
  v_litros_restantes numeric;
  v_litros_consome numeric;
  v_total_valor numeric;
  v_total_litros numeric;
  v_n_saidas int := 0;
BEGIN
  SET LOCAL session_replication_role = 'replica';

  UPDATE public.entradas_combustivel
  SET data_hora = '2026-05-01 07:43:00'::timestamp,
      updated_at = now(),
      updated_by = COALESCE(updated_by, 'sistema') || ' [fix sem_suprimento]'
  WHERE id = 'mot9zk7sdhn1z';

  DELETE FROM public.consumos_lote c
  USING public.saidas_combustivel s
  WHERE c.consumo_id = s.id AND c.consumo_tipo = 'saida'
    AND s.tanque_id IN ('morb6x252ikgy', 'mora91lkaic8b');

  DELETE FROM public.saidas_sem_suprimento
  WHERE tanque_id IN ('morb6x252ikgy', 'mora91lkaic8b');

  CREATE TEMP TABLE _bf_lotes_full (
    seq           bigserial PRIMARY KEY,
    fonte_tipo    text NOT NULL,
    fonte_id      text NOT NULL,
    data_origem   timestamp NOT NULL,
    saldo         numeric NOT NULL,
    preco         numeric NOT NULL
  ) ON COMMIT DROP;

  FOREACH v_tanque IN ARRAY ARRAY['morb6x252ikgy', 'mora91lkaic8b']
  LOOP
    TRUNCATE _bf_lotes_full RESTART IDENTITY;

    INSERT INTO _bf_lotes_full (fonte_tipo, fonte_id, data_origem, saldo, preco)
    SELECT
      'entrada', e.id, e.data_hora, e.quantidade_litros,
      CASE WHEN e.quantidade_litros > 0 THEN e.valor_total / e.quantidade_litros ELSE 0 END
    FROM public.entradas_combustivel e
    WHERE e.deposito_id = v_tanque AND e.deleted_at IS NULL;

    INSERT INTO _bf_lotes_full (fonte_tipo, fonte_id, data_origem, saldo, preco)
    SELECT
      'transferencia', t.id, t.data_hora, t.quantidade_litros,
      CASE WHEN t.quantidade_litros > 0 THEN t.valor_total / t.quantidade_litros ELSE 0 END
    FROM public.transferencias_combustivel t
    WHERE t.deposito_destino_id = v_tanque AND t.deleted_at IS NULL;

    FOR v_saida IN
      SELECT s.id, s.data, s.litros, s.tipo_consumidor
      FROM public.saidas_combustivel s
      WHERE s.tanque_id = v_tanque
        AND s.origem = 'tanque'
        AND s.deleted_at IS NULL
      ORDER BY s.data ASC, s.id ASC
    LOOP
      v_litros_restantes := v_saida.litros;
      v_total_valor := 0;
      v_total_litros := 0;

      FOR v_lote IN
        SELECT seq, fonte_tipo, fonte_id, saldo, preco
        FROM _bf_lotes_full
        WHERE data_origem <= v_saida.data AND saldo > 0
        ORDER BY data_origem ASC, seq ASC
      LOOP
        EXIT WHEN v_litros_restantes <= 0;
        v_litros_consome := LEAST(v_litros_restantes, v_lote.saldo);

        INSERT INTO public.consumos_lote (
          consumo_id, consumo_tipo, fonte_tipo, fonte_id, litros, preco_lote
        ) VALUES (
          v_saida.id, 'saida', v_lote.fonte_tipo, v_lote.fonte_id,
          v_litros_consome, v_lote.preco
        );

        UPDATE _bf_lotes_full SET saldo = saldo - v_litros_consome WHERE seq = v_lote.seq;

        v_total_valor := v_total_valor + v_litros_consome * v_lote.preco;
        v_total_litros := v_total_litros + v_litros_consome;
        v_litros_restantes := v_litros_restantes - v_litros_consome;
      END LOOP;

      IF v_saida.tipo_consumidor = 'equipamento_proprio' AND v_total_litros > 0 THEN
        UPDATE public.saidas_combustivel
        SET preco_unitario = v_total_valor / v_total_litros,
            preco_medio_tanque_snapshot = v_total_valor / v_total_litros,
            valor_total = (v_total_valor / v_total_litros) * v_saida.litros,
            updated_at = now()
        WHERE id = v_saida.id;
      END IF;

      IF v_litros_restantes > 0 THEN
        INSERT INTO public.saidas_sem_suprimento (
          saida_id, tanque_id, data_saida, litros_solicitados,
          litros_supridos, litros_sem_suprimento
        ) VALUES (
          v_saida.id, v_tanque, v_saida.data, v_saida.litros,
          v_saida.litros - v_litros_restantes, v_litros_restantes
        );
      END IF;

      v_n_saidas := v_n_saidas + 1;
    END LOOP;
  END LOOP;

  SET LOCAL session_replication_role = 'origin';

  RAISE NOTICE 'Rebackfill canteiros: % saídas processadas', v_n_saidas;
END$$;

SELECT public.recalcular_nivel_deposito('morb6x252ikgy');
SELECT public.recalcular_nivel_deposito('mora91lkaic8b');
