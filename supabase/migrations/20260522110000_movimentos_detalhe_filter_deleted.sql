-- Bugfix da auditoria: view `transportadora_movimentos_detalhe` (usada pela
-- aba Conta Corrente / ExtratoFretesList / ExtratoPagamentosList /
-- ExtratoAjustesList) NÃO estava filtrando `deleted_at` — então
-- movimentos cuja origem (fretes/pagamentos_frete) foi soft-deletada
-- continuavam aparecendo no extrato.
--
-- Tambem filtra `m.deleted_at IS NULL` da própria transportadora_movimentos
-- (adicionada em 20260522100200).
--
-- A migration anterior (20260522100300) já tinha feito o mesmo fix na view
-- `transportadora_saldos` — mas esqueci de aplicar nesta view-irmã.

CREATE OR REPLACE VIEW public.transportadora_movimentos_detalhe AS
SELECT
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
  f.peso_toneladas AS frete_peso_toneladas,
  f.km_rodados AS frete_km_rodados,
  f.valor_tkm AS frete_valor_tkm,
  s.litros AS saida_litros,
  s.preco_combustivel AS saida_preco_combustivel,
  s.preco_combustivel_areacre AS saida_preco_combustivel_areacre,
  s.taxa_litro AS saida_taxa_litro,
  s.preco_medio_tanque_snapshot AS saida_preco_medio_tanque,
  s.tipo_combustivel AS saida_tipo_combustivel,
  p.metodo AS pagamento_metodo,
  f.origem AS frete_origem,
  f.destino AS frete_destino,
  f.insumo_id AS frete_insumo_id,
  f.nota_fiscal AS frete_nota_fiscal,
  f.nota_fiscal2 AS frete_nota_fiscal2,
  f.placa_carreta AS frete_placa_carreta,
  f.motorista AS frete_motorista,
  s.tipo_consumidor AS saida_tipo_consumidor,
  s.placa AS saida_placa,
  s.motorista AS saida_motorista,
  s.observacoes AS saida_observacoes,
  p.nota_fiscal AS pagamento_nota_fiscal,
  p.responsavel AS pagamento_responsavel,
  p.pago_por AS pagamento_pago_por,
  p.observacoes AS pagamento_observacoes,
  p.quantidade_combustivel AS pagamento_quantidade_combustivel
FROM transportadora_movimentos m
LEFT JOIN fretes f
  ON m.origem_tabela = 'fretes'::text
  AND m.origem_id = f.id
  AND f.deleted_at IS NULL
LEFT JOIN saidas_combustivel s
  ON m.origem_tabela = 'saidas_combustivel'::text
  AND m.origem_id = s.id
  AND s.deleted_at IS NULL
LEFT JOIN pagamentos_frete p
  ON m.origem_tabela = 'pagamentos_frete'::text
  AND m.origem_id = p.id
  AND p.deleted_at IS NULL
WHERE m.deleted_at IS NULL
  -- Esconde movimento se a origem foi soft-deletada
  AND NOT (m.origem_tabela = 'fretes' AND f.id IS NULL
           AND EXISTS (SELECT 1 FROM fretes ff WHERE ff.id = m.origem_id))
  AND NOT (m.origem_tabela = 'pagamentos_frete' AND p.id IS NULL
           AND EXISTS (SELECT 1 FROM pagamentos_frete pp WHERE pp.id = m.origem_id))
  AND NOT (m.origem_tabela = 'saidas_combustivel' AND s.id IS NULL
           AND EXISTS (SELECT 1 FROM saidas_combustivel ss WHERE ss.id = m.origem_id));

COMMENT ON VIEW public.transportadora_movimentos_detalhe IS
  'Extrato cronológico de movimentos por transportadora com LEFT JOIN em fretes/pagamentos_frete/saidas_combustivel. '
  'Filtra (1) movimentos soft-deletados, (2) movimentos cuja origem foi soft-deletada — '
  'mantém movimentos de ajuste_manual (que não têm origem em outra tabela).';
