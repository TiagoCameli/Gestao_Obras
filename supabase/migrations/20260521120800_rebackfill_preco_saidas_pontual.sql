-- HF.11 follow-up: re-rodar o backfill point-in-time.
--
-- Entre HF.10 (backfill original) e HF.11 (fix do form de snapshot
-- imutável em edit mode), algumas saídas foram editadas via UI e tiveram
-- o preço sobrescrito com preço médio CURRENTE do tanque (não o
-- point-in-time correto). Esta migration corrige essas remanescentes.
--
-- Idempotente: só atualiza onde preco_unitario ainda diverge do
-- point-in-time computado.

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
  updated_by = COALESCE(NULLIF(s.updated_by, ''), 'sistema') || ' (HF.11 re-backfill point-in-time)'
FROM novos n
WHERE s.id = n.id
  AND n.novo_preco > 0
  AND ABS(s.preco_unitario - n.novo_preco) > 0.0001;
