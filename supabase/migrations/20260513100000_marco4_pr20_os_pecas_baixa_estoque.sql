-- Marco 4 / PR20: baixa automática de estoque quando OS consome peça.
--
-- Estratégia escolhida: estender a view v_saldo_estoque pra subtrair também
-- as os_pecas de OSs ativas (não-canceladas, não-rascunho). Resultado:
--   - Ao adicionar peça em uma OS, o saldo do depósito cai automaticamente.
--   - Se a OS é cancelada → as os_pecas continuam apontando pra ela, mas
--     a view ignora porque filtra por status.
--   - Se a OS é concluída → peça já saiu do estoque permanentemente.
--   - Se a peça é removida da OS → saldo volta.
--
-- Sem espelhamento em saidas_material — fonte única de verdade é os_pecas
-- pra consumo de manutenção. saidas_material continua existindo pra
-- saídas avulsas de obras (módulo Insumos).
--
-- Trigger BEFORE INSERT/UPDATE em os_pecas bloqueia se saldo insuficiente.

-- === 1. Atualiza view v_saldo_estoque ============================
create or replace view public.v_saldo_estoque as
with
  entradas_agg as (
    select deposito_material_id as deposito_id, insumo_id,
           coalesce(sum(quantidade), 0) as qty_entrada,
           coalesce(sum(valor_total), 0) as valor_entrada
    from entradas_material
    group by deposito_material_id, insumo_id
  ),
  saidas_agg as (
    select deposito_material_id as deposito_id, insumo_id,
           coalesce(sum(quantidade), 0) as qty_saida
    from saidas_material
    group by deposito_material_id, insumo_id
  ),
  transf_in as (
    select deposito_destino_id as deposito_id, insumo_id,
           coalesce(sum(quantidade), 0) as qty_in
    from transferencias_material
    group by deposito_destino_id, insumo_id
  ),
  transf_out as (
    select deposito_origem_id as deposito_id, insumo_id,
           coalesce(sum(quantidade), 0) as qty_out
    from transferencias_material
    group by deposito_origem_id, insumo_id
  ),
  ospecas_agg as (
    -- Consumo por OSs ATIVAS (não canceladas, não rascunho).
    -- OSs concluídas continuam contabilizadas (peça saiu de fato do estoque).
    select op.deposito_id, op.insumo_id,
           coalesce(sum(op.quantidade), 0) as qty_os
    from os_pecas op
    inner join ordens_servico os on os.id = op.os_id
    where os.status not in ('cancelada', 'rascunho')
      and op.deposito_id is not null
      and os.deleted_at is null
    group by op.deposito_id, op.insumo_id
  )
select
  i.id as insumo_id,
  i.nome as insumo_nome,
  i.unidade,
  i.codigo_sku,
  i.fabricante,
  i.estoque_minimo,
  d.id as deposito_id,
  d.nome as deposito_nome,
  coalesce(ea.qty_entrada, 0)
    + coalesce(ti.qty_in, 0)
    - coalesce(sa.qty_saida, 0)
    - coalesce(too.qty_out, 0)
    - coalesce(opa.qty_os, 0) as saldo,
  case when coalesce(ea.qty_entrada, 0) > 0
       then ea.valor_entrada / ea.qty_entrada
       else null end as custo_medio,
  ea.qty_entrada as total_entradas,
  ea.valor_entrada as valor_total_entradas
from insumos i
cross join depositos_material d
left join entradas_agg ea on ea.insumo_id = i.id and ea.deposito_id = d.id
left join saidas_agg sa  on sa.insumo_id = i.id and sa.deposito_id = d.id
left join transf_in ti   on ti.insumo_id = i.id and ti.deposito_id = d.id
left join transf_out too on too.insumo_id = i.id and too.deposito_id = d.id
left join ospecas_agg opa on opa.insumo_id = i.id and opa.deposito_id = d.id
where i.ativo = true;

-- === 2. Função de validação de saldo ============================
create or replace function public.tg_os_pecas_valida_saldo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saldo numeric;
  v_delta numeric;
  v_status_os text;
  v_nome_insumo text;
  v_nome_deposito text;
begin
  -- Se não há depósito definido, pula validação (caso raro: peça externa)
  if new.deposito_id is null then return new; end if;

  -- Não valida se OS já está cancelada ou rascunho (consumo zerado)
  select status into v_status_os from ordens_servico where id = new.os_id;
  if v_status_os in ('cancelada', 'rascunho') then return new; end if;

  -- Delta necessário
  v_delta := new.quantidade - coalesce(case when tg_op = 'UPDATE' then old.quantidade end, 0);
  if v_delta <= 0 then return new; end if;

  -- Saldo disponível no depósito (já considera outras OSs ativas)
  select saldo into v_saldo
    from v_saldo_estoque
    where deposito_id = new.deposito_id and insumo_id = new.insumo_id;

  if coalesce(v_saldo, 0) < v_delta then
    select nome into v_nome_insumo from insumos where id = new.insumo_id;
    select nome into v_nome_deposito from depositos_material where id = new.deposito_id;
    raise exception 'Saldo insuficiente: % em "%". Disponível: %, necessário: %',
      v_nome_insumo, v_nome_deposito, coalesce(v_saldo, 0), v_delta
      using errcode = '23514';  -- check_violation
  end if;

  return new;
end;
$$;

-- === 3. Trigger BEFORE INSERT/UPDATE em os_pecas =================
drop trigger if exists trg_os_pecas_valida_saldo on public.os_pecas;
create trigger trg_os_pecas_valida_saldo
  before insert or update of quantidade, insumo_id, deposito_id
  on public.os_pecas
  for each row
  execute function public.tg_os_pecas_valida_saldo();

-- === 4. Recria view v_saldo_estoque_total (depende da v_saldo_estoque) ===
create or replace view public.v_saldo_estoque_total as
select
  i.id as insumo_id,
  i.nome as insumo_nome,
  i.unidade,
  i.codigo_sku,
  i.codigo_ean,
  i.fabricante,
  i.codigo_fabricante,
  i.categoria,
  i.tipo,
  i.estoque_minimo,
  i.estoque_maximo,
  i.usado_em_manutencao,
  i.foto_url,
  i.equipamentos_compativeis,
  coalesce(sum(s.saldo), 0) as saldo_total,
  case
    when sum(case when s.saldo > 0 and s.custo_medio is not null then s.saldo else 0 end) > 0
    then sum(case when s.saldo > 0 and s.custo_medio is not null then s.saldo * s.custo_medio else 0 end)
       / nullif(sum(case when s.saldo > 0 and s.custo_medio is not null then s.saldo else 0 end), 0)
    else (select avg(custo_medio) from v_saldo_estoque s2 where s2.insumo_id = i.id and s2.custo_medio is not null)
  end as custo_medio,
  case
    when i.estoque_minimo is not null and coalesce(sum(s.saldo), 0) <= 0 then 'zerada'
    when i.estoque_minimo is not null and coalesce(sum(s.saldo), 0) < i.estoque_minimo then 'abaixo_minimo'
    when i.estoque_minimo is not null and coalesce(sum(s.saldo), 0) < (i.estoque_minimo * 1.2) then 'atencao'
    else 'ok'
  end as status_estoque
from insumos i
left join v_saldo_estoque s on s.insumo_id = i.id
where i.ativo = true
group by i.id;

comment on function public.tg_os_pecas_valida_saldo() is
  'PR20: BEFORE INSERT/UPDATE em os_pecas. Bloqueia adicao de peca se saldo do deposito for insuficiente.';
