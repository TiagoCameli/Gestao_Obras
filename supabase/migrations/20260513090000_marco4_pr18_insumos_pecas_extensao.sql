-- Marco 4 / PR18: estende insumos com campos de peça de manutenção.
-- Mantém compatibilidade total com uso atual em obras (categoria='material', etc).

alter table public.insumos
  add column if not exists usado_em_manutencao boolean not null default false,
  add column if not exists codigo_sku text,
  add column if not exists codigo_ean text,
  add column if not exists fabricante text,
  add column if not exists codigo_fabricante text,
  add column if not exists estoque_minimo numeric(12,3),
  add column if not exists estoque_maximo numeric(12,3),
  add column if not exists lead_time_dias integer,
  add column if not exists equipamentos_compativeis text[] default '{}'::text[],
  add column if not exists foto_url text,
  add column if not exists aplicacao_tecnica text;

comment on column public.insumos.usado_em_manutencao is 'Flag: aparece no /manutencao/almoxarifado.';
comment on column public.insumos.codigo_sku is 'Código interno único da peça (SKU).';
comment on column public.insumos.codigo_ean is 'Código de barras EAN/UPC do fornecedor.';
comment on column public.insumos.codigo_fabricante is 'Part number do fabricante (ex: 9X-7551 da Cat).';
comment on column public.insumos.equipamentos_compativeis is 'Lista de tipo_equipamento (ex: ["Escavadeira Hidráulica"]) ou ids específicos.';

-- View consolidada: saldo + custo médio móvel por insumo × depósito.
-- Custo médio = SUM(valor_total_entradas) / SUM(qty_entradas). Saídas e
-- transferências não alteram custo médio (apenas o saldo).
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
    - coalesce(too.qty_out, 0) as saldo,
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
where i.ativo = true;

-- View resumida (saldo total por insumo, agregando todos os depósitos)
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
  -- custo médio ponderado por depósito (peso = saldo do depósito; fallback = custo do depósito com qty>0)
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
