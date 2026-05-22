-- HF.6 — Combustível: backfill global de tipo_combustivel em saidas_combustivel.
--
-- Escopo: TODAS as saídas com origem='tanque' em tanques internos cujo
-- `tipo_combustivel` gravado diverge do que o histórico point-in-time
-- (HF.4 — calcular_combustivel_tanque_na_data) indica.
--
-- Caso conhecido: 8 saídas do "Meloza Colorado" entre 21/05 14:43 e
-- 22/05 08:35 ficaram com Diesel S10, mas o tanque tinha S500 desde a
-- entrada de 20/05 12:58 — vide PR de HF.1/HF.2/HF.3.
--
-- Idempotente: UPDATE só roda nas linhas onde diverge. Pode ser
-- reaplicado sem efeito colateral.

DO $$
DECLARE
  v_corrigidas int;
BEGIN
  WITH alvos AS (
    SELECT s.id,
           public.calcular_combustivel_tanque_na_data(s.tanque_id, s.data::text) AS tipo_correto
      FROM public.saidas_combustivel s
      JOIN public.depositos d ON d.id = s.tanque_id
     WHERE s.origem = 'tanque'
       AND s.deleted_at IS NULL
       AND d.eh_externo = false
  )
  UPDATE public.saidas_combustivel s
     SET tipo_combustivel = a.tipo_correto
    FROM alvos a
   WHERE s.id = a.id
     AND s.tipo_combustivel IS DISTINCT FROM a.tipo_correto
     AND a.tipo_correto IS NOT NULL;

  GET DIAGNOSTICS v_corrigidas = ROW_COUNT;
  RAISE NOTICE 'HF.6 backfill: % saída(s) com tipo_combustivel corrigido.', v_corrigidas;
END $$;
