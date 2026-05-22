-- HF.5 — Combustível: trigger BEFORE INSERT/UPDATE em saidas_combustivel.
--
-- Duas responsabilidades:
--
-- (a) Auto-stampar `tipo_combustivel`. O frontend lia `combustivel_atual_id`
--     (mobile) ou a última entrada (web) e gravava no campo. Quando o
--     `combustivel_atual_id` ficava preso (HF.1 regression) ou a última
--     entrada não refletia o tanque na data da saída, o tipo gravado ficava
--     errado. Agora o DB derive sempre do histórico via
--     calcular_combustivel_tanque_na_data(tanque_id, data) — vide HF.4.
--     Tanques externos (`eh_externo=true`) ficam fora (não temos controle
--     de estoque interno deles).
--
-- (b) Validar saldo point-in-time. Hoje o sistema aceita litros > nível.
--     Usa a função existente calcular_estoque_combustivel_na_data
--     (vide migração 20260521120000_combustivel_deleted_at_filter.sql),
--     passando NEW.id como p_excluir_id em UPDATE — não conta a própria
--     saída em edição.
--
-- Skip esperto pra saldo em UPDATE: se os campos saldo-relevantes
-- (litros, data, tanque_id, origem) não mudaram, pula a validação. Isso
-- protege backfills (HF.6) e edições cosméticas (descrição, fotos, etc.)
-- mesmo quando a saída histórica violava saldo antes do trigger existir.
--
-- Saídas com origem != 'tanque' ou tanque_id NULL ou tanque externo
-- passam sem validação (carreta financeira / tanque externo).

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

  -- (a) Auto-stamp do tipo_combustivel
  NEW.tipo_combustivel := public.calcular_combustivel_tanque_na_data(
    NEW.tanque_id,
    v_data_text
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

DROP TRIGGER IF EXISTS trg_validate_saida_combustivel ON public.saidas_combustivel;
CREATE TRIGGER trg_validate_saida_combustivel
  BEFORE INSERT OR UPDATE ON public.saidas_combustivel
  FOR EACH ROW EXECUTE FUNCTION public.fn_validate_saida_combustivel();
