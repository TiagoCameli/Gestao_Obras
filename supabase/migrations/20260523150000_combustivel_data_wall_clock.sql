-- =============================================================================
-- WC.2 — Migrar colunas data/data_hora pra wall-clock (timestamp sem TZ).
-- =============================================================================
-- Principio: horario user-entered nao sofre conversao de TZ. Storage =
-- exatamente o wall-clock digitado. Display = igual.
--
-- Antes:
--   - entradas_combustivel.data_hora: text "YYYY-MM-DDTHH:MM"
--   - transferencias_combustivel.data_hora: text "YYYY-MM-DDTHH:MM"
--   - saidas_combustivel.data: timestamptz
--   - esvaziamentos_tanque.data_hora: timestamptz (0 rows)
--
-- Depois: timestamp (without time zone) em todas.
--
-- Backfill semantics:
--   - text "2026-05-21T15:00" -> ::timestamp = 2026-05-21 15:00:00 (wall clock preservado)
--   - timestamptz "...+00:00" -> AT TIME ZONE 'UTC' = wall clock preservado
--     (storage atual foi UTC implicito quando forms gravavam
--     new Date('2026-05-21T15:00').toISOString()).
--
-- IMPORTANT: triggers de validacao (capacidade, tipo, recalc nivel, audit)
-- sao desabilitadas durante o backfill UPDATE, pois fariam re-validacao
-- como se fosse uma nova entrada de combustivel (e falhariam por
-- inconsistencias de tipo entre tanques que ja existem hoje).
-- A coluna data_hora_wc/data_wc nao afeta semantica do tanque, so o storage.
-- =============================================================================

SET LOCAL session_replication_role = 'replica';

-- -----------------------------------------------------------------------------
-- entradas_combustivel.data_hora text -> timestamp
-- -----------------------------------------------------------------------------
ALTER TABLE public.entradas_combustivel
  ADD COLUMN IF NOT EXISTS data_hora_wc timestamp;

UPDATE public.entradas_combustivel
SET data_hora_wc = CASE
  WHEN data_hora IS NULL OR data_hora = '' THEN NULL
  WHEN data_hora ~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}' THEN data_hora::timestamp
  WHEN data_hora ~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}$' THEN (data_hora || ':00')::timestamp
  ELSE NULL
END
WHERE data_hora_wc IS NULL;

DO $$
DECLARE v_orig int; v_migr int;
BEGIN
  SELECT COUNT(*) INTO v_orig FROM public.entradas_combustivel
    WHERE data_hora IS NOT NULL AND data_hora <> '';
  SELECT COUNT(*) INTO v_migr FROM public.entradas_combustivel
    WHERE data_hora_wc IS NOT NULL;
  IF v_orig <> v_migr THEN
    RAISE EXCEPTION 'entradas_combustivel: % rows com data_hora nao-vazia mas so % migradas', v_orig, v_migr;
  END IF;
END$$;

ALTER TABLE public.entradas_combustivel ALTER COLUMN data_hora_wc SET NOT NULL;
ALTER TABLE public.entradas_combustivel DROP COLUMN data_hora CASCADE;
ALTER TABLE public.entradas_combustivel RENAME COLUMN data_hora_wc TO data_hora;
CREATE INDEX IF NOT EXISTS idx_entradas_combustivel_data_hora
  ON public.entradas_combustivel(data_hora);

-- -----------------------------------------------------------------------------
-- transferencias_combustivel.data_hora text -> timestamp
-- -----------------------------------------------------------------------------
ALTER TABLE public.transferencias_combustivel
  ADD COLUMN IF NOT EXISTS data_hora_wc timestamp;

UPDATE public.transferencias_combustivel
SET data_hora_wc = CASE
  WHEN data_hora IS NULL OR data_hora = '' THEN NULL
  WHEN data_hora ~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}' THEN data_hora::timestamp
  WHEN data_hora ~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}$' THEN (data_hora || ':00')::timestamp
  ELSE NULL
END
WHERE data_hora_wc IS NULL;

DO $$
DECLARE v_orig int; v_migr int;
BEGIN
  SELECT COUNT(*) INTO v_orig FROM public.transferencias_combustivel
    WHERE data_hora IS NOT NULL AND data_hora <> '';
  SELECT COUNT(*) INTO v_migr FROM public.transferencias_combustivel
    WHERE data_hora_wc IS NOT NULL;
  IF v_orig <> v_migr THEN
    RAISE EXCEPTION 'transferencias_combustivel: % rows com data_hora nao-vazia mas so % migradas', v_orig, v_migr;
  END IF;
END$$;

ALTER TABLE public.transferencias_combustivel ALTER COLUMN data_hora_wc SET NOT NULL;
ALTER TABLE public.transferencias_combustivel DROP COLUMN data_hora CASCADE;
ALTER TABLE public.transferencias_combustivel RENAME COLUMN data_hora_wc TO data_hora;
CREATE INDEX IF NOT EXISTS idx_transferencias_combustivel_data_hora
  ON public.transferencias_combustivel(data_hora);

-- -----------------------------------------------------------------------------
-- saidas_combustivel.data timestamptz -> timestamp
-- -----------------------------------------------------------------------------
ALTER TABLE public.saidas_combustivel
  ADD COLUMN IF NOT EXISTS data_wc timestamp;

UPDATE public.saidas_combustivel
SET data_wc = (data AT TIME ZONE 'UTC')
WHERE data_wc IS NULL AND data IS NOT NULL;

DO $$
DECLARE v_orig int; v_migr int;
BEGIN
  SELECT COUNT(*) INTO v_orig FROM public.saidas_combustivel WHERE data IS NOT NULL;
  SELECT COUNT(*) INTO v_migr FROM public.saidas_combustivel WHERE data_wc IS NOT NULL;
  IF v_orig <> v_migr THEN
    RAISE EXCEPTION 'saidas_combustivel: % rows com data nao-null mas so % migradas', v_orig, v_migr;
  END IF;
END$$;

ALTER TABLE public.saidas_combustivel ALTER COLUMN data_wc SET NOT NULL;
ALTER TABLE public.saidas_combustivel DROP COLUMN data CASCADE;
ALTER TABLE public.saidas_combustivel RENAME COLUMN data_wc TO data;
CREATE INDEX IF NOT EXISTS saidas_combustivel_data_idx
  ON public.saidas_combustivel(data DESC);
CREATE INDEX IF NOT EXISTS saidas_combustivel_tanque_idx
  ON public.saidas_combustivel(tanque_id, data DESC) WHERE tanque_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- esvaziamentos_tanque.data_hora timestamptz -> timestamp (0 rows mas consistencia)
-- -----------------------------------------------------------------------------
ALTER TABLE public.esvaziamentos_tanque
  ADD COLUMN IF NOT EXISTS data_hora_wc timestamp;

UPDATE public.esvaziamentos_tanque
SET data_hora_wc = (data_hora AT TIME ZONE 'UTC')
WHERE data_hora_wc IS NULL AND data_hora IS NOT NULL;

DO $$
DECLARE v_orig int; v_migr int;
BEGIN
  SELECT COUNT(*) INTO v_orig FROM public.esvaziamentos_tanque WHERE data_hora IS NOT NULL;
  SELECT COUNT(*) INTO v_migr FROM public.esvaziamentos_tanque WHERE data_hora_wc IS NOT NULL;
  IF v_orig <> v_migr THEN
    RAISE EXCEPTION 'esvaziamentos_tanque: % rows com data_hora nao-null mas so % migradas', v_orig, v_migr;
  END IF;
END$$;

ALTER TABLE public.esvaziamentos_tanque ALTER COLUMN data_hora_wc SET NOT NULL;
ALTER TABLE public.esvaziamentos_tanque DROP COLUMN data_hora CASCADE;
ALTER TABLE public.esvaziamentos_tanque RENAME COLUMN data_hora_wc TO data_hora;
CREATE INDEX IF NOT EXISTS idx_esvaziamentos_deposito
  ON public.esvaziamentos_tanque(deposito_id, data_hora DESC);

SET LOCAL session_replication_role = 'origin';
