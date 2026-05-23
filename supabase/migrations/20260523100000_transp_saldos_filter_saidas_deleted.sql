-- Bugfix follow-up: view `transportadora_saldos` (migration 20260522100300)
-- filtrava soft-deleted em fretes e pagamentos_frete, mas esqueci de
-- aplicar o mesmo filtro em saidas_combustivel.
--
-- Resultado: saídas de combustível soft-deletadas continuavam débito-
-- contadas no saldo da transportadora — divergência entre o dashboard
-- (que lê de `transportadora_movimentos_detalhe` que JÁ filtra saidas) e
-- a aba Conta Corrente (que lê de `transportadora_saldos`).
--
-- Exemplo concreto: EMT TRANSPORTES tinha 2 saídas soft-deletadas
-- somando R$ 7.687,21 que faziam o saldo da view ficar R$ 387.204,83 vs
-- R$ 394.892,04 do dashboard. Após esta migration ambos batem em
-- R$ 394.892,04.

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
  AND NOT EXISTS (
    SELECT 1 FROM public.saidas_combustivel s
    WHERE m.origem_tabela = 'saidas_combustivel'
      AND s.id = m.origem_id
      AND s.deleted_at IS NOT NULL
  )
WHERE t.eh_transportadora = true
GROUP BY t.id, t.nome, t.eh_dona_de_tanque;

COMMENT ON VIEW public.transportadora_saldos IS
  'Saldo por transportadora. Filtra movimentos soft-deletados E movimentos cuja origem (fretes/pagamentos_frete/saidas_combustivel) foi soft-deletada. Bate com transportadora_movimentos_detalhe e com saldosFiltrados do FreteDashboard.';
