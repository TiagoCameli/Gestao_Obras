-- Audit Fase 9.2 #2: privilege escalation via funcionarios.update()
--
-- A policy funcionarios_update_admin exige só editar_funcionarios. Qualquer um
-- com essa chave podia mudar cargo/acoes_permitidas/auth_user_id/status de
-- qualquer pessoa (inclusive a si mesmo) — escalation trivial.
--
-- Trigger BEFORE UPDATE bloqueia mudança nessas colunas sensíveis a menos que
-- o caller tenha 'gerenciar_permissoes'. Auto-edição dessas colunas é sempre
-- bloqueada (mesmo com gerenciar_permissoes), para forçar dois admins.

CREATE OR REPLACE FUNCTION private.guard_funcionarios_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_func_id text;
  v_has_gerencia boolean;
  v_cargo_changed boolean;
  v_acoes_changed boolean;
  v_auth_changed boolean;
  v_status_changed boolean;
BEGIN
  -- service_role e outros papéis sem JWT (ex: triggers em cascata) bypassam.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_cargo_changed  := COALESCE(OLD.cargo, '') IS DISTINCT FROM COALESCE(NEW.cargo, '');
  v_acoes_changed  := COALESCE(OLD.acoes_permitidas, ARRAY[]::text[])
                      IS DISTINCT FROM
                      COALESCE(NEW.acoes_permitidas, ARRAY[]::text[]);
  v_auth_changed   := COALESCE(OLD.auth_user_id::text, '') IS DISTINCT FROM COALESCE(NEW.auth_user_id::text, '');
  v_status_changed := COALESCE(OLD.status, '') IS DISTINCT FROM COALESCE(NEW.status, '');

  IF NOT (v_cargo_changed OR v_acoes_changed OR v_auth_changed OR v_status_changed) THEN
    RETURN NEW;
  END IF;

  v_caller_func_id := (SELECT id FROM public.funcionarios
                       WHERE auth_user_id = auth.uid()
                       LIMIT 1);
  v_has_gerencia := private.current_has_action('gerenciar_permissoes');

  -- Bloqueia auto-edição de qualquer coluna sensível, sempre.
  IF v_caller_func_id IS NOT NULL AND v_caller_func_id = NEW.id THEN
    IF v_cargo_changed OR v_acoes_changed OR v_auth_changed OR v_status_changed THEN
      RAISE EXCEPTION 'Auto-edição de cargo/acoes_permitidas/auth_user_id/status não é permitida (id=%, caller=%)',
        NEW.id, v_caller_func_id
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Para edição de terceiros, exige gerenciar_permissoes.
  IF NOT v_has_gerencia THEN
    RAISE EXCEPTION 'Falta permissão gerenciar_permissoes para alterar cargo/acoes_permitidas/auth_user_id/status'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_funcionarios_sensitive_columns() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_funcionarios_guard_sensitive ON public.funcionarios;
CREATE TRIGGER trg_funcionarios_guard_sensitive
  BEFORE UPDATE ON public.funcionarios
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_funcionarios_sensitive_columns();
