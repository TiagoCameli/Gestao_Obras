-- =============================================================================
-- ROLLBACK — COMB.TRAVAS (saldo negativo + ciclo fechado)
-- =============================================================================
-- Reverte triggers e funções. As travas só validam (não reescrevem dado),
-- então o rollback é só de schema. O índice idx_saidas_combustivel_tanque_data
-- é mantido (é benéfico e inofensivo); descomente pra remover.
-- =============================================================================

DROP TRIGGER IF EXISTS trg_guard_saldo_saida          ON public.saidas_combustivel;
DROP TRIGGER IF EXISTS trg_guard_saldo_entrada        ON public.entradas_combustivel;
DROP TRIGGER IF EXISTS trg_guard_saldo_transferencia  ON public.transferencias_combustivel;
DROP TRIGGER IF EXISTS trg_lock_ciclo_saida           ON public.saidas_combustivel;
DROP TRIGGER IF EXISTS trg_lock_ciclo_entrada         ON public.entradas_combustivel;
DROP TRIGGER IF EXISTS trg_lock_ciclo_transferencia   ON public.transferencias_combustivel;

DROP FUNCTION IF EXISTS private.trg_guard_saldo_saida();
DROP FUNCTION IF EXISTS private.trg_guard_saldo_entrada();
DROP FUNCTION IF EXISTS private.trg_guard_saldo_transferencia();
DROP FUNCTION IF EXISTS private.trg_lock_ciclo_saida();
DROP FUNCTION IF EXISTS private.trg_lock_ciclo_entrada();
DROP FUNCTION IF EXISTS private.trg_lock_ciclo_transferencia();

DROP FUNCTION IF EXISTS public.inicio_ciclo_aberto_tanque(text);
DROP FUNCTION IF EXISTS private.assert_saldo_nao_negativo(text);
DROP FUNCTION IF EXISTS private.inicio_ciclo_aberto(text);
DROP FUNCTION IF EXISTS private.saldo_min_tanque(text);
DROP FUNCTION IF EXISTS private.tanque_eh_externo(text);

-- DROP INDEX IF EXISTS public.idx_saidas_combustivel_tanque_data;
