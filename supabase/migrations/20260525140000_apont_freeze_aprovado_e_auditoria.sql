-- Congela edição de dia aprovado + popula apont_auditoria via triggers.
--
-- Fix #4 (congelar aprovado) e #16 (audit log) do apontamento-rh-audit.md.
-- Os dois fixes compartilham infra (triggers nas mesmas tabelas).
--
-- Comportamento:
--   * BEFORE UPDATE/DELETE em apont_registros_ponto e apont_apontamentos_servico
--     dispara `fn_apont_freeze_aprovado` — RAISE EXCEPTION 'P0F01' se existe
--     linha em apont_aprovacao_funcionario_dia pra (funcionario_id, data).
--     Bypass via `pg_trigger_depth() > 1` pra permitir cascade legítima do
--     `fn_apont_escalar_apontamentos_para_ponto` (já existente).
--
--   * INSERT segue permitido — não bloqueia CriarBatidaModal (AprovacaoTab).
--     A criação retroativa fica auditada normalmente.
--
--   * AFTER INSERT/UPDATE/DELETE em apont_registros_ponto, apont_apontamentos_servico
--     e apont_aprovacao_funcionario_dia dispara `fn_apont_audit_change` — INSERT em
--     apont_auditoria com auth.uid(), TG_OP, OLD, NEW. ip/dispositivo NULL por ora.
--
-- Pra editar dado aprovado: usuário com `reverter_aprovacao_rh` DELETA a aprovação
-- (logado), edita batida/serviço (logado), reaprova (logado). 3 eventos no log.
--
-- Rollback: 20260525140100_rollback_apont_freeze_aprovado_e_auditoria.sql.

-- ============================================================================
-- Função 1: freeze após aprovação
-- ============================================================================
CREATE OR REPLACE FUNCTION private.fn_apont_freeze_aprovado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_func_id uuid := OLD.funcionario_id;
  v_data    date := OLD.data;
BEGIN
  -- Bypass quando estamos dentro de outra trigger (ex.: cascade do
  -- fn_apont_escalar_apontamentos_para_ponto). Edição direta pelo usuário
  -- sempre tem depth=1.
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.apont_aprovacao_funcionario_dia
     WHERE funcionario_id = v_func_id
       AND data = v_data
  ) THEN
    RAISE EXCEPTION
      'Dia % do funcionário % já aprovado — reverta a aprovação antes de editar/excluir',
      v_data, v_func_id
      USING ERRCODE = 'P0F01';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION private.fn_apont_freeze_aprovado() IS
  'Bloqueia UPDATE/DELETE em linhas cujo (funcionario_id, data) tem aprovação em apont_aprovacao_funcionario_dia. Bypass via pg_trigger_depth>1 pra cascades internas.';

-- ============================================================================
-- Função 2: audit log genérico
-- ============================================================================
CREATE OR REPLACE FUNCTION private.fn_apont_audit_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entidade    text := TG_TABLE_NAME;
  v_acao        text := lower(TG_OP);
  v_entidade_id text;
  v_anterior    jsonb;
  v_novo        jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_novo := to_jsonb(NEW);
    v_anterior := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_novo := to_jsonb(NEW);
    v_anterior := to_jsonb(OLD);
  ELSE -- DELETE
    v_novo := NULL;
    v_anterior := to_jsonb(OLD);
  END IF;

  -- Chave de identificação: usa `id` se existir, senão compõe (funcionario_id|data)
  v_entidade_id := COALESCE(
    (COALESCE(v_novo, v_anterior))->>'id',
    ((COALESCE(v_novo, v_anterior))->>'funcionario_id')
      || '|' || ((COALESCE(v_novo, v_anterior))->>'data')
  );

  INSERT INTO public.apont_auditoria
    (usuario_id, acao, entidade, entidade_id, valor_anterior, valor_novo)
  VALUES
    (auth.uid(), v_acao, v_entidade, v_entidade_id, v_anterior, v_novo);

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION private.fn_apont_audit_change() IS
  'Insere em apont_auditoria pra cada INSERT/UPDATE/DELETE nas tabelas trigadas. Usa auth.uid() do invoker, OLD/NEW como jsonb.';

-- ============================================================================
-- Triggers — apont_registros_ponto
-- ============================================================================
DROP TRIGGER IF EXISTS apont_rp_freeze_aprovado ON public.apont_registros_ponto;
CREATE TRIGGER apont_rp_freeze_aprovado
  BEFORE UPDATE OR DELETE ON public.apont_registros_ponto
  FOR EACH ROW EXECUTE FUNCTION private.fn_apont_freeze_aprovado();

DROP TRIGGER IF EXISTS apont_rp_audit ON public.apont_registros_ponto;
CREATE TRIGGER apont_rp_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.apont_registros_ponto
  FOR EACH ROW EXECUTE FUNCTION private.fn_apont_audit_change();

-- ============================================================================
-- Triggers — apont_apontamentos_servico
-- ============================================================================
DROP TRIGGER IF EXISTS apont_aps_freeze_aprovado ON public.apont_apontamentos_servico;
CREATE TRIGGER apont_aps_freeze_aprovado
  BEFORE UPDATE OR DELETE ON public.apont_apontamentos_servico
  FOR EACH ROW EXECUTE FUNCTION private.fn_apont_freeze_aprovado();

DROP TRIGGER IF EXISTS apont_aps_audit ON public.apont_apontamentos_servico;
CREATE TRIGGER apont_aps_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.apont_apontamentos_servico
  FOR EACH ROW EXECUTE FUNCTION private.fn_apont_audit_change();

-- ============================================================================
-- Triggers — apont_aprovacao_funcionario_dia (só audit, sem freeze)
-- ============================================================================
DROP TRIGGER IF EXISTS apont_afd_audit ON public.apont_aprovacao_funcionario_dia;
CREATE TRIGGER apont_afd_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.apont_aprovacao_funcionario_dia
  FOR EACH ROW EXECUTE FUNCTION private.fn_apont_audit_change();
