-- Marco 2 / PR12 — Sincroniza custo_pecas e custo_mao_obra_propria na OS
-- quando os_pecas/os_mao_obra mudam.
--
-- custo_total da OS é generated column (pecas + servico_terceiro + mao_obra),
-- então basta atualizar os 2 agregados que o total se ajusta sozinho.
--
-- Trigger AFTER INSERT/UPDATE/DELETE em os_pecas → recalcula sum(custo_total)
--   pela própria peça e atualiza ordens_servico.custo_pecas
-- Idem pra os_mao_obra → custo_mao_obra_propria

begin;

create or replace function public.tg_sync_custo_pecas_os()
returns trigger
language plpgsql
as $$
declare
  v_os_id text;
  v_total numeric(14,2);
begin
  v_os_id := coalesce(NEW.os_id, OLD.os_id);
  select coalesce(sum(custo_total), 0) into v_total
    from public.os_pecas where os_id = v_os_id;
  update public.ordens_servico
    set custo_pecas = v_total,
        updated_at = now()
    where id = v_os_id;
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_sync_custo_pecas_ins on public.os_pecas;
create trigger trg_sync_custo_pecas_ins after insert on public.os_pecas
  for each row execute function public.tg_sync_custo_pecas_os();
drop trigger if exists trg_sync_custo_pecas_upd on public.os_pecas;
create trigger trg_sync_custo_pecas_upd after update on public.os_pecas
  for each row execute function public.tg_sync_custo_pecas_os();
drop trigger if exists trg_sync_custo_pecas_del on public.os_pecas;
create trigger trg_sync_custo_pecas_del after delete on public.os_pecas
  for each row execute function public.tg_sync_custo_pecas_os();

create or replace function public.tg_sync_custo_mao_obra_os()
returns trigger
language plpgsql
as $$
declare
  v_os_id text;
  v_total numeric(14,2);
begin
  v_os_id := coalesce(NEW.os_id, OLD.os_id);
  select coalesce(sum(custo_total), 0) into v_total
    from public.os_mao_obra where os_id = v_os_id;
  update public.ordens_servico
    set custo_mao_obra_propria = v_total,
        updated_at = now()
    where id = v_os_id;
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_sync_custo_mo_ins on public.os_mao_obra;
create trigger trg_sync_custo_mo_ins after insert on public.os_mao_obra
  for each row execute function public.tg_sync_custo_mao_obra_os();
drop trigger if exists trg_sync_custo_mo_upd on public.os_mao_obra;
create trigger trg_sync_custo_mo_upd after update on public.os_mao_obra
  for each row execute function public.tg_sync_custo_mao_obra_os();
drop trigger if exists trg_sync_custo_mo_del on public.os_mao_obra;
create trigger trg_sync_custo_mo_del after delete on public.os_mao_obra
  for each row execute function public.tg_sync_custo_mao_obra_os();

comment on function public.tg_sync_custo_pecas_os() is
  'Recalcula ordens_servico.custo_pecas como SUM(os_pecas.custo_total) sempre '
  'que uma peca e inserida/atualizada/deletada. custo_total da OS (generated) '
  'segue automaticamente.';

comment on function public.tg_sync_custo_mao_obra_os() is
  'Recalcula ordens_servico.custo_mao_obra_propria como SUM(os_mao_obra.custo_total).';

commit;
