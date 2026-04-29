-- ============================================================
-- MERGE pontual: BR-364 Lote 09
--
-- Unifica duas linhas que ficaram duplicadas (uma criada no cadastros,
-- outra no módulo de medição). Mantém o nome do cadastros e move TODAS
-- as atividades, etapas/contract_items, planning e medições da linha
-- antiga (medição) pra apontarem pro id mestre do cadastros.
--
-- Como o auto-match por regex não casa "009 - Manutenção de Rodovia
-- BR-364 (Lote - 09)" com "Manutenção de Rodovia BR-364 Lote 09",
-- esse par precisa ser tratado à parte.
--
-- Script idempotente: se a unificação já tiver sido feita (linhas com
-- mesmo id ou linha antiga inexistente), termina sem erro.
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_master_id uuid;
  v_old_id    uuid;
BEGIN
  -- Pega o id mestre vindo do cadastros (tabela `obras`).
  -- Usa ILIKE pra tolerar variações de espaço/parêntese.
  SELECT id INTO v_master_id
    FROM obras
   WHERE nome ILIKE '009%Manuten%BR-364%Lote%09%'
   ORDER BY length(nome) DESC
   LIMIT 1;

  IF v_master_id IS NULL THEN
    RAISE EXCEPTION 'Não achei a obra mestre no cadastros com padrão "009 ... BR-364 ... Lote ... 09"';
  END IF;

  -- Pega o id antigo da medição (tabela `rodotracker_obras`).
  -- Excluímos qualquer linha que JÁ esteja com o id do mestre — isso é o
  -- estado pós-unificação, não devemos tocar nela.
  SELECT id INTO v_old_id
    FROM rodotracker_obras
   WHERE name ILIKE '%Manuten%BR-364%Lote%09%'
     AND name NOT ILIKE '009%'
     AND id <> v_master_id
   ORDER BY updated_at DESC
   LIMIT 1;

  IF v_old_id IS NULL THEN
    RAISE NOTICE 'Nenhuma obra antiga encontrada — possivelmente já unificada. Nada a fazer.';
    RETURN;
  END IF;

  RAISE NOTICE 'Migrando dados: rodotracker_obras.% -> obras.%', v_old_id, v_master_id;

  -- ─── Mover FKs ────────────────────────────────────────────────
  UPDATE rodotracker_activities
     SET obra_id = v_master_id
   WHERE obra_id = v_old_id;
  RAISE NOTICE '  activities movidas';

  UPDATE rodotracker_contract_items
     SET obra_id = v_master_id
   WHERE obra_id = v_old_id;
  RAISE NOTICE '  contract_items movidos';

  UPDATE rodotracker_plan_items
     SET obra_id = v_master_id
   WHERE obra_id = v_old_id;
  RAISE NOTICE '  plan_items movidos';

  UPDATE rodotracker_medicao
     SET obra_id = v_master_id
   WHERE obra_id = v_old_id;
  RAISE NOTICE '  medicao movida';

  -- ─── Realinhar a extensão geo ─────────────────────────────────
  -- Cenário A: já existe linha em rodotracker_obras com o id do master
  --            (ex.: app criou uma extensão default antes desta migração).
  --            Atualiza-a com os dados ricos da linha antiga e descarta a antiga.
  IF EXISTS (SELECT 1 FROM rodotracker_obras WHERE id = v_master_id) THEN
    UPDATE rodotracker_obras m
       SET tipo_obra    = o.tipo_obra,
           rodovia      = o.rodovia,
           lote         = o.lote,
           trecho       = o.trecho,
           contrato     = o.contrato,
           km_inicial   = o.km_inicial,
           km_final     = o.km_final,
           center_lat   = o.center_lat,
           center_lng   = o.center_lng,
           zoom         = o.zoom,
           start_lat    = o.start_lat,
           start_lng    = o.start_lng,
           end_lat      = o.end_lat,
           end_lng      = o.end_lng,
           route_geojson = o.route_geojson,
           extension_km = o.extension_km,
           updated_at   = o.updated_at
      FROM rodotracker_obras o
     WHERE m.id = v_master_id
       AND o.id = v_old_id;
    DELETE FROM rodotracker_obras WHERE id = v_old_id;
    RAISE NOTICE '  extensão geo do master atualizada com dados ricos';

  -- Cenário B: não existe extensão do master — recria a linha antiga com o id novo.
  ELSE
    INSERT INTO rodotracker_obras (
      id, user_id, name, tipo_obra, rodovia, lote, trecho, contrato,
      km_inicial, km_final, center_lat, center_lng, zoom,
      start_lat, start_lng, end_lat, end_lng, route_geojson, extension_km,
      created_at, updated_at
    )
    SELECT
      v_master_id,
      user_id,
      -- Nome do cadastros como canônico no rodotracker_obras também.
      (SELECT nome FROM obras WHERE id = v_master_id),
      tipo_obra, rodovia, lote, trecho, contrato,
      km_inicial, km_final, center_lat, center_lng, zoom,
      start_lat, start_lng, end_lat, end_lng, route_geojson, extension_km,
      created_at, updated_at
    FROM rodotracker_obras
    WHERE id = v_old_id;

    DELETE FROM rodotracker_obras WHERE id = v_old_id;
    RAISE NOTICE '  extensão geo recriada com id master';
  END IF;

  -- ─── Garante o nome canônico em rodotracker_obras (vindo do cadastros)
  UPDATE rodotracker_obras m
     SET name = o.nome,
         updated_at = extract(epoch from now()) * 1000
    FROM obras o
   WHERE m.id = v_master_id
     AND o.id = v_master_id
     AND m.name <> o.nome;

  RAISE NOTICE 'Unificação concluída. Tudo agora pertence a id=%', v_master_id;
END $$;

COMMIT;

-- ─── Verificação pós-merge ───────────────────────────────────────────────
-- Roda manualmente após o COMMIT pra confirmar:
-- SELECT (SELECT count(*) FROM rodotracker_activities    WHERE obra_id IN (SELECT id FROM obras WHERE nome ILIKE '009%BR-364%Lote%09%')) AS atividades_no_master,
--        (SELECT count(*) FROM rodotracker_contract_items WHERE obra_id IN (SELECT id FROM obras WHERE nome ILIKE '009%BR-364%Lote%09%')) AS itens_no_master;
