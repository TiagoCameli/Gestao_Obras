-- HF.9 — Re-aplica o backfill HF.6 de tipo_combustivel em saidas_combustivel.
--
-- Após HF.7 (coluna denormalizada) e HF.8 (fallback corrigido),
-- calcular_combustivel_tanque_na_data agora retorna o tipo certo pra saídas
-- de tanques que receberam transferência. O backfill pega quaisquer saídas
-- nessa categoria que ainda estejam com tipo errado.
--
-- Idempotente — UPDATE só onde diverge.

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
  RAISE NOTICE 'HF.9 re-backfill: % saída(s) com tipo_combustivel corrigido.', v_corrigidas;
END $$;
