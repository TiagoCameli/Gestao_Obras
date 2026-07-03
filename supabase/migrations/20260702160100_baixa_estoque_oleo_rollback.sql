-- ROLLBACK da baixa de estoque de óleo (20260702160000).

DROP TRIGGER IF EXISTS trg_os_oleos_valida_saldo ON public.os_oleos;
DROP FUNCTION IF EXISTS public.tg_os_oleos_valida_saldo() CASCADE;

-- Recria v_saldo_estoque na forma ORIGINAL (sem descontar os_oleos)
CREATE OR REPLACE VIEW public.v_saldo_estoque AS
WITH entradas_agg AS (
  SELECT entradas_material.deposito_material_id AS deposito_id, entradas_material.insumo_id,
         COALESCE(sum(entradas_material.quantidade), 0::numeric) AS qty_entrada,
         COALESCE(sum(entradas_material.valor_total), 0::numeric) AS valor_entrada
  FROM entradas_material GROUP BY entradas_material.deposito_material_id, entradas_material.insumo_id
), saidas_agg AS (
  SELECT saidas_material.deposito_material_id AS deposito_id, saidas_material.insumo_id,
         COALESCE(sum(saidas_material.quantidade), 0::numeric) AS qty_saida
  FROM saidas_material GROUP BY saidas_material.deposito_material_id, saidas_material.insumo_id
), transf_in AS (
  SELECT transferencias_material.deposito_destino_id AS deposito_id, transferencias_material.insumo_id,
         COALESCE(sum(transferencias_material.quantidade), 0::numeric) AS qty_in
  FROM transferencias_material GROUP BY transferencias_material.deposito_destino_id, transferencias_material.insumo_id
), transf_out AS (
  SELECT transferencias_material.deposito_origem_id AS deposito_id, transferencias_material.insumo_id,
         COALESCE(sum(transferencias_material.quantidade), 0::numeric) AS qty_out
  FROM transferencias_material GROUP BY transferencias_material.deposito_origem_id, transferencias_material.insumo_id
), ospecas_agg AS (
  SELECT op.deposito_id, op.insumo_id, COALESCE(sum(op.quantidade), 0::numeric) AS qty_os
  FROM os_pecas op
  JOIN ordens_servico os ON os.id = op.os_id
  WHERE (os.status <> ALL (ARRAY['cancelada'::text, 'rascunho'::text]))
    AND op.deposito_id IS NOT NULL AND os.deleted_at IS NULL
  GROUP BY op.deposito_id, op.insumo_id
)
SELECT i.id AS insumo_id, i.nome AS insumo_nome, i.unidade, i.codigo_sku, i.fabricante, i.estoque_minimo,
       d.id AS deposito_id, d.nome AS deposito_nome,
       COALESCE(ea.qty_entrada, 0::numeric) + COALESCE(ti.qty_in, 0::numeric)
         - COALESCE(sa.qty_saida, 0::numeric) - COALESCE(too.qty_out, 0::numeric) - COALESCE(opa.qty_os, 0::numeric) AS saldo,
       CASE WHEN COALESCE(ea.qty_entrada, 0::numeric) > 0::numeric THEN ea.valor_entrada / ea.qty_entrada
            ELSE NULL::numeric END AS custo_medio,
       ea.qty_entrada AS total_entradas, ea.valor_entrada AS valor_total_entradas
FROM insumos i
CROSS JOIN depositos_material d
LEFT JOIN entradas_agg ea ON ea.insumo_id = i.id AND ea.deposito_id = d.id
LEFT JOIN saidas_agg sa ON sa.insumo_id = i.id AND sa.deposito_id = d.id
LEFT JOIN transf_in ti ON ti.insumo_id = i.id AND ti.deposito_id = d.id
LEFT JOIN transf_out too ON too.insumo_id = i.id AND too.deposito_id = d.id
LEFT JOIN ospecas_agg opa ON opa.insumo_id = i.id AND opa.deposito_id = d.id
WHERE i.ativo = true;

ALTER TABLE public.insumos DROP COLUMN IF EXISTS tipo_oleo_id;
ALTER TABLE public.os_oleos DROP COLUMN IF EXISTS insumo_id;
ALTER TABLE public.os_oleos DROP COLUMN IF EXISTS deposito_id;
