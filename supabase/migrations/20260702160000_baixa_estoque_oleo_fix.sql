-- Baixa de estoque ao lançar óleo no serviço (híbrido: almoxarifado + tipo mantido).
-- Peça já baixa via v_saldo_estoque (subtrai os_pecas). Aqui: óleo passa a debitar também.

-- (a) os_oleos: origem do almoxarifado (nullable p/ compat com óleos lançados antes)
ALTER TABLE public.os_oleos ADD COLUMN IF NOT EXISTS insumo_id text REFERENCES public.insumos(id);
ALTER TABLE public.os_oleos ADD COLUMN IF NOT EXISTS deposito_id text REFERENCES public.depositos_material(id);
CREATE INDEX IF NOT EXISTS idx_os_oleos_insumo ON public.os_oleos(insumo_id);
CREATE INDEX IF NOT EXISTS idx_os_oleos_deposito ON public.os_oleos(deposito_id);

-- (b) insumos: marca "este insumo é um óleo do tipo X" (pro modal de óleo + vencimento)
ALTER TABLE public.insumos ADD COLUMN IF NOT EXISTS tipo_oleo_id text REFERENCES public.tipos_oleo(id);

-- (c) v_saldo_estoque: recriada IDÊNTICA + desconto do consumo de os_oleos
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
), osoleos_agg AS (
  SELECT oo.deposito_id, oo.insumo_id, COALESCE(sum(oo.quantidade), 0::numeric) AS qty_oleo
  FROM os_oleos oo
  JOIN ordens_servico os ON os.id = oo.os_id
  WHERE (os.status <> ALL (ARRAY['cancelada'::text, 'rascunho'::text]))
    AND oo.deposito_id IS NOT NULL AND oo.insumo_id IS NOT NULL AND os.deleted_at IS NULL
  GROUP BY oo.deposito_id, oo.insumo_id
)
SELECT i.id AS insumo_id,
       i.nome AS insumo_nome,
       i.unidade,
       i.codigo_sku,
       i.fabricante,
       i.estoque_minimo,
       d.id AS deposito_id,
       d.nome AS deposito_nome,
       COALESCE(ea.qty_entrada, 0::numeric) + COALESCE(ti.qty_in, 0::numeric)
         - COALESCE(sa.qty_saida, 0::numeric) - COALESCE(too.qty_out, 0::numeric)
         - COALESCE(opa.qty_os, 0::numeric) - COALESCE(ooa.qty_oleo, 0::numeric) AS saldo,
       CASE WHEN COALESCE(ea.qty_entrada, 0::numeric) > 0::numeric THEN ea.valor_entrada / ea.qty_entrada
            ELSE NULL::numeric END AS custo_medio,
       ea.qty_entrada AS total_entradas,
       ea.valor_entrada AS valor_total_entradas
FROM insumos i
CROSS JOIN depositos_material d
LEFT JOIN entradas_agg ea ON ea.insumo_id = i.id AND ea.deposito_id = d.id
LEFT JOIN saidas_agg sa ON sa.insumo_id = i.id AND sa.deposito_id = d.id
LEFT JOIN transf_in ti ON ti.insumo_id = i.id AND ti.deposito_id = d.id
LEFT JOIN transf_out too ON too.insumo_id = i.id AND too.deposito_id = d.id
LEFT JOIN ospecas_agg opa ON opa.insumo_id = i.id AND opa.deposito_id = d.id
LEFT JOIN osoleos_agg ooa ON ooa.insumo_id = i.id AND ooa.deposito_id = d.id
WHERE i.ativo = true;

-- (d) trigger de validação de saldo pra óleo (espelho de tg_os_pecas_valida_saldo)
CREATE OR REPLACE FUNCTION public.tg_os_oleos_valida_saldo() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog', 'public' AS $fn$
declare
  v_saldo numeric; v_delta numeric; v_status_os text; v_nome text; v_dep text;
begin
  if new.deposito_id is null or new.insumo_id is null then return new; end if;
  select status into v_status_os from ordens_servico where id = new.os_id;
  if v_status_os in ('cancelada', 'rascunho') then return new; end if;
  v_delta := new.quantidade - coalesce(case when tg_op = 'UPDATE' then old.quantidade end, 0);
  if v_delta <= 0 then return new; end if;
  select saldo into v_saldo from v_saldo_estoque where deposito_id = new.deposito_id and insumo_id = new.insumo_id;
  if coalesce(v_saldo, 0) < v_delta then
    select nome into v_nome from insumos where id = new.insumo_id;
    select nome into v_dep from depositos_material where id = new.deposito_id;
    raise exception 'Saldo insuficiente: % em "%". Disponível: %, necessário: %',
      v_nome, v_dep, coalesce(v_saldo, 0), v_delta using errcode = '23514';
  end if;
  return new;
end $fn$;

DROP TRIGGER IF EXISTS trg_os_oleos_valida_saldo ON public.os_oleos;
CREATE TRIGGER trg_os_oleos_valida_saldo BEFORE INSERT OR UPDATE ON public.os_oleos
  FOR EACH ROW EXECUTE FUNCTION public.tg_os_oleos_valida_saldo();
