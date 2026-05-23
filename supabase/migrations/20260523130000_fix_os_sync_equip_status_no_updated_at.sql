-- Fix do bug em 20260522130000_os_sync_equipamento_status.sql
-- A funcao original fazia "update equipamentos set status=..., updated_at = now()"
-- mas a tabela equipamentos NAO possui coluna updated_at (so created_at tambem
-- nao existe). Isso fazia o trigger trg_os_sync_equipamento_status_upd falhar
-- com erro 42703 em TODO UPDATE de OS que disparasse IDA ou VOLTA,
-- quebrando operacionalmente qualquer transicao de status.
--
-- Este fix re-cria a funcao SEM as duas referencias a updated_at = now().
-- Trigger nao precisa ser recriado (a definicao continua valida).

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
  v_outras_ativas      integer;
  v_acao               text;   -- 'IDA' ou 'VOLTA'
begin
  -- Decide ramo a executar
  -- IDA: OS entra em em_execucao pela 1a vez (sem ja estar soft-deletada)
  if old.status is distinct from 'em_execucao'
     and new.status = 'em_execucao'
     and new.deleted_at is null then
    v_acao := 'IDA';

  -- VOLTA: OS sai de em_execucao OU aguardando_aprovacao para concluida/cancelada
  -- (fluxo padrao: em_execucao -> aguardando_aprovacao -> concluida)
  elsif old.status in ('em_execucao', 'aguardando_aprovacao')
        and new.status in ('concluida', 'cancelada')
        and new.deleted_at is null then
    v_acao := 'VOLTA';

  -- VOLTA por soft-delete: OS estava em em_execucao ou aguardando_aprovacao
  elsif old.deleted_at is null
        and new.deleted_at is not null
        and old.status in ('em_execucao', 'aguardando_aprovacao') then
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

    -- IMPORTANTE: NAO tocar em equipamentos.ativo. Invariante do projeto
    -- (migration 20260503210000): ativo = (status != 'fora_funcionamento').
    -- equipamentos nao possui coluna updated_at/created_at neste schema.
    update public.equipamentos
       set status = v_novo_status_equip
     where id = new.equipamento_id;

    v_motivo := 'OS ' || coalesce(new.numero, new.id) || ' iniciou execucao';

  -- VOLTA (concluida, cancelada, soft-delete)
  else
    -- Outra OS ativa (em_execucao ou aguardando_aprovacao) mantem em manutencao
    select count(*) into v_outras_ativas
      from public.ordens_servico
     where equipamento_id = new.equipamento_id
       and id <> new.id
       and status in ('em_execucao', 'aguardando_aprovacao')
       and deleted_at is null;

    if v_outras_ativas > 0 then
      return new;
    end if;

    if v_equip_status_atual = 'ativa' then
      return new;  -- ja esta ativa, no-op
    end if;

    update public.equipamentos
       set status = 'ativa'
     where id = new.equipamento_id;

    v_motivo := 'OS ' || coalesce(new.numero, new.id) || ' ' || case
      when new.deleted_at is not null then 'excluida'
      when new.status = 'concluida' then 'concluida'
      else 'cancelada'
    end;
  end if;

  -- Audit em historico_status_equipamento (so quando ha mudanca efetiva)
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

comment on function public.tg_os_sync_equipamento_status() is
  'Frota/Manut audit #1: sincroniza equipamentos.status com OS.status. '
  'IDA quando OS entra em em_execucao pela 1a vez; VOLTA quando sai de '
  'em_execucao/aguardando_aprovacao para concluida/cancelada (ou soft-delete). '
  'Mapeamento preventiva/preditiva -> manutencao_preventiva; resto -> '
  'manutencao_corretiva. NAO toca em equipamentos.ativo (invariante do projeto). '
  'NAO usa updated_at (coluna nao existe em equipamentos). Idempotente, '
  'trata OSs paralelas. SECURITY DEFINER + search_path setado para sobreviver '
  'a tighten de RLS (Frota/Manut audit #3).';

commit;
