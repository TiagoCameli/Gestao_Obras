-- COMB.FIX — fn_validate_saida_combustivel: nunca sobrescrever tipo_combustivel
-- com NULL no auto-stamp.
--
-- CAUSA RAIZ (confirmada 2026-05-29):
--   O trigger BEFORE INSERT/UPDATE fazia, sem proteção:
--       NEW.tipo_combustivel := calcular_combustivel_tanque_na_data(tanque, data);
--   Essa função retorna NULL legitimamente quando não há fonte de combustível
--   derivável na data (ex.: saída numa janela após esvaziamento do tanque, sem
--   entrada posterior — caso da saída mmjltfot3jjww, data 2026-03-05, tanque
--   Meloza Colorado). Como tipo_combustivel é NOT NULL, o UPDATE estourava
--   23502 e abortava a transação.
--
--   Depois do FIFO autoritativo (20260528220000), QUALQUER mutação numa saída
--   do tanque dispara recompute_fifo_tanque, que emite UPDATEs de preço nas
--   demais saídas. Cada UPDATE re-dispara este trigger BEFORE, re-carimba o
--   tipo e, se cair numa saída "NULL-stamp", aborta tudo. Resultado: o tanque
--   inteiro ficou impossível de deletar/editar.
--
-- FIX (mínimo, root-cause):
--   COALESCE — só troca o tipo quando a função consegue derivar um valor;
--   caso contrário preserva o tipo já gravado. Nunca grava NULL por cima de
--   um tipo válido.
--
-- Idempotente via CREATE OR REPLACE. Resto da lógica (skip de saldo em UPDATE,
-- bypass de tanque externo / origem != tanque) intacto.

CREATE OR REPLACE FUNCTION public.fn_validate_saida_combustivel()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_eh_externo boolean;
  v_nome_tanque text;
  v_saldo numeric;
  v_data_text text;
  v_excluir text;
  v_skip_saldo boolean := false;
BEGIN
  IF NEW.origem IS DISTINCT FROM 'tanque' OR NEW.tanque_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT eh_externo, nome
    INTO v_eh_externo, v_nome_tanque
    FROM public.depositos
   WHERE id = NEW.tanque_id;

  IF COALESCE(v_eh_externo, false) THEN
    RETURN NEW;
  END IF;

  v_data_text := NEW.data::text;

  -- (a) Auto-stamp do tipo_combustivel.
  -- COALESCE: nunca sobrescreve um tipo válido com NULL. Se a função não
  -- conseguir derivar o tipo na data (esvaziamento sem entrada posterior etc),
  -- preserva o que já está gravado na linha.
  NEW.tipo_combustivel := COALESCE(
    public.calcular_combustivel_tanque_na_data(NEW.tanque_id, v_data_text),
    NEW.tipo_combustivel
  );

  -- (b) Validação de saldo point-in-time. Pulamos quando UPDATE não
  -- mexeu em nada que afete o saldo — backfills (HF.6) e edições
  -- cosméticas não disparam o erro mesmo em dados históricos ruins.
  IF TG_OP = 'UPDATE'
     AND OLD.litros = NEW.litros
     AND OLD.data = NEW.data
     AND OLD.tanque_id IS NOT DISTINCT FROM NEW.tanque_id
     AND OLD.origem IS NOT DISTINCT FROM NEW.origem
  THEN
    v_skip_saldo := true;
  END IF;

  IF NOT v_skip_saldo THEN
    v_excluir := CASE WHEN TG_OP = 'UPDATE' THEN NEW.id ELSE NULL END;
    v_saldo := public.calcular_estoque_combustivel_na_data(
      NEW.tanque_id,
      v_data_text,
      v_excluir
    );

    IF NEW.litros > v_saldo THEN
      RAISE EXCEPTION
        'Saldo insuficiente no tanque "%": disponível % L em %, tentativa de saída de % L.',
        COALESCE(v_nome_tanque, NEW.tanque_id),
        v_saldo,
        v_data_text,
        NEW.litros;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
