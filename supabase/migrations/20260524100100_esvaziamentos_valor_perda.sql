-- =============================================================================
-- FC.2 — Adicionar valor_perda em esvaziamentos_tanque
-- =============================================================================
-- Esvaziamento = perda física. valor_perda = SUM(litros × preco_lote FIFO
-- dos lotes consumidos). Computado server-side pela RPC nova
-- registrar_esvaziamento_fifo (FC.7).
--
-- Default 0 pra rows existentes (serão repopuladas pelo backfill FC.13).

ALTER TABLE public.esvaziamentos_tanque
  ADD COLUMN IF NOT EXISTS valor_perda numeric NOT NULL DEFAULT 0 CHECK (valor_perda >= 0);

COMMENT ON COLUMN public.esvaziamentos_tanque.valor_perda IS
  'Perda monetária = SUM(litros_consumidos × preco_lote) dos lotes FIFO afetados.';
