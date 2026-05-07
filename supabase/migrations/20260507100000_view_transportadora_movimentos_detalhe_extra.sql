-- Estende a view transportadora_movimentos_detalhe com campos extras de
-- contexto da origem, pra o extrato (modal) poder mostrar abas
-- especializadas por tipo (fretes, abastecimentos, pagamentos, ajustes)
-- com colunas detalhadas próprias de cada tipo.
--
-- Compat: CREATE OR REPLACE só aceita ADIÇÃO no final (Postgres não
-- permite mudar ordem/nome de colunas existentes). Por isso as novas
-- colunas vêm DEPOIS das antigas, mesmo que a separação por origem
-- (frete/saida/pagamento) fique misturada.

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
  -- Frete (colunas existentes)
  f.peso_toneladas as frete_peso_toneladas,
  f.km_rodados as frete_km_rodados,
  f.valor_tkm as frete_valor_tkm,
  -- Saída de combustível (colunas existentes)
  s.litros as saida_litros,
  s.preco_combustivel as saida_preco_combustivel,
  s.preco_combustivel_areacre as saida_preco_combustivel_areacre,
  s.taxa_litro as saida_taxa_litro,
  s.preco_medio_tanque_snapshot as saida_preco_medio_tanque,
  s.tipo_combustivel as saida_tipo_combustivel,
  -- Pagamento (coluna existente)
  p.metodo as pagamento_metodo,
  -- ── Novas colunas (sempre no final pra preservar ordem) ──
  f.origem as frete_origem,
  f.destino as frete_destino,
  f.insumo_id as frete_insumo_id,
  f.nota_fiscal as frete_nota_fiscal,
  f.nota_fiscal2 as frete_nota_fiscal2,
  f.placa_carreta as frete_placa_carreta,
  f.motorista as frete_motorista,
  s.tipo_consumidor as saida_tipo_consumidor,
  s.placa as saida_placa,
  s.motorista as saida_motorista,
  s.observacoes as saida_observacoes,
  p.nota_fiscal as pagamento_nota_fiscal,
  p.responsavel as pagamento_responsavel,
  p.pago_por as pagamento_pago_por,
  p.observacoes as pagamento_observacoes,
  p.quantidade_combustivel as pagamento_quantidade_combustivel
from public.transportadora_movimentos m
left join public.fretes f
  on m.origem_tabela = 'fretes' and m.origem_id = f.id
left join public.saidas_combustivel s
  on m.origem_tabela = 'saidas_combustivel' and m.origem_id = s.id
left join public.pagamentos_frete p
  on m.origem_tabela = 'pagamentos_frete' and m.origem_id = p.id;

comment on view public.transportadora_movimentos_detalhe is
  'transportadora_movimentos com LEFT JOIN nas tabelas de origem pra '
  'expor cálculo (peso/km/tkm; litros/preco/taxa) + contexto extra '
  '(origem/destino/NF/placa/motorista pra fretes; tipo_consumidor/placa/'
  'motorista pra saidas; método/NF/responsavel pra pagamentos). Usado '
  'pelo extrato com abas detalhadas. Campos *_* = NULL quando origem '
  'não bate (ex: ajuste manual).';

do $$
declare
  v_count_view bigint;
  v_count_base bigint;
  v_has_frete_origem bool;
  v_has_pagto_responsavel bool;
  v_has_saida_placa bool;
begin
  select count(*) into v_count_view from public.transportadora_movimentos_detalhe;
  select count(*) into v_count_base from public.transportadora_movimentos;
  if v_count_view <> v_count_base then
    raise exception 'View tem % rows; base tem %. LEFT JOIN duplicou.',
      v_count_view, v_count_base;
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='transportadora_movimentos_detalhe'
      and column_name='frete_origem'
  ) into v_has_frete_origem;
  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='transportadora_movimentos_detalhe'
      and column_name='pagamento_responsavel'
  ) into v_has_pagto_responsavel;
  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='transportadora_movimentos_detalhe'
      and column_name='saida_placa'
  ) into v_has_saida_placa;

  if not (v_has_frete_origem and v_has_pagto_responsavel and v_has_saida_placa) then
    raise exception 'Colunas novas faltando: frete_origem=%, pagamento_responsavel=%, saida_placa=%',
      v_has_frete_origem, v_has_pagto_responsavel, v_has_saida_placa;
  end if;

  raise notice 'View OK: % movimentos, colunas extras presentes.', v_count_view;
end $$;

commit;
