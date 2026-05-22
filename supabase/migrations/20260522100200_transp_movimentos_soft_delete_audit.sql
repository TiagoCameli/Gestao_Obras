-- Audit Frete (Item #6 do frete-audit.md): transportadora_movimentos passa
-- a suportar soft-delete + auditoria.
--
-- Antes:
--   - Hard-delete via TransportadoraExtratoModal.tsx (window.confirm) →
--     ajustes manuais sumiam sem rastro
--   - UPDATE de valor por admin sem trilha
--   - created_by aparecia NULL nos últimos 11 registros (não populado)
--
-- Depois:
--   - Colunas deleted_at, deleted_by adicionadas
--   - BEFORE DELETE trigger converte hard-delete em soft-delete
--     (DELETE da app vira UPDATE deleted_at = now())
--   - BEFORE INSERT trigger popula created_by se vier NULL
--   - AFTER INSERT/UPDATE/DELETE trigger registra em audit_log
--
-- IMPORTANTE para a aplicação:
-- A app continua chamando .delete() do supabase-js — o trigger converte em
-- UPDATE. PostgREST retorna 204 (success) mesmo com 0 rows deletadas, então
-- a UI continua funcionando. Para REALMENTE remover (purgar) um row já
-- soft-deletado, é necessário um DELETE explícito sobre row com
-- deleted_at IS NOT NULL (segundo DELETE passa direto).
--
-- View transportadora_saldos será atualizada na migration seguinte
-- (20260522100300) pra filtrar deleted_at.
--
-- Idempotente.

-- ============================================================================
-- 1. Colunas de soft-delete
-- ============================================================================

ALTER TABLE public.transportadora_movimentos
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by text;

CREATE INDEX IF NOT EXISTS transportadora_movimentos_deleted_at_idx
  ON public.transportadora_movimentos (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- 2. BEFORE INSERT trigger — popula created_by automaticamente
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_transp_movimentos_populate_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.created_by IS NULL OR NEW.created_by = '' THEN
    NEW.created_by := COALESCE(private.current_funcionario_id(), 'system');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transp_movimentos_populate_created_by ON public.transportadora_movimentos;
CREATE TRIGGER trg_transp_movimentos_populate_created_by
  BEFORE INSERT ON public.transportadora_movimentos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_transp_movimentos_populate_created_by();

-- ============================================================================
-- 3. BEFORE DELETE trigger — converte DELETE em soft-delete
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_transp_movimentos_soft_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Se já foi soft-deletado anteriormente, deixa o DELETE seguir
  -- (esse é o caminho de purga real, intencional)
  IF OLD.deleted_at IS NOT NULL THEN
    RETURN OLD;
  END IF;

  -- Senão: converte em UPDATE soft-delete
  UPDATE public.transportadora_movimentos
  SET deleted_at = now(),
      deleted_by = COALESCE(private.current_funcionario_id(), 'system')
  WHERE id = OLD.id;

  RETURN NULL; -- cancela o DELETE original
END;
$$;

DROP TRIGGER IF EXISTS trg_transp_movimentos_soft_delete ON public.transportadora_movimentos;
CREATE TRIGGER trg_transp_movimentos_soft_delete
  BEFORE DELETE ON public.transportadora_movimentos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_transp_movimentos_soft_delete();

-- ============================================================================
-- 4. AFTER INSERT/UPDATE/DELETE trigger — audit log
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_audit_transp_movimentos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_funcionario_id text;
  v_tipo text;
  v_alvo_id text;
  v_detalhes text;
BEGIN
  v_funcionario_id := COALESCE(private.current_funcionario_id(), 'system');

  IF TG_OP = 'INSERT' THEN
    v_tipo := 'transportadora_movimentos.insert';
    v_alvo_id := NEW.id;
    v_detalhes := jsonb_build_object(
      'transportadora_id', NEW.transportadora_id,
      'tipo', NEW.tipo,
      'valor', NEW.valor,
      'origem_tabela', NEW.origem_tabela,
      'origem_id', NEW.origem_id,
      'data', NEW.data,
      'descricao', NEW.descricao
    )::text;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Diferencia soft-delete / restore / update normal
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      v_tipo := 'transportadora_movimentos.soft_delete';
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      v_tipo := 'transportadora_movimentos.restore';
    ELSE
      v_tipo := 'transportadora_movimentos.update';
    END IF;
    v_alvo_id := NEW.id;
    v_detalhes := jsonb_build_object(
      'transportadora_id', NEW.transportadora_id,
      'tipo', NEW.tipo,
      'valor_antes', OLD.valor,
      'valor_depois', NEW.valor,
      'origem_tabela', NEW.origem_tabela,
      'origem_id', NEW.origem_id
    )::text;
  ELSIF TG_OP = 'DELETE' THEN
    -- Só chega aqui via purga real (OLD.deleted_at já era NOT NULL)
    v_tipo := 'transportadora_movimentos.hard_delete';
    v_alvo_id := OLD.id;
    v_detalhes := jsonb_build_object(
      'transportadora_id', OLD.transportadora_id,
      'tipo', OLD.tipo,
      'valor', OLD.valor,
      'origem_tabela', OLD.origem_tabela,
      'origem_id', OLD.origem_id,
      'previamente_soft_deleted_em', OLD.deleted_at
    )::text;
  END IF;

  INSERT INTO public.audit_log (id, tipo, funcionario_id, alvo_id, detalhes, data_hora)
  VALUES (public.fn_gerar_id_text(), v_tipo, v_funcionario_id, v_alvo_id, v_detalhes, now());

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_transp_movimentos ON public.transportadora_movimentos;
CREATE TRIGGER trg_audit_transp_movimentos
  AFTER INSERT OR UPDATE OR DELETE ON public.transportadora_movimentos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_audit_transp_movimentos();

-- ============================================================================
-- 5. Backfill created_by NULL → 'system' (registros pré-trigger)
-- ============================================================================

UPDATE public.transportadora_movimentos
SET created_by = 'system'
WHERE created_by IS NULL;
