-- Backfill: copia rodotracker_contract_items → etapas_obra para a obra
-- "003 - Recuperação do Ramal do Gama" (c5f6493a-5921-434c-93c5-f3a14cd2e428).
--
-- Problema: a BR-364 já teve esse backfill (273 etapas_obra com prefixo
-- numérico), mas o Gama só tinha 5 etapas-pais sem numeração e sem
-- subitens/serviços. O Form de Saída de Combustível usa apenas etapas_obra
-- (via hook useEtapas), então no Gama aparecem só 5 nomes sem código e
-- nenhum item de serviço — bug relatado em 2026-05-24.
--
-- Verificação prévia (executada): 0 referências às 5 etapas atuais em
-- apontamentos, saidas_combustivel, registros_horas_diaristas,
-- financeiro_rateios. Seguro deletar.
--
-- Idempotência: usa o id do contract_item como id da etapa. Re-rodar não
-- duplica (ON CONFLICT). Re-roda só para o Gama; outras obras intocadas.

DO $$
DECLARE
  v_obra_id text := 'c5f6493a-5921-434c-93c5-f3a14cd2e428';
BEGIN
  -- 1) Remove as 5 etapas-pais sem código (não têm referências).
  DELETE FROM public.etapas_obra
  WHERE obra_id = v_obra_id;

  -- 2) Importa todos os contract_items como etapas, formatando nome como
  -- "code - name" pra bater com o padrão usado em BR-364.
  INSERT INTO public.etapas_obra (id, nome, obra_id, unidade, quantidade, valor_unitario, criado_por)
  SELECT
    ci.id,
    COALESCE(ci.code, '') ||
      CASE WHEN ci.code IS NULL OR ci.code = '' THEN '' ELSE ' - ' END ||
      ci.name AS nome,
    v_obra_id,
    COALESCE(ci.unit, '') AS unidade,
    COALESCE(ci.contracted_qty, 0) AS quantidade,
    COALESCE(ci.unit_price, 0) AS valor_unitario,
    'backfill_2026_05_24' AS criado_por
  FROM public.rodotracker_contract_items ci
  WHERE ci.obra_id = v_obra_id
  ON CONFLICT (id) DO NOTHING;
END $$;
