-- Audit Fase 7.3 #9: status='inativo' não filtra em RLS — só no login()
--
-- Antes desta migration, um usuário com status='inativo' continuava autorizado
-- a INSERT/UPDATE/DELETE via REST direto se o JWT/refresh estivesse vivo.
-- Agora private.current_has_action() e current_funcionario_id() exigem ativo.
--
-- Trade-off: se o usuário for desativado, todas as policies passam a negar até
-- o JWT expirar e ele tentar refazer login (que já bloqueia em AuthContext).

CREATE OR REPLACE FUNCTION private.current_funcionario_id()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT id FROM public.funcionarios
  WHERE auth_user_id = auth.uid()
    AND COALESCE(status, 'ativo') = 'ativo'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION private.current_has_action(p_action text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1 FROM public.funcionarios
      WHERE auth_user_id = auth.uid()
        AND COALESCE(status, 'ativo') = 'ativo'
        AND (cargo = 'Administrador' OR p_action = ANY(acoes_permitidas))
    ),
    false
  );
$$;
