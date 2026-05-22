-- Audit Fase 3.4 #5: revoga EXECUTE de `anon` em SECURITY DEFINER que vazam
--
-- 8 funções SECDEF estavam callable por anon sem JWT. Algumas são
-- intencionais (login flow, cotação pública), outras não:
--   - clear_login_attempts(text)               🚨 atacante zera lockout de qualquer email
--   - calcular_combustivel_tanque_na_data(...) 🚨 vaza dados de combustível
--   - calcular_preco_medio_tanque_na_data(...) 🚨 idem
--   - fn_saidas_combustivel_movimentos(...)    🚨 trigger fn exposta como RPC
--
-- Mantemos anon-callable: is_login_locked, register_failed_login,
-- get_cotacao_publica, responder_cotacao.

REVOKE EXECUTE ON FUNCTION public.clear_login_attempts(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.calcular_combustivel_tanque_na_data(text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.calcular_preco_medio_tanque_na_data(text, text) FROM anon, public;

-- fn_saidas_combustivel_movimentos é trigger fn — REVOKE quebra o trigger?
-- Não: triggers rodam com privilégios do owner via SECURITY DEFINER, não pelo
-- caller. REVOKE EXECUTE só fecha a porta /rest/v1/rpc/.
REVOKE EXECUTE ON FUNCTION public.fn_saidas_combustivel_movimentos() FROM anon, public;

-- Garantia: authenticated continua chamando o que precisa (cálculo de saldo).
GRANT EXECUTE ON FUNCTION public.calcular_combustivel_tanque_na_data(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calcular_preco_medio_tanque_na_data(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_login_attempts(text) TO authenticated;
