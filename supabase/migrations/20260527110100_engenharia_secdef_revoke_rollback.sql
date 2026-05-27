-- Rollback de 20260527110000_engenharia_secdef_revoke_fix.sql
-- Restaura EXECUTE para os roles default (anon, authenticated, public).

begin;

grant execute on function public.engenharia_after_insert_obra()      to anon, authenticated, public;
grant execute on function public.engenharia_after_update_obra_nome() to anon, authenticated, public;
grant execute on function public.engenharia_before_delete_obra()     to anon, authenticated, public;

grant execute on function public.engenharia_acquire_lock(text, uuid, int) to anon, public;
grant execute on function public.engenharia_release_lock(text, uuid)      to anon, public;

commit;
