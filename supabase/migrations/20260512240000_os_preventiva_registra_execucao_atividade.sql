-- PR17 (Marco 3): quando uma OS preventiva originada de plano_preventivo
-- é concluida, registra automaticamente em execucoes_atividade. Isso "zera"
-- o ciclo da atividade na view v_proximas_preventivas, fazendo a proxima
-- vencer apenas depois da nova periodicidade.

create or replace function public.registra_execucao_atividade_em_conclusao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  exec_id text;
begin
  -- Dispara apenas se OS preventiva originada de plano com atividade vinculada
  if new.origem <> 'plano_preventivo' then return new; end if;
  if new.atividade_id is null then return new; end if;
  -- Apenas na transição para concluida
  if new.status <> 'concluida' then return new; end if;
  if old.status = 'concluida' then return new; end if;

  exec_id := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || substr(md5(random()::text), 1, 6);

  insert into execucoes_atividade (
    id, equipamento_id, atividade_id, os_id,
    data_execucao, medicao_execucao, custo, observacoes,
    created_by
  ) values (
    exec_id,
    new.equipamento_id,
    new.atividade_id,
    new.id,
    coalesce(new.data_conclusao, now()),
    new.medicao_conclusao,
    coalesce(new.custo_total, 0),
    coalesce('OS ' || new.numero || ' (' || new.tipo || ')', ''),
    new.updated_by
  )
  -- Se por algum motivo já existe execução pra esta OS, ignora
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists trg_os_registra_execucao_atividade on public.ordens_servico;
create trigger trg_os_registra_execucao_atividade
  after update of status on public.ordens_servico
  for each row
  execute function public.registra_execucao_atividade_em_conclusao();

-- Unique constraint pra impedir 2 execucoes da mesma OS pra mesma atividade
-- (defensiva). Só cria se ainda nao existir.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'execucoes_atividade_os_unique'
  ) then
    alter table public.execucoes_atividade
      add constraint execucoes_atividade_os_unique unique (os_id, atividade_id);
  end if;
end$$;

comment on function public.registra_execucao_atividade_em_conclusao() is
  'PR17: dispara em update de status. Quando OS preventiva (origem=plano_preventivo + atividade_id) vai pra concluida, registra execucoes_atividade automaticamente.';
