-- Audit Frete (Item #3 do frete-audit.md): view transportadora_saldos
-- passa a filtrar deleted_at em transportadora_movimentos (adicionado
-- em 20260522100200) E nas tabelas-fonte fretes/pagamentos_frete.
--
-- Antes: soft-delete de frete/pagamento não estornava o crédito/débito
-- no saldo da transportadora (padrão F1 do baseline combustível
-- replicado).
--
-- Depois: view ignora movimentos cujo origem foi soft-deletada OU que
-- foram diretamente soft-deletados.
--
-- A função saldo_devedor_combustivel (criada em 20260505070000) usa
-- transportadora_movimentos diretamente e também deve filtrar — mas
-- como ela é STABLE SQL com filtros temporais específicos, será tratada
-- numa migration separada se necessário (verificar uso em produção).
--
-- Idempotente.

CREATE OR REPLACE VIEW public.transportadora_saldos AS
SELECT
  t.id AS transportadora_id,
  t.nome,
  t.eh_dona_de_tanque,
  COALESCE(SUM(
    CASE
      WHEN m.tipo = ANY (ARRAY['credito_frete'::text, 'credito_abastecimento_transterra'::text, 'ajuste_manual_credito'::text]) THEN m.valor
      WHEN m.abatido_em_pagamento_id IS NOT NULL THEN 0::numeric
      ELSE -m.valor
    END
  ), 0::numeric) AS saldo,
  COALESCE(SUM(
    CASE
      WHEN m.tipo = ANY (ARRAY['debito_abastecimento_transterra'::text, 'debito_abastecimento_emt'::text]) THEN m.valor
      ELSE 0::numeric
    END
  ), 0::numeric) AS debito_combustivel_total,
  COALESCE(SUM(CASE WHEN m.tipo = 'credito_frete'::text THEN m.valor ELSE 0::numeric END), 0::numeric) AS credito_frete_total,
  COALESCE(SUM(CASE WHEN m.tipo = 'debito_pagamento_frete'::text THEN m.valor ELSE 0::numeric END), 0::numeric) AS pago_frete_total,
  COUNT(m.id) FILTER (WHERE m.id IS NOT NULL) AS qtd_movimentos
FROM public.fornecedores t
LEFT JOIN public.transportadora_movimentos m
  ON m.transportadora_id = t.id
  AND m.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.fretes f
    WHERE m.origem_tabela = 'fretes'
      AND f.id = m.origem_id
      AND f.deleted_at IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.pagamentos_frete p
    WHERE m.origem_tabela = 'pagamentos_frete'
      AND p.id = m.origem_id
      AND p.deleted_at IS NOT NULL
  )
WHERE t.eh_transportadora = true
GROUP BY t.id, t.nome, t.eh_dona_de_tanque;

COMMENT ON VIEW public.transportadora_saldos IS
  'Saldo cronológico por transportadora. Filtra movimentos soft-deletados '
  '(deleted_at IS NOT NULL) E movimentos cuja origem (fretes/pagamentos_frete) '
  'foi soft-deletada. Tipos de crédito listados explicitamente via ANY '
  '(credito_frete, credito_abastecimento_transterra, ajuste_manual_credito).';
