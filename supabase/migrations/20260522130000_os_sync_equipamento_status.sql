-- Frota/Manut audit #1 — Sincroniza equipamentos.status com OS.status
-- Quando OS entra em em_execucao pela 1a vez: equipamento -> manutencao_*.
-- Quando OS conclui/cancela/e soft-deletada vindo de em_execucao: volta para ativa.
-- Mapeamento OS.tipo -> equipamentos.status:
--   preventiva, preditiva -> manutencao_preventiva
--   corretiva, melhoria, garantia, recall -> manutencao_corretiva
-- Audit em historico_status_equipamento com os_id preenchido.
-- Idempotente. Trata OSs paralelas. Tratamento de fora_funcionamento: sobrescreve.

begin;

create or replace function public.tg_os_sync_equipamento_status()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_equip_status_atual text;
  v_novo_status_equip  text;
  v_motivo             text;
  v_hist_id            text;
  v_outras_em_exec     integer;
  v_acao               text;   -- 'IDA' | 'VOLTA'
begin
  -- Decide ramo a executar
  if old.status is distinct from 'em_execucao'
     and new.status = 'em_execucao'
     and new.deleted_at is null then
    v_acao := 'IDA';

  elsif old.status = 'em_execucao'
        and new.status in ('concluida', 'cancelada')
        and new.deleted_at is null then
    v_acao := 'VOLTA';

  elsif old.deleted_at is null
        and new.deleted_at is not null
        and old.status = 'em_execucao' then
    v_acao := 'VOLTA';

  else
    return new;
  end if;

  -- Le status atual do equipamento (idempotencia + audit)
  select status into v_equip_status_atual
    from public.equipamentos
   where id = new.equipamento_id;

  if v_equip_status_atual is null then
    return new;  -- defensivo: equipamento orfao
  end if;

  -- IDA
  if v_acao = 'IDA' then
    v_novo_status_equip := case
      when new.tipo in ('preventiva', 'preditiva') then 'manutencao_preventiva'
      else 'manutencao_corretiva'
    end;

    if v_equip_status_atual = v_novo_status_equip then
      return new;  -- ja esta no destino, no-op
    end if;

    update public.equipamentos
       set status     = v_novo_status_equip,
           ativo      = false,
           updated_at = now()
     where id = new.equipamento_id;

    v_motivo := 'OS ' || coalesce(new.numero, new.id) || ' iniciou execucao';

  -- VOLTA (concluida, cancelada, soft-delete)
  else
    select count(*) into v_outras_em_exec
      from public.ordens_servico
     where equipamento_id = new.equipamento_id
       and id <> new.id
       and status = 'em_execucao'
       and deleted_at is null;

    if v_outras_em_exec > 0 then
      return new;  -- outra OS mantem em manutencao
    end if;

    if v_equip_status_atual = 'ativa' then
      return new;  -- ja esta ativa, no-op
    end if;

    update public.equipamentos
       set status     = 'ativa',
           ativo      = true,
           updated_at = now()
     where id = new.equipamento_id;

    v_motivo := 'OS ' || coalesce(new.numero, new.id) || ' ' || case
      when new.deleted_at is not null then 'excluida'
      when new.status = 'concluida' then 'concluida'
      else 'cancelada'
    end;
  end if;

  -- Audit em historico_status_equipamento
  v_hist_id := 'hist-os-' || new.id || '-' ||
               replace(extract(epoch from clock_timestamp())::numeric(20,6)::text, '.', '');

  insert into public.historico_status_equipamento
    (id, equipamento_id, status_de, status_para, motivo, os_id, created_by)
  values
    (v_hist_id, new.equipamento_id, v_equip_status_atual,
     case when v_acao = 'IDA' then v_novo_status_equip else 'ativa' end,
     v_motivo, new.id, coalesce(new.updated_by, new.created_by))
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_os_sync_equipamento_status_upd on public.ordens_servico;
create trigger trg_os_sync_equipamento_status_upd
  after update of status, deleted_at on public.ordens_servico
  for each row
  execute function public.tg_os_sync_equipamento_status();

comment on function public.tg_os_sync_equipamento_status() is
  'Frota/Manut audit #1: sincroniza equipamentos.status com OS.status. '
  'IDA quando OS entra em em_execucao pela 1a vez; VOLTA quando conclui/cancela/e '
  'soft-deletada vindo de em_execucao. Mapeamento preventiva/preditiva -> '
  'manutencao_preventiva; resto -> manutencao_corretiva. Idempotente, trata OSs '
  'paralelas. SECURITY DEFINER + search_path setado para sobreviver a tighten de '
  'RLS (Frota/Manut audit #3).';

commit;
