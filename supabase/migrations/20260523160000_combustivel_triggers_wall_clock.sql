-- =============================================================================
-- WC.3 + WC.4 — Triggers wall-clock + recreate sync_medicao_upd + drop dup
-- =============================================================================
-- WC.3a: anti-futuro trigger (24h grace) usando wall-clock BR.
--   Comparação: NEW.data > (now() AT TIME ZONE 'America/Sao_Paulo')::timestamp
--               + interval '24 hours'
--   (converte server's now() pra BR wall-clock, strip TZ, compara com
--    wall-clock inserido). Janela de 24h cobre device com fuso/hora errada
--    sem bloquear retroatividade.
--
-- WC.3b: recriar trigger trg_saidas_combustivel_sync_medicao_upd dropado por
--   CASCADE na 20260523150000 (alteração de tipo da coluna data: timestamptz
--   → timestamp). Função tg_saidas_combustivel_sync_medicao foi preservada;
--   só o trigger _upd precisa ser recriado. Definição idêntica à original
--   de 20260512130000_saidas_combustivel_medicao_at_abastecimento.sql.
--
-- WC.4: drop trigger duplicado trg_saidas_combustivel_set_updated_at em
--   saidas_combustivel. Mantém trg_updated_at_saidas (padrão do projeto:
--   usa fn_set_updated_at vs tg_set_updated_at — só um precisa rodar).
-- =============================================================================

begin;

-- =============================================================================
-- WC.3a — Anti-futuro trigger (wall-clock BR, 24h grace)
-- =============================================================================
create or replace function public.fn_validate_data_nao_futura_wc()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_data    timestamp;
  v_now_br  timestamp;
begin
  if TG_TABLE_NAME = 'saidas_combustivel' then
    v_data := NEW.data;
  else
    v_data := NEW.data_hora;
  end if;

  -- now() (timestamptz) convertido pro wall-clock BR e strip TZ.
  v_now_br := (now() AT TIME ZONE 'America/Sao_Paulo')::timestamp;

  if v_data > v_now_br + interval '24 hours' then
    raise exception
      'Data % não pode ser mais de 24h no futuro (agora BR: %)',
      v_data, v_now_br;
  end if;

  return NEW;
end;
$$;

comment on function public.fn_validate_data_nao_futura_wc is
  'Anti-futuro wall-clock para combustível: bloqueia data > 24h à frente '
  'do wall-clock BR (America/Sao_Paulo). Janela de 24h cobre device com '
  'fuso/hora errada sem bloquear retroatividade. Lê NEW.data em '
  'saidas_combustivel e NEW.data_hora nas demais tabelas.';

drop trigger if exists trg_saidas_combustivel_anti_futuro on public.saidas_combustivel;
create trigger trg_saidas_combustivel_anti_futuro
  before insert or update of data on public.saidas_combustivel
  for each row execute function public.fn_validate_data_nao_futura_wc();

drop trigger if exists trg_entradas_combustivel_anti_futuro on public.entradas_combustivel;
create trigger trg_entradas_combustivel_anti_futuro
  before insert or update of data_hora on public.entradas_combustivel
  for each row execute function public.fn_validate_data_nao_futura_wc();

drop trigger if exists trg_transferencias_combustivel_anti_futuro on public.transferencias_combustivel;
create trigger trg_transferencias_combustivel_anti_futuro
  before insert or update of data_hora on public.transferencias_combustivel
  for each row execute function public.fn_validate_data_nao_futura_wc();

drop trigger if exists trg_esvaziamentos_tanque_anti_futuro on public.esvaziamentos_tanque;
create trigger trg_esvaziamentos_tanque_anti_futuro
  before insert or update of data_hora on public.esvaziamentos_tanque
  for each row execute function public.fn_validate_data_nao_futura_wc();

-- =============================================================================
-- WC.3b — Recreate sync_medicao_upd trigger (dropped by CASCADE)
-- =============================================================================
-- Função public.tg_saidas_combustivel_sync_medicao() já existe (preservada
-- pelo CASCADE — só triggers e índices dependentes da coluna data foram
-- dropados). Definição idêntica à original (20260512130000).
drop trigger if exists trg_saidas_combustivel_sync_medicao_upd on public.saidas_combustivel;
create trigger trg_saidas_combustivel_sync_medicao_upd
  after update on public.saidas_combustivel
  for each row
  when (
       OLD.medicao_no_abastecimento is distinct from NEW.medicao_no_abastecimento
    or OLD.tipo_medicao_snapshot   is distinct from NEW.tipo_medicao_snapshot
    or OLD.equipamento_id           is distinct from NEW.equipamento_id
    or OLD.data                     is distinct from NEW.data
    or OLD.deleted_at               is distinct from NEW.deleted_at
  )
  execute function public.tg_saidas_combustivel_sync_medicao();

-- =============================================================================
-- WC.4 — Drop trigger updated_at duplicado em saidas_combustivel
-- =============================================================================
-- Mantém trg_updated_at_saidas (usa tg_set_updated_at — padrão do projeto).
drop trigger if exists trg_saidas_combustivel_set_updated_at on public.saidas_combustivel;

commit;
