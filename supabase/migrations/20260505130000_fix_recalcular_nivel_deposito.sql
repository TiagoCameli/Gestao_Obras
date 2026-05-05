-- Função recalcular_nivel_deposito() ainda fazia SUM em abastecimentos
-- (tabela dropada na Fase 5). Resultado: INSERT em entradas_combustivel
-- estourava com "relation \"abastecimentos\" does not exist".
--
-- Recria usando as 3 tabelas do schema atual:
--   nível = SUM(entradas) + SUM(transferências chegando) − SUM(saídas tipo tanque) − SUM(transferências saindo)
--
-- Trigger associado em entradas_combustivel + saidas_combustivel +
-- transferencias_combustivel é (re)criado ao final pra garantir consistência.

begin;

create or replace function public.recalcular_nivel_deposito(p_deposito_id text)
returns void
language plpgsql
security definer
as $$
declare
  v_entradas numeric;
  v_saidas numeric;
  v_transf_in numeric;
  v_transf_out numeric;
  v_novo_nivel numeric;
begin
  if p_deposito_id is null then
    return;
  end if;

  select coalesce(sum(quantidade_litros), 0)
    into v_entradas
    from public.entradas_combustivel
   where deposito_id = p_deposito_id;

  select coalesce(sum(litros), 0)
    into v_saidas
    from public.saidas_combustivel
   where origem = 'tanque'
     and tanque_id = p_deposito_id;

  select coalesce(sum(quantidade_litros), 0)
    into v_transf_in
    from public.transferencias_combustivel
   where deposito_destino_id = p_deposito_id;

  select coalesce(sum(quantidade_litros), 0)
    into v_transf_out
    from public.transferencias_combustivel
   where deposito_origem_id = p_deposito_id;

  v_novo_nivel := v_entradas + v_transf_in - v_saidas - v_transf_out;

  update public.depositos
     set nivel_atual_litros = greatest(v_novo_nivel, 0)
   where id = p_deposito_id;
end;
$$;

-- Trigger genérico: após INS/UPD/DEL em qualquer tabela que move estoque,
-- recalcula o(s) depósito(s) afetado(s).

create or replace function public.fn_trigger_recalcular_nivel_entrada()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.deposito_id is not null then
      perform public.recalcular_nivel_deposito(old.deposito_id);
    end if;
    return old;
  end if;
  if new.deposito_id is not null then
    perform public.recalcular_nivel_deposito(new.deposito_id);
  end if;
  if tg_op = 'UPDATE' and old.deposito_id is distinct from new.deposito_id and old.deposito_id is not null then
    perform public.recalcular_nivel_deposito(old.deposito_id);
  end if;
  return new;
end;
$$;

create or replace function public.fn_trigger_recalcular_nivel_saida()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.tanque_id is not null then
      perform public.recalcular_nivel_deposito(old.tanque_id);
    end if;
    return old;
  end if;
  if new.tanque_id is not null then
    perform public.recalcular_nivel_deposito(new.tanque_id);
  end if;
  if tg_op = 'UPDATE' and old.tanque_id is distinct from new.tanque_id and old.tanque_id is not null then
    perform public.recalcular_nivel_deposito(old.tanque_id);
  end if;
  return new;
end;
$$;

create or replace function public.fn_trigger_recalcular_nivel_transferencia()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.deposito_origem_id is not null then
      perform public.recalcular_nivel_deposito(old.deposito_origem_id);
    end if;
    if old.deposito_destino_id is not null then
      perform public.recalcular_nivel_deposito(old.deposito_destino_id);
    end if;
    return old;
  end if;
  if new.deposito_origem_id is not null then
    perform public.recalcular_nivel_deposito(new.deposito_origem_id);
  end if;
  if new.deposito_destino_id is not null then
    perform public.recalcular_nivel_deposito(new.deposito_destino_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_entradas_combustivel_recalc_nivel on public.entradas_combustivel;
create trigger trg_entradas_combustivel_recalc_nivel
  after insert or update or delete on public.entradas_combustivel
  for each row execute function public.fn_trigger_recalcular_nivel_entrada();

drop trigger if exists trg_saidas_combustivel_recalc_nivel on public.saidas_combustivel;
create trigger trg_saidas_combustivel_recalc_nivel
  after insert or update or delete on public.saidas_combustivel
  for each row execute function public.fn_trigger_recalcular_nivel_saida();

drop trigger if exists trg_transferencias_combustivel_recalc_nivel on public.transferencias_combustivel;
create trigger trg_transferencias_combustivel_recalc_nivel
  after insert or update or delete on public.transferencias_combustivel
  for each row execute function public.fn_trigger_recalcular_nivel_transferencia();

-- Recalcula níveis de TODOS os depósitos (sanity após o fix).
do $$
declare
  v_dep record;
begin
  for v_dep in select id from public.depositos loop
    perform public.recalcular_nivel_deposito(v_dep.id);
  end loop;
  raise notice 'Função recalcular_nivel_deposito reconstruída + triggers reinstalados + níveis recalculados.';
end $$;

commit;
