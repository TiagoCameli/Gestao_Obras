-- HF.7 — Combustível: denormalizar tipo_combustivel em transferencias_combustivel.
--
-- Bug: o fallback de transferência em recalcular_nivel_deposito (HF.3) e em
-- calcular_combustivel_tanque_na_data (HF.4) lia `d.combustivel_atual_id` do
-- tanque origem — valor ATUAL, não o que ele tinha na DATA da transferência.
-- Quando o origem muda de combustível depois, o destino fica com o tipo
-- errado. Sintoma: Meloza EMT recebeu 3.000 L de Diesel S500 de Canteiro 2
-- em 12/05/2026, mas depois Canteiro 2 trocou pra S10 e o sistema passou a
-- mostrar S10 também na Meloza EMT.
--
-- Fix estrutural: nova coluna `tipo_combustivel` em transferencias_combustivel,
-- gravada no momento da transferência. Backfill iterativo cobre o histórico.
-- Trigger BEFORE INSERT/UPDATE auto-stampa pra futuras transferências —
-- frontend não precisa enviar.

-- (1) Coluna
ALTER TABLE public.transferencias_combustivel
  ADD COLUMN IF NOT EXISTS tipo_combustivel text
  REFERENCES public.insumos(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_transferencias_combustivel_tipo
  ON public.transferencias_combustivel (tipo_combustivel);

-- (2) Backfill iterativo. Cada iteração popula transferências cuja origem:
--   (a) teve uma entrada direta antes da transferência (pós-último esvaziamento), OU
--   (b) recebeu uma transferência cujo tipo_combustivel já foi populado.
-- Loop até estabilizar (nenhuma linha atualizada na iteração).
--
-- DISABLE temporariamente o trg_validate_transferencia_combustivel (F11):
-- ele faz BEFORE UPDATE/INSERT e dispara em qualquer mexida na linha, mesmo
-- só tocando tipo_combustivel. Como o estado atual de depositos.combustivel_atual_id
-- ainda pode estar inconsistente (é exatamente o que estamos consertando), a
-- validação de mistura falsa-positiva e aborta o UPDATE. Reabilitamos no fim.
ALTER TABLE public.transferencias_combustivel
  DISABLE TRIGGER trg_validate_transferencia_combustivel;

DO $$
DECLARE
  v_atualizadas int;
  v_iter int := 0;
BEGIN
  LOOP
    v_iter := v_iter + 1;
    WITH calc AS (
      SELECT t.id,
             COALESCE(
               -- (a) última entrada direta na origem antes da transferência
               (SELECT e.tipo_combustivel
                  FROM public.entradas_combustivel e
                 WHERE e.deposito_id = t.deposito_origem_id
                   AND e.deleted_at IS NULL
                   AND e.data_hora <= t.data_hora
                   AND e.data_hora >= COALESCE(
                     (SELECT MAX(data_hora::text)
                        FROM public.esvaziamentos_tanque
                       WHERE deposito_id = t.deposito_origem_id
                         AND data_hora::text <= t.data_hora),
                     '1970-01-01')
                 ORDER BY e.data_hora DESC
                 LIMIT 1),
               -- (b) última transferência recebida pela origem antes da
               -- transferência, cujo tipo já foi populado em iteração anterior
               (SELECT t2.tipo_combustivel
                  FROM public.transferencias_combustivel t2
                 WHERE t2.deposito_destino_id = t.deposito_origem_id
                   AND t2.deleted_at IS NULL
                   AND t2.tipo_combustivel IS NOT NULL
                   AND t2.data_hora <= t.data_hora
                   AND t2.data_hora >= COALESCE(
                     (SELECT MAX(data_hora::text)
                        FROM public.esvaziamentos_tanque
                       WHERE deposito_id = t.deposito_origem_id
                         AND data_hora::text <= t.data_hora),
                     '1970-01-01')
                 ORDER BY t2.data_hora DESC
                 LIMIT 1)
             ) AS tipo
        FROM public.transferencias_combustivel t
       WHERE t.deleted_at IS NULL
         AND t.tipo_combustivel IS NULL
    )
    UPDATE public.transferencias_combustivel t
       SET tipo_combustivel = c.tipo
      FROM calc c
     WHERE t.id = c.id
       AND c.tipo IS NOT NULL;

    GET DIAGNOSTICS v_atualizadas = ROW_COUNT;
    RAISE NOTICE 'HF.7 backfill iter %: % transferência(s) populada(s).',
                 v_iter, v_atualizadas;
    EXIT WHEN v_atualizadas = 0 OR v_iter >= 20;
  END LOOP;
END $$;

ALTER TABLE public.transferencias_combustivel
  ENABLE TRIGGER trg_validate_transferencia_combustivel;

-- (3) Trigger BEFORE INSERT/UPDATE pra auto-stampar o tipo. Nome com
-- prefixo "00_" pra rodar antes do trg_validate_transferencia_combustivel
-- (Postgres executa triggers do mesmo evento em ordem alfabética).
CREATE OR REPLACE FUNCTION public.fn_stamp_transferencia_tipo_combustivel()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.deposito_origem_id IS NULL OR NEW.data_hora IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.tipo_combustivel := public.calcular_combustivel_tanque_na_data(
    NEW.deposito_origem_id,
    NEW.data_hora
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_00_stamp_transferencia_tipo_combustivel
  ON public.transferencias_combustivel;
CREATE TRIGGER trg_00_stamp_transferencia_tipo_combustivel
  BEFORE INSERT OR UPDATE ON public.transferencias_combustivel
  FOR EACH ROW EXECUTE FUNCTION public.fn_stamp_transferencia_tipo_combustivel();
