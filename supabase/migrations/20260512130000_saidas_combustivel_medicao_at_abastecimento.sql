-- Marco 0 / PR2 — Permite registrar o horímetro/odômetro do equipamento
-- no momento do abastecimento e sincroniza automaticamente em medicoes_equipamento.
--
-- Por quê: o equipamento já está parado pra abastecer e o operador já tira foto.
-- Pedir o número do painel é praticamente custo zero e mantém a medição corrente
-- sempre atualizada sem precisar de campo manual em outras telas.
--
-- Como funciona:
--   1. Adicionamos 2 colunas em saidas_combustivel: medicao_no_abastecimento (valor)
--      e tipo_medicao_snapshot (horímetro/odômetro/km — congelado no momento da saída).
--   2. Trigger AFTER INSERT/UPDATE faz upsert em medicoes_equipamento com id
--      determinístico ('med-abast-' || saida.id) → idempotente.
--   3. Se a saída é editada e o campo é zerado, a leitura correspondente é
--      soft-deletada.
--   4. Soft delete da saída (deleted_at) propaga soft delete na medição.

begin;

alter table public.saidas_combustivel
  add column if not exists medicao_no_abastecimento numeric
    check (medicao_no_abastecimento is null or medicao_no_abastecimento >= 0);

alter table public.saidas_combustivel
  add column if not exists tipo_medicao_snapshot text
    check (tipo_medicao_snapshot is null or tipo_medicao_snapshot in ('horimetro','odometro','km'));

comment on column public.saidas_combustivel.medicao_no_abastecimento is
  'Leitura do horímetro/odômetro/km do equipamento no momento do abastecimento. '
  'Trigger sincroniza em medicoes_equipamento (origem=abastecimento).';

comment on column public.saidas_combustivel.tipo_medicao_snapshot is
  'Snapshot do tipo de medição quando a saída foi registrada (horimetro/odometro/km). '
  'Independente de mudanças posteriores em equipamentos.tipo_medicao.';

-- ──────────────────────────────────────────────────────────────────────
-- Função do trigger
-- ──────────────────────────────────────────────────────────────────────

create or replace function public.tg_saidas_combustivel_sync_medicao()
returns trigger
language plpgsql
as $$
declare
  med_id text;
begin
  med_id := 'med-abast-' || NEW.id;

  -- Saída soft-deletada → soft-delete da medição correspondente
  if NEW.deleted_at is not null then
    update public.medicoes_equipamento
      set deleted_at = NEW.deleted_at,
          deleted_by = NEW.deleted_by
      where id = med_id and deleted_at is null;
    return NEW;
  end if;

  -- Há leitura informada → upsert
  if NEW.medicao_no_abastecimento is not null
     and NEW.equipamento_id is not null
     and NEW.tipo_medicao_snapshot is not null then
    insert into public.medicoes_equipamento (
      id, equipamento_id, data, tipo_medicao, valor,
      origem, origem_id, observacoes, created_by, updated_by
    ) values (
      med_id,
      NEW.equipamento_id,
      NEW.data,
      NEW.tipo_medicao_snapshot,
      NEW.medicao_no_abastecimento,
      'abastecimento',
      NEW.id,
      '',
      NEW.created_by,
      NEW.updated_by
    )
    on conflict (id) do update set
      equipamento_id = excluded.equipamento_id,
      data = excluded.data,
      tipo_medicao = excluded.tipo_medicao,
      valor = excluded.valor,
      updated_at = now(),
      updated_by = excluded.updated_by,
      deleted_at = null,
      deleted_by = null;
  else
    -- Sem leitura (campo apagado em edição) → soft-delete a medição correspondente
    update public.medicoes_equipamento
      set deleted_at = now(),
          deleted_by = NEW.updated_by
      where id = med_id and deleted_at is null;
  end if;

  return NEW;
end;
$$;

comment on function public.tg_saidas_combustivel_sync_medicao is
  'Sincroniza medicoes_equipamento quando saidas_combustivel grava o '
  'horímetro/km do abastecimento. ID determinístico (''med-abast-'' || saida.id) '
  'garante idempotência: re-inserts ou re-execução de backfill são seguros.';

-- ──────────────────────────────────────────────────────────────────────
-- Triggers (AFTER INSERT e AFTER UPDATE)
-- ──────────────────────────────────────────────────────────────────────

drop trigger if exists trg_saidas_combustivel_sync_medicao_ins on public.saidas_combustivel;
create trigger trg_saidas_combustivel_sync_medicao_ins
  after insert on public.saidas_combustivel
  for each row
  execute function public.tg_saidas_combustivel_sync_medicao();

drop trigger if exists trg_saidas_combustivel_sync_medicao_upd on public.saidas_combustivel;
create trigger trg_saidas_combustivel_sync_medicao_upd
  after update on public.saidas_combustivel
  for each row
  when (
       OLD.medicao_no_abastecimento is distinct from NEW.medicao_no_abastecimento
    or OLD.tipo_medicao_snapshot is distinct from NEW.tipo_medicao_snapshot
    or OLD.equipamento_id is distinct from NEW.equipamento_id
    or OLD.data is distinct from NEW.data
    or OLD.deleted_at is distinct from NEW.deleted_at
  )
  execute function public.tg_saidas_combustivel_sync_medicao();

commit;
