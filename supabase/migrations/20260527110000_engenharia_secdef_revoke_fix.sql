-- Engenharia — Onda 2.2 (sec): revogar EXECUTE em funções SECDEF para mitigar
-- WARN "Public/Signed-In Can Execute SECURITY DEFINER Function" do advisor.
--
-- Justificativa:
--   - 3 trigger functions (after_insert/after_update/before_delete em obras):
--     NUNCA devem ser chamadas via REST RPC — só pelos triggers. Revoga
--     EXECUTE de anon, authenticated, public.
--   - 2 lock functions (acquire/release): devem ser chamadas APENAS por
--     usuário autenticado. Revoga de anon e public; mantém GRANT TO
--     authenticated (criado na migration 20260526180000).
--
-- Rollback: 20260527110100_engenharia_secdef_revoke_rollback.sql.

begin;

-- Triggers — bloqueia chamadas RPC de qualquer role.
revoke execute on function public.engenharia_after_insert_obra()      from anon, authenticated, public;
revoke execute on function public.engenharia_after_update_obra_nome() from anon, authenticated, public;
revoke execute on function public.engenharia_before_delete_obra()     from anon, authenticated, public;

-- Locks — só anon e public. Authenticated continua tendo (GRANT prévio).
revoke execute on function public.engenharia_acquire_lock(text, uuid, int) from anon, public;
revoke execute on function public.engenharia_release_lock(text, uuid)      from anon, public;

commit;
