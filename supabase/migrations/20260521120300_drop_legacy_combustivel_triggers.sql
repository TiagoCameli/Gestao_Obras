-- HF.4 — Combustível: drop legacy nivel triggers + functions.
--
-- Bug E5+T3 do audit: triggers legacy AFTER (trg_entrada_combustivel_nivel,
-- trg_transferencia_combustivel_nivel) coexistem com triggers novos
-- (trg_entradas/transferencias_combustivel_recalc_nivel). Ambos chamam
-- recalcular_nivel_deposito após cada operação → função roda 2× por
-- operação. Idempotente, mas custo desnecessário e risco de divergência
-- futura.
--
-- Função trigger_abastecimento_nivel está órfã (tabela abastecimentos foi
-- dropada em 20260505).
--
-- Fix: drop triggers + funções legacy. Os triggers novos cobrem 100% da
-- funcionalidade.

-- Drop legacy triggers (idempotente)
DROP TRIGGER IF EXISTS trg_entrada_combustivel_nivel ON public.entradas_combustivel;
DROP TRIGGER IF EXISTS trg_transferencia_combustivel_nivel ON public.transferencias_combustivel;

-- Drop legacy functions (no longer referenced by any trigger)
DROP FUNCTION IF EXISTS public.trigger_entrada_combustivel_nivel();
DROP FUNCTION IF EXISTS public.trigger_transferencia_combustivel_nivel();
DROP FUNCTION IF EXISTS public.trigger_abastecimento_nivel();
