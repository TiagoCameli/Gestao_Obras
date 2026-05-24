-- =============================================================================
-- FC.1 — Rename saidas_lotes → consumos_lote (polymorphic).
-- =============================================================================
-- Adiciona consumo_tipo enum + renomeia saida_id → consumo_id.
-- Drop FK rígida pra saidas_combustivel (consumo_id passa a referenciar
-- 1 de 3 tabelas dependendo de consumo_tipo).
-- Cria VIEW saidas_lotes pra backward compat de consumers existentes.
--
-- Spec: docs/superpowers/specs/2026-05-24-fifo-completo-design.md

-- 1. Drop FK rígida (consumo_id agora é polimórfico)
ALTER TABLE public.saidas_lotes DROP CONSTRAINT IF EXISTS fk_saidas_lotes_saida;

-- 2. Rename tabela
ALTER TABLE public.saidas_lotes RENAME TO consumos_lote;

-- 3. Rename coluna saida_id → consumo_id
ALTER TABLE public.consumos_lote RENAME COLUMN saida_id TO consumo_id;

-- 4. Add consumo_tipo (com default 'saida' pra backfill dos 781 rows existentes)
ALTER TABLE public.consumos_lote
  ADD COLUMN consumo_tipo text NOT NULL DEFAULT 'saida'
  CHECK (consumo_tipo IN ('saida', 'transferencia_out', 'esvaziamento'));

-- 5. Drop default (forçar callers a preencher explicitamente)
ALTER TABLE public.consumos_lote ALTER COLUMN consumo_tipo DROP DEFAULT;

-- 6. Recriar indexes (renomeando os antigos)
DROP INDEX IF EXISTS idx_saidas_lotes_saida_id;
DROP INDEX IF EXISTS idx_saidas_lotes_fonte;
CREATE INDEX idx_consumos_lote_consumo ON public.consumos_lote(consumo_tipo, consumo_id);
CREATE INDEX idx_consumos_lote_fonte ON public.consumos_lote(fonte_tipo, fonte_id);

-- 7. Renomear policies (nomes reais descobertos no Step 1: _update / _delete sem "_admin")
ALTER POLICY saidas_lotes_select ON public.consumos_lote RENAME TO consumos_lote_select;
ALTER POLICY saidas_lotes_insert ON public.consumos_lote RENAME TO consumos_lote_insert;
ALTER POLICY saidas_lotes_update ON public.consumos_lote RENAME TO consumos_lote_update;
ALTER POLICY saidas_lotes_delete ON public.consumos_lote RENAME TO consumos_lote_delete;

-- 8. Renomear PK + CHECK constraints (cosmético — mantém consistência com novo nome da tabela)
ALTER TABLE public.consumos_lote RENAME CONSTRAINT saidas_lotes_pkey TO consumos_lote_pkey;
ALTER TABLE public.consumos_lote RENAME CONSTRAINT saidas_lotes_fonte_tipo_check TO consumos_lote_fonte_tipo_check;
ALTER TABLE public.consumos_lote RENAME CONSTRAINT saidas_lotes_litros_check TO consumos_lote_litros_check;
ALTER TABLE public.consumos_lote RENAME CONSTRAINT saidas_lotes_preco_lote_check TO consumos_lote_preco_lote_check;

-- 9. VIEW de compat backward — pros consumers que ainda usam saidas_lotes
CREATE VIEW public.saidas_lotes WITH (security_invoker = true) AS
  SELECT id, consumo_id AS saida_id, fonte_tipo, fonte_id, litros, preco_lote, created_at
  FROM public.consumos_lote
  WHERE consumo_tipo = 'saida';

COMMENT ON VIEW public.saidas_lotes IS
  'Compat backward: filtra consumos_lote por consumo_tipo=saida. Novos códigos devem usar consumos_lote diretamente.';
