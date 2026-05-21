-- HF.10 — Backfill point-in-time de preço/valor em saídas históricas.
--
-- Para cada saída tipo equipamento_proprio com origem='tanque' e tanque_id
-- definido (ativas, não soft-deleted), recalcula:
-- - preco_medio_tanque_snapshot = preço ponderado dos litros entrados no tanque
--   até a data da saída (entradas + transferências recebidas)
-- - preco_unitario = mesmo valor (taxa_litro=0 pra equipamento próprio)
-- - valor_total = litros × preco_unitario
--
-- Usa public.calcular_preco_medio_tanque_na_data() criada em 20260521120600.
--
-- Não toca:
-- - tipo_consumidor='carreta_transportadora' (preço vem de negociação separada)
-- - origem != 'tanque' (preço manual: dinheiro/requisição)
-- - saídas soft-deleted

WITH novos AS (
  SELECT
    id,
    public.calcular_preco_medio_tanque_na_data(tanque_id, data::text) AS novo_preco
  FROM public.saidas_combustivel
  WHERE tipo_consumidor = 'equipamento_proprio'
    AND origem = 'tanque'
    AND tanque_id IS NOT NULL
    AND deleted_at IS NULL
)
UPDATE public.saidas_combustivel s
SET
  preco_medio_tanque_snapshot = n.novo_preco,
  preco_unitario = n.novo_preco,
  valor_total = s.litros * n.novo_preco,
  updated_at = now(),
  updated_by = COALESCE(s.updated_by, '') || ' (HF.10 backfill point-in-time)'
FROM novos n
WHERE s.id = n.id
  AND n.novo_preco > 0
  AND ABS(s.preco_unitario - n.novo_preco) > 0.0001;
