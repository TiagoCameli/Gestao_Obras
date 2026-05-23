-- =============================================================================
-- Migration: sync_etapas_obra_from_contract_items
-- =============================================================================
-- Backfill one-shot + trigger AFTER INSERT/UPDATE/DELETE em
-- rodotracker_contract_items WHERE type='etapa' -> upsert em etapas_obra
-- com mesmo id.
--
-- Motivação: saidas_combustivel.etapa_id, apontamentos.etapa_obra_id,
-- registros_horas_diaristas.etapa_id e financeiro_rateios.etapa_obra_id
-- são FKs apontando pra etapas_obra.id. As etapas novas (cadastradas via
-- Cadastros → Etapas) ficavam em rodotracker_contract_items, gerando
-- FK violation na hora de inserir saidas/apontamentos/etc. Esta migration
-- garante que toda etapa (type='etapa') tenha row equivalente em
-- etapas_obra com mesmo id, preservando a integridade da FK.
--
-- FK delete behavior (Step 1 discovery):
--   - apontamentos.etapa_obra_id           -> NO ACTION (RESTRICT)
--   - registros_horas_diaristas.etapa_id   -> NO ACTION (RESTRICT)
--   - financeiro_rateios.etapa_obra_id     -> NO ACTION (RESTRICT)
--   - saidas_combustivel.etapa_id          -> SET NULL
-- Portanto: DELETE em etapas_obra falharia se houver apontamento/diarista/
-- rateio dependente. Trigger protege esse caso (skip DELETE).
-- =============================================================================

-- Parte A — Backfill one-shot
INSERT INTO public.etapas_obra (id, nome, obra_id, unidade, quantidade, valor_unitario, criado_por)
SELECT
  ci.id,
  ci.name,
  ci.obra_id,
  COALESCE(ci.unit, ''),
  COALESCE(ci.contracted_qty, 0),
  COALESCE(ci.unit_price, 0),
  COALESCE(ci.user_id::text, '')
FROM public.rodotracker_contract_items ci
WHERE ci.type = 'etapa'
  AND NOT EXISTS (SELECT 1 FROM public.etapas_obra eo WHERE eo.id = ci.id);

-- Parte B — Função de sync
CREATE OR REPLACE FUNCTION public.fn_sync_etapas_obra_from_contract_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- INSERT/UPDATE de etapa -> upsert em etapas_obra
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.type = 'etapa' THEN
    INSERT INTO public.etapas_obra (id, nome, obra_id, unidade, quantidade, valor_unitario, criado_por)
    VALUES (
      NEW.id,
      NEW.name,
      NEW.obra_id,
      COALESCE(NEW.unit, ''),
      COALESCE(NEW.contracted_qty, 0),
      COALESCE(NEW.unit_price, 0),
      COALESCE(NEW.user_id::text, '')
    )
    ON CONFLICT (id) DO UPDATE SET
      nome = EXCLUDED.nome,
      obra_id = EXCLUDED.obra_id,
      unidade = EXCLUDED.unidade,
      quantidade = EXCLUDED.quantidade,
      valor_unitario = EXCLUDED.valor_unitario;
  END IF;

  -- UPDATE mudando type=etapa pra outro -> remove de etapas_obra (se sem dependentes)
  IF TG_OP = 'UPDATE' AND OLD.type = 'etapa' AND NEW.type IS DISTINCT FROM 'etapa' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.saidas_combustivel WHERE etapa_id = OLD.id
      UNION ALL
      SELECT 1 FROM public.apontamentos WHERE etapa_obra_id = OLD.id
      UNION ALL
      SELECT 1 FROM public.registros_horas_diaristas WHERE etapa_id = OLD.id
      UNION ALL
      SELECT 1 FROM public.financeiro_rateios WHERE etapa_obra_id = OLD.id
    ) THEN
      DELETE FROM public.etapas_obra WHERE id = OLD.id;
    END IF;
    -- Se há dependentes: deixa em etapas_obra (FK preservada).
  END IF;

  -- DELETE de etapa -> remove de etapas_obra (se sem dependentes)
  IF TG_OP = 'DELETE' AND OLD.type = 'etapa' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.saidas_combustivel WHERE etapa_id = OLD.id
      UNION ALL
      SELECT 1 FROM public.apontamentos WHERE etapa_obra_id = OLD.id
      UNION ALL
      SELECT 1 FROM public.registros_horas_diaristas WHERE etapa_id = OLD.id
      UNION ALL
      SELECT 1 FROM public.financeiro_rateios WHERE etapa_obra_id = OLD.id
    ) THEN
      DELETE FROM public.etapas_obra WHERE id = OLD.id;
    END IF;
    -- Se há dependentes: mantém em etapas_obra (FK preservada mesmo que
    -- tenha sumido do source). User precisa deletar manualmente após
    -- limpar dependências.
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Parte C — Trigger
DROP TRIGGER IF EXISTS trg_sync_etapas_obra_from_contract_item ON public.rodotracker_contract_items;
CREATE TRIGGER trg_sync_etapas_obra_from_contract_item
  AFTER INSERT OR UPDATE OR DELETE ON public.rodotracker_contract_items
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_etapas_obra_from_contract_item();
