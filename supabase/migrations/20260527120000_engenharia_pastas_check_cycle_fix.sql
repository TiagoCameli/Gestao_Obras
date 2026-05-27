-- Engenharia — Onda 3.1: trigger BEFORE UPDATE bloqueia ciclos em engenharia_pastas.
-- Sem isso, um direct UPDATE via REST poderia criar P1 → P2 → P1 (ciclo permanente).
-- Rollback: 20260527120100_engenharia_pastas_check_cycle_rollback.sql.

begin;

create or replace function public.engenharia_pastas_check_no_cycle()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_has_cycle boolean;
begin
  -- Caso trivial: virou pasta raiz (parent_id NULL). Sem ciclo possível.
  if new.parent_id is null then
    return new;
  end if;

  -- Caso obvio: pasta sendo pai dela mesma.
  if new.parent_id = new.id then
    raise exception 'Pasta % nao pode ser pai dela mesma', new.id;
  end if;

  -- Recursão: verifica se new.parent_id está em qualquer descendente de new.id.
  with recursive descendentes(id) as (
    select new.id
    union all
    select ep.id
      from public.engenharia_pastas ep
      join descendentes d on ep.parent_id = d.id
     where ep.deleted_at is null
  )
  select exists (select 1 from descendentes where id = new.parent_id) into v_has_cycle;

  if v_has_cycle then
    raise exception 'Mover pasta % sob % cria ciclo na hierarquia', new.id, new.parent_id;
  end if;

  return new;
end $$;

drop trigger if exists trg_engenharia_pastas_check_no_cycle on public.engenharia_pastas;
create trigger trg_engenharia_pastas_check_no_cycle
  before update of parent_id on public.engenharia_pastas
  for each row
  when (new.parent_id is distinct from old.parent_id)
  execute function public.engenharia_pastas_check_no_cycle();

-- Revoga EXECUTE pra não aparecer no /rest/v1/rpc.
revoke execute on function public.engenharia_pastas_check_no_cycle() from anon, authenticated, public;

commit;
