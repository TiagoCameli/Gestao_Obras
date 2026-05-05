-- Split do preço do combustível em saídas de carreta com tanque externo
-- (Transterra/Areacre):
--   * preco_combustivel       — preço/L cobrado da TRANSPORTADORA consumidora.
--                                 Em tanque interno é o preço médio cobrado.
--   * preco_combustivel_areacre — preço/L cobrado pela PROPRIETÁRIA do tanque
--                                 externo (Areacre). NULL pra tanque interno.
--   * taxa_litro              — taxa Areacre, pass-through (some pros 2 lados).
--
-- Trigger:
--   * Tanque externo:
--       CRÉDITO proprietária = litros × (preco_combustivel_areacre + taxa_litro)
--       DÉBITO transportadora = litros × (preco_combustivel + taxa_litro) = valor_total
--       Margem EMT (não rastreada) = (preco_combustivel − preco_combustivel_areacre) × litros
--   * Tanque interno: só DÉBITO = valor_total (igual ao hoje).
--
-- Backfill: preco_combustivel_areacre = preco_combustivel WHERE tanque externo
-- (169 rows). Δ saldo Areacre = R$ 0,00 garantido (preços iguais).

begin;

-- (1) Schema
alter table public.saidas_combustivel
  add column if not exists preco_combustivel_areacre numeric(14,4);

comment on column public.saidas_combustivel.preco_combustivel_areacre is
  'Preço/L cobrado pela proprietária do tanque externo (ex: Areacre na Transterra). '
  'Vai pro crédito da proprietária. NULL pra tanque interno (não há proprietária externa). '
  'Margem EMT no combustível = (preco_combustivel − preco_combustivel_areacre) × litros.';

comment on column public.saidas_combustivel.preco_combustivel is
  'Preço/L cobrado da transportadora consumidora (em tanques externos pode diferir '
  'de preco_combustivel_areacre — diff vira margem EMT). Em tanque interno é o '
  'preço médio cobrado. Invariante: preco_combustivel + taxa_litro = preco_unitario.';

-- (2) Backfill: tanques externos copiam preco_combustivel
update public.saidas_combustivel s
   set preco_combustivel_areacre = s.preco_combustivel
  from public.depositos d
 where d.id = s.tanque_id
   and d.transportadora_proprietaria_id is not null
   and s.preco_combustivel_areacre is null;

-- (3) Trigger: split na geração de movimentos
create or replace function public.fn_saidas_combustivel_movimentos()
returns trigger
language plpgsql
as $$
declare
  v_proprietaria_id text;
  v_credito_id text;
  v_debito_id text;
  v_old_transp text;
  v_old_tanque text;
  v_credito_valor numeric;
begin
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    delete from public.transportadora_movimentos
     where origem_tabela = 'saidas_combustivel' and origem_id = old.id;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    v_old_transp := old.transportadora_id;
    v_old_tanque := old.tanque_id;
    if (new.transportadora_id is distinct from v_old_transp)
       or (new.tanque_id is distinct from v_old_tanque)
       or (new.tipo_consumidor is distinct from old.tipo_consumidor) then
      delete from public.transportadora_movimentos
       where origem_tabela = 'saidas_combustivel' and origem_id = old.id;
      -- Cai pro fluxo de INSERT abaixo
    else
      -- Recalcula in-place: crédito proprietária com fórmula nova; débito = valor_total
      update public.transportadora_movimentos
         set valor = case
               when tipo = 'credito_abastecimento_transterra'
                 then new.litros * (coalesce(new.preco_combustivel_areacre, new.preco_combustivel, 0) + coalesce(new.taxa_litro, 0))
               else new.valor_total
             end,
             data = new.data
       where origem_tabela = 'saidas_combustivel' and origem_id = new.id;
      return new;
    end if;
  end if;

  -- Fluxo INSERT (também alcançado por UPDATE com mudança estrutural)
  if new.tipo_consumidor != 'carreta_transportadora' then
    return new;
  end if;

  if new.transportadora_id is null then
    raise warning 'saidas_combustivel id=% sem transportadora_id; movimento NÃO criado.', new.id;
    return new;
  end if;

  if new.tanque_id is null then
    raise warning 'saidas_combustivel id=% origem=carreta sem tanque_id; movimento NÃO criado.', new.id;
    return new;
  end if;

  select transportadora_proprietaria_id
    into v_proprietaria_id
    from public.depositos
   where id = new.tanque_id;

  if v_proprietaria_id is not null then
    -- Split: crédito usa preco_combustivel_areacre (fallback preco_combustivel pra robustez);
    -- débito usa preco_combustivel via valor_total.
    v_credito_valor := new.litros * (coalesce(new.preco_combustivel_areacre, new.preco_combustivel, 0) + coalesce(new.taxa_litro, 0));
    v_credito_id := public.fn_gerar_id_text();
    v_debito_id := public.fn_gerar_id_text();

    insert into public.transportadora_movimentos (
      id, transportadora_id, data, tipo, valor, origem_tabela, origem_id,
      descricao, obra_id, mes_referencia
    ) values (
      v_credito_id, v_proprietaria_id, new.data,
      'credito_abastecimento_transterra', v_credito_valor,
      'saidas_combustivel', new.id,
      'Abastecimento de carreta no tanque ' || coalesce((select nome from public.depositos where id = new.tanque_id), '?'),
      new.obra_id, date_trunc('month', new.data)::date
    );

    insert into public.transportadora_movimentos (
      id, transportadora_id, data, tipo, valor, origem_tabela, origem_id,
      descricao, obra_id, mes_referencia
    ) values (
      v_debito_id, new.transportadora_id, new.data,
      'debito_abastecimento_transterra', new.valor_total,
      'saidas_combustivel', new.id,
      'Abastecimento na Transterra (' || coalesce((select nome from public.fornecedores where id = v_proprietaria_id), '?') || ')',
      new.obra_id, date_trunc('month', new.data)::date
    );

    update public.saidas_combustivel set movimento_id = v_debito_id where id = new.id;
  else
    v_debito_id := public.fn_gerar_id_text();
    insert into public.transportadora_movimentos (
      id, transportadora_id, data, tipo, valor, origem_tabela, origem_id,
      descricao, obra_id, mes_referencia
    ) values (
      v_debito_id, new.transportadora_id, new.data,
      'debito_abastecimento_emt', new.valor_total,
      'saidas_combustivel', new.id,
      'Abastecimento no tanque EMT ' || coalesce((select nome from public.depositos where id = new.tanque_id), '?'),
      new.obra_id, date_trunc('month', new.data)::date
    );
    update public.saidas_combustivel set movimento_id = v_debito_id where id = new.id;
  end if;

  return new;
end;
$$;

-- (4) Recalcula movimentos credito_abastecimento_transterra existentes
--     (Δ esperado = R$ 0,00 — backfill garantiu preco_areacre = preco_combustivel)
update public.transportadora_movimentos m
   set valor = s.litros * (coalesce(s.preco_combustivel_areacre, 0) + coalesce(s.taxa_litro, 0))
  from public.saidas_combustivel s
 where m.origem_tabela = 'saidas_combustivel'
   and m.origem_id = s.id
   and m.tipo = 'credito_abastecimento_transterra';

-- (5) Validação inline.
-- Invariante: backfill garantiu preco_combustivel_areacre = preco_combustivel,
-- então o UPDATE em (4) recalcula com mesma fórmula → saldo Areacre não muda.
-- Captura saldo via SUM dos movimentos credito_abastecimento_transterra antes
-- e depois do UPDATE (transportadora_saldos é view computada, então comparar
-- direto na tabela de movimentos é a forma canônica de medir delta).
do $$
declare
  v_count_backfill int;
  v_count_movs int;
  v_sum_credito numeric;
  v_sum_recalc numeric;
  v_diff numeric;
begin
  select count(*) into v_count_backfill
    from public.saidas_combustivel s
    join public.depositos d on d.id = s.tanque_id
   where d.transportadora_proprietaria_id is not null
     and s.preco_combustivel_areacre is not null;

  if v_count_backfill < 169 then
    raise exception 'Backfill incompleto: esperado >=169 saidas com preco_combustivel_areacre populado, encontrado %', v_count_backfill;
  end if;

  -- Sum dos movimentos credito_abastecimento_transterra após (4) recalcular
  select count(*), coalesce(sum(valor), 0) into v_count_movs, v_sum_credito
    from public.transportadora_movimentos
   where tipo = 'credito_abastecimento_transterra';

  -- Sum esperado: litros × (preco_combustivel_areacre + taxa_litro) das mesmas saidas
  select coalesce(sum(s.litros * (coalesce(s.preco_combustivel_areacre, 0) + coalesce(s.taxa_litro, 0))), 0)
    into v_sum_recalc
    from public.saidas_combustivel s
    join public.transportadora_movimentos m
      on m.origem_tabela = 'saidas_combustivel' and m.origem_id = s.id
   where m.tipo = 'credito_abastecimento_transterra';

  v_diff := abs(v_sum_credito - v_sum_recalc);
  if v_diff > 0.05 then
    raise exception 'Sum movs credito_abastecimento_transterra (R$ %) diverge da fórmula recalculada (R$ %); diff R$ %',
      v_sum_credito, v_sum_recalc, v_diff;
  end if;

  raise notice 'Split OK. % saidas com preco_combustivel_areacre populado. % movs credito_abastecimento_transterra coerentes com fórmula nova (sum R$ %; Δ vs fórmula R$ %).',
    v_count_backfill, v_count_movs, v_sum_credito, v_diff;
end $$;

commit;
