-- ============================================================
-- MERGE v2: BR-364 Lote 09 (após auto-migração já ter alinhado o
-- rodotracker_obras com uma cópia em obras)
--
-- Estado atual:
--   obras.id = '99a8ba7d-1b26-4d19-a983-379d46ac86aa' nome='Manutenção de Rodovia BR-364 Lote 09'
--   obras.id = 'mlpj5f26avttp'                       nome='009 - Manutenção de Rodovia BR-364 (Lote - 09)'
--   rodotracker_obras.id = '99a8ba7d-1b26-4d19-a983-379d46ac86aa' (com 25 atividades)
--
-- Objetivo:
--   - Manter o id '99a8ba7d-...' (que já carrega as atividades).
--   - Renomeá-lo pra '009 - Manutenção de Rodovia BR-364 (Lote - 09)' nos dois lados.
--   - Apagar a duplicata 'mlpj5f26avttp' (após mover qualquer FK que
--     ainda esteja apontando pra ela em tabelas filhas do cadastros).
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_keep_id   text := '99a8ba7d-1b26-4d19-a983-379d46ac86aa';
  v_drop_id   text := 'mlpj5f26avttp';
  v_canonical text := '009 - Manutenção de Rodovia BR-364 (Lote - 09)';
BEGIN
  -- 1. Confere se as duas linhas existem; se não, sai sem erro.
  IF NOT EXISTS (SELECT 1 FROM obras WHERE id = v_keep_id) THEN
    RAISE NOTICE 'Linha "keep" (id=%) não existe — nada a fazer.', v_keep_id;
    RETURN;
  END IF;

  -- 2. Renomeia a linha que vai permanecer (em ambas as tabelas).
  UPDATE obras
     SET nome = v_canonical
   WHERE id = v_keep_id
     AND nome <> v_canonical;
  RAISE NOTICE 'obras renomeada: id=% -> "%"', v_keep_id, v_canonical;

  UPDATE rodotracker_obras
     SET name = v_canonical,
         updated_at = (extract(epoch from now()) * 1000)::bigint
   WHERE id = v_keep_id
     AND name <> v_canonical;
  RAISE NOTICE 'rodotracker_obras renomeada: id=% -> "%"', v_keep_id, v_canonical;

  -- 3. Move FKs em tabelas filhas do cadastros que possam apontar pra
  --    a duplicata (mesmo que atualmente estejam todas vazias).
  --    Se alguma tabela não existir no schema, os UPDATEs são apenas
  --    no-ops; rodamos cada uma com IF EXISTS protegendo.
  IF EXISTS (SELECT 1 FROM obras WHERE id = v_drop_id) THEN
    -- etapas (tabela legacy do cadastros — pode ter ficado vazia)
    BEGIN
      EXECUTE 'UPDATE etapas SET obra_id = $1 WHERE obra_id = $2' USING v_keep_id, v_drop_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    BEGIN
      EXECUTE 'UPDATE depositos SET obra_id = $1 WHERE obra_id = $2' USING v_keep_id, v_drop_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    BEGIN
      EXECUTE 'UPDATE depositos_material SET obra_id = $1 WHERE obra_id = $2' USING v_keep_id, v_drop_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    BEGIN
      EXECUTE 'UPDATE abastecimentos SET obra_id = $1 WHERE obra_id = $2' USING v_keep_id, v_drop_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    BEGIN
      EXECUTE 'UPDATE entradas_combustivel SET obra_id = $1 WHERE obra_id = $2' USING v_keep_id, v_drop_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    BEGIN
      EXECUTE 'UPDATE entradas_material SET obra_id = $1 WHERE obra_id = $2' USING v_keep_id, v_drop_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    BEGIN
      EXECUTE 'UPDATE saidas_material SET obra_id = $1 WHERE obra_id = $2' USING v_keep_id, v_drop_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    BEGIN
      EXECUTE 'UPDATE fretes SET obra_id = $1 WHERE obra_id = $2' USING v_keep_id, v_drop_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    BEGIN
      EXECUTE 'UPDATE pedidos_compra SET obra_id = $1 WHERE obra_id = $2' USING v_keep_id, v_drop_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    BEGIN
      EXECUTE 'UPDATE pedidos_material SET obra_id = $1 WHERE obra_id = $2' USING v_keep_id, v_drop_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    BEGIN
      EXECUTE 'UPDATE apontamentos SET obra_id = $1 WHERE obra_id = $2' USING v_keep_id, v_drop_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    BEGIN
      EXECUTE 'UPDATE registros_horas_diaristas SET obra_id = $1 WHERE obra_id = $2' USING v_keep_id, v_drop_id;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
    -- Por garantia, rodotracker_* também (não devem casar com v_drop_id pois nunca houve essa obra na medição).
    UPDATE rodotracker_activities    SET obra_id = v_keep_id WHERE obra_id = v_drop_id;
    UPDATE rodotracker_contract_items SET obra_id = v_keep_id WHERE obra_id = v_drop_id;
    UPDATE rodotracker_plan_items    SET obra_id = v_keep_id WHERE obra_id = v_drop_id;
    UPDATE rodotracker_medicao       SET obra_id = v_keep_id WHERE obra_id = v_drop_id;

    -- 4. Apaga a duplicata.
    DELETE FROM rodotracker_obras WHERE id = v_drop_id;
    DELETE FROM obras             WHERE id = v_drop_id;
    RAISE NOTICE 'Duplicata id=% apagada.', v_drop_id;
  ELSE
    RAISE NOTICE 'Duplicata id=% não existe — possivelmente já apagada.', v_drop_id;
  END IF;

  RAISE NOTICE 'Unificação BR-364 Lote 09 concluída. id master = %', v_keep_id;
END $$;

COMMIT;

-- ─── Verificação ───────────────────────────────────────────────────────────
-- Após COMMIT, esta query deve mostrar UMA linha do cadastros e UMA da medição
-- com o mesmo id e nome canônico:
-- SELECT 'cadastros' AS fonte, id::text, nome AS name FROM obras WHERE id = '99a8ba7d-1b26-4d19-a983-379d46ac86aa'
-- UNION ALL
-- SELECT 'medição',          id::text, name        FROM rodotracker_obras WHERE id = '99a8ba7d-1b26-4d19-a983-379d46ac86aa';
