-- Backfill targeted: 39 saídas tipo_consumidor='carreta_transportadora' em
-- tanques INTERNOS (Canteiro 1, Canteiro 2, Meloza Colorado) que ficaram fora
-- do backfill original (20260523190000) por causa do filtro
-- tipo_consumidor='equipamento_proprio' na linha 96.
--
-- Algoritmo: para cada tanque interno com órfãs, monta saldo por lote
-- subtraindo TUDO que já foi consumido (consumos_lote.litros), depois itera
-- saídas órfãs em ordem cronológica e aloca FIFO no que sobrou.
--
-- NÃO mexe nas 785 saídas equipamento_proprio já corretamente alocadas.
-- NÃO atualiza preco_unitario das 39 — preço vem da negociação com a
-- transportadora (campo preco_combustivel), não FIFO do tanque. Só popula
-- rastreio em consumos_lote.
--
-- Resultado: 39/39 alocadas. Zero para saidas_sem_suprimento.

DO $$
DECLARE
  v_tanque record;
  v_saida record;
  v_lote record;
  v_litros_restantes numeric;
  v_litros_consome numeric;
  v_n_saidas int := 0;
  v_n_lotes_inseridos int := 0;
  v_n_sem_suprimento int := 0;
BEGIN
  SET LOCAL session_replication_role = 'replica';

  CREATE TEMP TABLE _bf_carreta_lotes (
    seq           bigserial PRIMARY KEY,
    fonte_tipo    text NOT NULL,
    fonte_id      text NOT NULL,
    data_origem   timestamp NOT NULL,
    saldo         numeric NOT NULL,
    preco         numeric NOT NULL
  ) ON COMMIT DROP;

  FOR v_tanque IN
    SELECT DISTINCT d.id
    FROM public.depositos d
    JOIN public.saidas_combustivel s ON s.tanque_id = d.id
    WHERE COALESCE(d.eh_externo, false) = false
      AND s.deleted_at IS NULL
      AND s.origem = 'tanque'
      AND s.tipo_consumidor = 'carreta_transportadora'
      AND NOT EXISTS (
        SELECT 1 FROM public.consumos_lote c
        WHERE c.consumo_id = s.id AND c.consumo_tipo = 'saida'
      )
  LOOP
    TRUNCATE _bf_carreta_lotes RESTART IDENTITY;

    INSERT INTO _bf_carreta_lotes (fonte_tipo, fonte_id, data_origem, saldo, preco)
    SELECT
      'entrada', e.id, e.data_hora,
      e.quantidade_litros - COALESCE((
        SELECT SUM(c.litros) FROM public.consumos_lote c
        WHERE c.fonte_tipo='entrada' AND c.fonte_id=e.id
      ), 0),
      CASE WHEN e.quantidade_litros > 0 THEN e.valor_total / e.quantidade_litros ELSE 0 END
    FROM public.entradas_combustivel e
    WHERE e.deposito_id = v_tanque.id AND e.deleted_at IS NULL;

    INSERT INTO _bf_carreta_lotes (fonte_tipo, fonte_id, data_origem, saldo, preco)
    SELECT
      'transferencia', t.id, t.data_hora,
      t.quantidade_litros - COALESCE((
        SELECT SUM(c.litros) FROM public.consumos_lote c
        WHERE c.fonte_tipo='transferencia' AND c.fonte_id=t.id
      ), 0),
      CASE WHEN t.quantidade_litros > 0 THEN t.valor_total / t.quantidade_litros ELSE 0 END
    FROM public.transferencias_combustivel t
    WHERE t.deposito_destino_id = v_tanque.id AND t.deleted_at IS NULL;

    FOR v_saida IN
      SELECT s.id, s.data, s.litros
      FROM public.saidas_combustivel s
      WHERE s.tanque_id = v_tanque.id
        AND s.tipo_consumidor = 'carreta_transportadora'
        AND s.origem = 'tanque'
        AND s.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.consumos_lote c
          WHERE c.consumo_id = s.id AND c.consumo_tipo = 'saida'
        )
      ORDER BY s.data ASC, s.id ASC
    LOOP
      v_litros_restantes := v_saida.litros;

      FOR v_lote IN
        SELECT seq, fonte_tipo, fonte_id, saldo, preco
        FROM _bf_carreta_lotes
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

        UPDATE _bf_carreta_lotes
        SET saldo = saldo - v_litros_consome
        WHERE seq = v_lote.seq;

        v_n_lotes_inseridos := v_n_lotes_inseridos + 1;
        v_litros_restantes := v_litros_restantes - v_litros_consome;
      END LOOP;

      v_n_saidas := v_n_saidas + 1;

      IF v_litros_restantes > 0 THEN
        INSERT INTO public.saidas_sem_suprimento (
          saida_id, tanque_id, data_saida, litros_solicitados,
          litros_supridos, litros_sem_suprimento
        ) VALUES (
          v_saida.id, v_tanque.id, v_saida.data, v_saida.litros,
          v_saida.litros - v_litros_restantes, v_litros_restantes
        );
        v_n_sem_suprimento := v_n_sem_suprimento + 1;
      END IF;
    END LOOP;
  END LOOP;

  SET LOCAL session_replication_role = 'origin';

  RAISE NOTICE 'Backfill carreta: % saídas, % linhas consumos_lote, % sem_suprimento',
    v_n_saidas, v_n_lotes_inseridos, v_n_sem_suprimento;
END$$;
