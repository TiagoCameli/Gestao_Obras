-- View enriquecida: cada movimento + campos do cálculo da origem.
-- Consumida pelo extrato (modal + Excel + PDF) pra mostrar como o valor
-- foi calculado (litros × preço, peso × km × tkm, etc).
--
-- LEFT JOIN porque alguns movimentos podem perder o link com a origem
-- (ex: ajuste manual não tem source row separada). Campos extras vêm
-- NULL quando origem não bate — UI trata isso.

begin;

create or replace view public.transportadora_movimentos_detalhe as
select
  m.id,
  m.transportadora_id,
  m.data,
  m.tipo,
  m.valor,
  m.origem_tabela,
  m.origem_id,
  m.descricao,
  m.obra_id,
  m.mes_referencia,
  m.abatido_em_pagamento_id,
  m.created_at,
  m.created_by,
  -- Frete (credito_frete)
  f.peso_toneladas as frete_peso_toneladas,
  f.km_rodados as frete_km_rodados,
  f.valor_tkm as frete_valor_tkm,
  -- Saída de combustível (todos os tipos de abastecimento)
  s.litros as saida_litros,
  s.preco_combustivel as saida_preco_combustivel,
  s.preco_combustivel_areacre as saida_preco_combustivel_areacre,
  s.taxa_litro as saida_taxa_litro,
  s.preco_medio_tanque_snapshot as saida_preco_medio_tanque,
  s.tipo_combustivel as saida_tipo_combustivel,
  -- Pagamento (debito_pagamento_frete) — extras pra contexto
  p.metodo as pagamento_metodo
from public.transportadora_movimentos m
left join public.fretes f
  on m.origem_tabela = 'fretes' and m.origem_id = f.id
left join public.saidas_combustivel s
  on m.origem_tabela = 'saidas_combustivel' and m.origem_id = s.id
left join public.pagamentos_frete p
  on m.origem_tabela = 'pagamentos_frete' and m.origem_id = p.id;

comment on view public.transportadora_movimentos_detalhe is
  'transportadora_movimentos com LEFT JOIN nas tabelas de origem pra '
  'expor os campos do cálculo (peso/km/tkm pra fretes, litros/preco/taxa '
  'pra saidas_combustivel). Usado pelo extrato pra mostrar a fórmula que '
  'gerou cada valor. Campos saida_*/frete_*/pagamento_* vêm NULL quando '
  'a origem não bate.';

-- Validação
do $$
declare
  v_view_exists bool;
  v_count_view bigint;
  v_count_base bigint;
begin
  select exists (select 1 from pg_views where viewname = 'transportadora_movimentos_detalhe' and schemaname = 'public')
    into v_view_exists;
  if not v_view_exists then
    raise exception 'View transportadora_movimentos_detalhe não criada';
  end if;

  -- Cardinalidade da view = cardinalidade da base (LEFT JOIN não duplica)
  select count(*) into v_count_view from public.transportadora_movimentos_detalhe;
  select count(*) into v_count_base from public.transportadora_movimentos;
  if v_count_view <> v_count_base then
    raise exception 'View tem % rows; base tem %. LEFT JOIN duplicou — checar relacionamentos.',
      v_count_view, v_count_base;
  end if;

  raise notice 'View OK: % movimentos detalhados (= base).', v_count_view;
end $$;

commit;
