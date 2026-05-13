-- Marco 4 / PR22: custo de peças por equipamento — view agregada para o
-- dashboard e o detalhe do equipamento. Cruza os_pecas × ordens_servico
-- (não canceladas, não rascunho) × equipamentos.
--
-- Janela: últimos 12 meses contados a partir de now() (rolling 12m).
-- Considera data_abertura da OS como referência temporal — fica disponível
-- desde a abertura, não precisa esperar conclusão.

create or replace view public.v_custo_pecas_equipamento_12m as
select
  eq.id as equipamento_id,
  eq.codigo_patrimonio,
  eq.nome as equipamento_nome,
  eq.tipo as equipamento_tipo,
  coalesce(sum(op.custo_total), 0)::numeric as custo_total_12m,
  count(distinct os.id) as num_os,
  count(op.id) as num_pecas,
  coalesce(sum(op.quantidade), 0)::numeric as qty_total
from equipamentos eq
left join ordens_servico os
  on os.equipamento_id = eq.id
  and os.status not in ('cancelada', 'rascunho')
  and os.deleted_at is null
  and os.data_abertura >= (now() - interval '12 months')
left join os_pecas op on op.os_id = os.id
where eq.ativo = true
group by eq.id, eq.codigo_patrimonio, eq.nome, eq.tipo;

-- View mensal (12 buckets) por equipamento — útil para gráficos
create or replace view public.v_custo_pecas_equipamento_mensal as
with meses as (
  -- Lista os 12 meses encerrando no mês atual
  select date_trunc('month', now() - (n || ' months')::interval)::date as mes
  from generate_series(0, 11) n
)
select
  eq.id as equipamento_id,
  eq.codigo_patrimonio,
  eq.nome as equipamento_nome,
  to_char(m.mes, 'YYYY-MM') as mes,
  coalesce(sum(op.custo_total), 0)::numeric as custo_pecas
from equipamentos eq
cross join meses m
left join ordens_servico os
  on os.equipamento_id = eq.id
  and os.status not in ('cancelada', 'rascunho')
  and os.deleted_at is null
  and date_trunc('month', os.data_abertura) = m.mes
left join os_pecas op on op.os_id = os.id
where eq.ativo = true
group by eq.id, eq.codigo_patrimonio, eq.nome, m.mes;

comment on view public.v_custo_pecas_equipamento_12m is
  'PR22: custo de peças acumulado em 12 meses rolling por equipamento. Inclui OSs ativas e concluídas, exclui canceladas e rascunho.';
