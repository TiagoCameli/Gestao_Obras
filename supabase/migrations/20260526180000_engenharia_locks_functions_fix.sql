-- Engenharia — Onda 1.4: funções SECDEF para lock pessimista
-- (D-4 revisada 2026-05-26 — sem CRDT, sem Yjs).
--
-- Spec: docs/superpowers/plans/2026-05-26-engenharia-modulo.md (seção 4 — engenharia_locks).
-- Rollback: 20260526180100_engenharia_locks_functions_rollback.sql.

begin;

-- acquire_lock: tenta adquirir ou renovar lock. Retorna estado atual.
create or replace function public.engenharia_acquire_lock(
  p_recurso_tipo text,
  p_recurso_id uuid,
  p_ttl_segundos int default 300
)
returns table (
  adquirido boolean,
  dono_usuario_id uuid,
  expira_em timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  -- Gate: usuário precisa de permissão para editar o tipo de recurso
  if p_recurso_tipo = 'nota' and not private.current_has_action('editar_engenharia_nota') then
    raise exception 'sem permissao para acquire lock em nota';
  end if;
  if p_recurso_tipo = 'calculo' and not private.current_has_action('editar_engenharia_calculo') then
    raise exception 'sem permissao para acquire lock em calculo';
  end if;

  -- Garbage-collect locks expirados desse recurso (não bloqueia ninguém)
  delete from public.engenharia_locks
   where recurso_tipo = p_recurso_tipo
     and recurso_id   = p_recurso_id
     and engenharia_locks.expira_em <= now();

  -- Tenta inserir; se já existe lock ATIVO (constraint unique),
  -- só renova SE for do próprio usuário.
  insert into public.engenharia_locks (recurso_tipo, recurso_id, usuario_id, expira_em)
  values (p_recurso_tipo, p_recurso_id, v_user, now() + make_interval(secs => p_ttl_segundos))
  on conflict (recurso_tipo, recurso_id) do update
    set expira_em = excluded.expira_em
   where engenharia_locks.usuario_id = v_user;

  -- Retorna estado pós-tentativa
  return query
    select (l.usuario_id = v_user) as adquirido,
           l.usuario_id,
           l.expira_em
      from public.engenharia_locks l
     where l.recurso_tipo = p_recurso_tipo
       and l.recurso_id = p_recurso_id;
end $$;

-- release_lock: libera APENAS o lock próprio (ou admin via DELETE direto na tabela)
create or replace function public.engenharia_release_lock(
  p_recurso_tipo text,
  p_recurso_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.engenharia_locks
   where recurso_tipo = p_recurso_tipo
     and recurso_id   = p_recurso_id
     and usuario_id   = auth.uid();
end $$;

-- Permissões: ambas precisam ser EXECUTE pelo role authenticated
grant execute on function public.engenharia_acquire_lock(text, uuid, int) to authenticated;
grant execute on function public.engenharia_release_lock(text, uuid)      to authenticated;

comment on function public.engenharia_acquire_lock(text, uuid, int)
  is 'Engenharia: adquire ou renova lock pessimista (TTL default 300s). Retorna (adquirido, dono, expira_em). SECDEF.';
comment on function public.engenharia_release_lock(text, uuid)
  is 'Engenharia: libera o lock do auth.uid() atual. No-op se outro usuario detem. SECDEF.';

commit;
