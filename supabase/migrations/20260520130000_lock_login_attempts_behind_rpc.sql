-- Audit Bloco 1.3: login_attempts atrás de RPCs SECURITY DEFINER
--
-- Antes: tabela aberta para anon (FOR ALL TO anon USING (true)). Atacante
--        podia DELETE pra zerar contador entre tentativas, ou ler pra
--        enumerar contas bloqueadas.
-- Depois: 0 policies (sem acesso direto). 3 RPCs SECURITY DEFINER:
--         - is_login_locked(email) -> bool (anon-callable, antes do signin)
--         - register_failed_login(email) -> {tentativas, restantes, bloqueado_ate} (anon-callable, após falha)
--         - clear_login_attempts(email) -> void (authenticated-only, após sucesso)
--
-- AuthContext.tsx atualizado pra usar as RPCs em vez de .from('login_attempts').

DROP POLICY IF EXISTS "Anon access login_attempts" ON public.login_attempts;
DROP POLICY IF EXISTS "Authenticated full access" ON public.login_attempts;

CREATE OR REPLACE FUNCTION public.is_login_locked(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_bloqueado_ate bigint;
  v_now bigint;
BEGIN
  IF p_email IS NULL OR length(p_email) > 254 THEN
    RETURN jsonb_build_object('locked', false);
  END IF;
  v_now := (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
  SELECT bloqueado_ate INTO v_bloqueado_ate
    FROM public.login_attempts
    WHERE email = lower(p_email)
    LIMIT 1;
  IF v_bloqueado_ate IS NOT NULL AND v_bloqueado_ate > v_now THEN
    RETURN jsonb_build_object('locked', true, 'bloqueado_ate', v_bloqueado_ate);
  END IF;
  RETURN jsonb_build_object('locked', false);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.register_failed_login(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_tentativas integer;
  v_now bigint;
  v_bloqueado_ate bigint;
  v_existing_tentativas integer;
  c_max_tentativas constant integer := 5;
  c_bloqueio_ms constant bigint := 5 * 60 * 1000;
BEGIN
  IF p_email IS NULL OR length(p_email) > 254 THEN
    RETURN jsonb_build_object('error', 'invalid_email');
  END IF;
  v_now := (EXTRACT(EPOCH FROM now()) * 1000)::bigint;
  SELECT tentativas INTO v_existing_tentativas
    FROM public.login_attempts
    WHERE email = lower(p_email);
  v_tentativas := COALESCE(v_existing_tentativas, 0) + 1;
  v_bloqueado_ate := CASE WHEN v_tentativas >= c_max_tentativas THEN v_now + c_bloqueio_ms ELSE 0 END;
  INSERT INTO public.login_attempts (email, tentativas, ultima_tentativa, bloqueado_ate)
  VALUES (lower(p_email), v_tentativas, v_now, v_bloqueado_ate)
  ON CONFLICT (email)
  DO UPDATE SET
    tentativas = EXCLUDED.tentativas,
    ultima_tentativa = EXCLUDED.ultima_tentativa,
    bloqueado_ate = EXCLUDED.bloqueado_ate;
  RETURN jsonb_build_object(
    'tentativas', v_tentativas,
    'restantes', GREATEST(c_max_tentativas - v_tentativas, 0),
    'bloqueado_ate', v_bloqueado_ate
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.clear_login_attempts(p_email text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  DELETE FROM public.login_attempts WHERE email = lower(p_email);
$fn$;

REVOKE ALL ON FUNCTION public.is_login_locked(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_failed_login(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_login_attempts(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_login_locked(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_failed_login(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_login_attempts(text) TO authenticated;
