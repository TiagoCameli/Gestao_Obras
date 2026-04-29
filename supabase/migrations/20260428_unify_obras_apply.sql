-- ============================================================
-- APPLY — APLICA AS MUDANÇAS. RODE SOMENTE APÓS REVISAR O DRY RUN.
-- Tudo dentro de uma transação: se algo falhar, ROLLBACK automático.
--
-- O que faz, na ordem:
--   (1) Cria linha em `obras` para cada `rodotracker_obras` órfão (mantém o mesmo id).
--   (2) Para pares casados por nome com IDs diferentes:
--         a. atualiza FKs em activities, contract_items, plan_items, medicao
--            para apontar para obras.id;
--         b. realinha rodotracker_obras.id para obras.id (DELETE + INSERT
--            preservando os campos geo).
--   (3) (Opcional, comentado) FK constraint formal entre as duas tabelas.
-- ============================================================

BEGIN;

-- ─── (1) Cria obras para rodotracker_obras órfãos (mesmo id) ──────────────
INSERT INTO obras (id, nome, endereco, status, data_inicio, data_previsao_fim,
                   responsavel, orcamento, criado_por)
SELECT
  r.id,
  r.name,
  COALESCE(r.contrato, '')                                   AS endereco,
  'em_andamento'                                              AS status,
  ''                                                          AS data_inicio,
  ''                                                          AS data_previsao_fim,
  ''                                                          AS responsavel,
  0                                                           AS orcamento,
  'sistema (migração)'                                        AS criado_por
FROM rodotracker_obras r
WHERE NOT EXISTS (
  SELECT 1 FROM obras o
  WHERE lower(regexp_replace(o.nome, '[^a-zA-Z0-9]', '', 'g'))
      = lower(regexp_replace(r.name, '[^a-zA-Z0-9]', '', 'g'))
)
ON CONFLICT (id) DO NOTHING;

-- ─── (2) Para pares casados com IDs diferentes, mover FKs e realinhar id ──
-- Materializa o mapa para reuso (CTE pode não ser visível em todos os UPDATEs)
DROP TABLE IF EXISTS _id_remap;
CREATE TEMP TABLE _id_remap AS
SELECT r.id AS old_id, o.id AS new_id, r.* AS old_row
FROM rodotracker_obras r
JOIN obras o ON lower(regexp_replace(o.nome, '[^a-zA-Z0-9]', '', 'g'))
              = lower(regexp_replace(r.name, '[^a-zA-Z0-9]', '', 'g'))
WHERE r.id <> o.id;

-- 2a. Atualiza foreign keys nas tabelas filhas
UPDATE rodotracker_activities a
   SET obra_id = m.new_id
  FROM _id_remap m
 WHERE a.obra_id = m.old_id;

UPDATE rodotracker_contract_items c
   SET obra_id = m.new_id
  FROM _id_remap m
 WHERE c.obra_id = m.old_id;

UPDATE rodotracker_plan_items p
   SET obra_id = m.new_id
  FROM _id_remap m
 WHERE p.obra_id = m.old_id;

UPDATE rodotracker_medicao mc
   SET obra_id = m.new_id
  FROM _id_remap m
 WHERE mc.obra_id = m.old_id;

-- 2b. Realinha rodotracker_obras.id (DELETE + INSERT pra evitar conflito de PK)
DELETE FROM rodotracker_obras r
 USING _id_remap m
 WHERE r.id = m.old_id;

INSERT INTO rodotracker_obras (
  id, user_id, name, tipo_obra, rodovia, lote, trecho, contrato,
  km_inicial, km_final, center_lat, center_lng, zoom,
  start_lat, start_lng, end_lat, end_lng, route_geojson, extension_km,
  created_at, updated_at
)
SELECT
  m.new_id,
  -- user_id pode não existir em _id_remap dependendo do schema; pegamos
  -- o user_id dum admin via subquery. Se não existir essa coluna, comente esta linha.
  (SELECT user_id FROM _id_remap WHERE old_id = m.old_id LIMIT 1),
  (m.old_row).name,
  (m.old_row).tipo_obra,
  (m.old_row).rodovia,
  (m.old_row).lote,
  (m.old_row).trecho,
  (m.old_row).contrato,
  (m.old_row).km_inicial,
  (m.old_row).km_final,
  (m.old_row).center_lat,
  (m.old_row).center_lng,
  (m.old_row).zoom,
  (m.old_row).start_lat,
  (m.old_row).start_lng,
  (m.old_row).end_lat,
  (m.old_row).end_lng,
  (m.old_row).route_geojson,
  (m.old_row).extension_km,
  (m.old_row).created_at,
  (m.old_row).updated_at
FROM _id_remap m;

DROP TABLE _id_remap;

-- ─── (3) FK formal entre rodotracker_obras e obras (opcional) ─────────────
-- Descomente se quiser garantir referencial integrity para o futuro.
-- ALTER TABLE rodotracker_obras
--   ADD CONSTRAINT rodotracker_obras_id_fkey
--   FOREIGN KEY (id) REFERENCES obras(id) ON DELETE CASCADE;

COMMIT;

-- ─── Verificação pós-migração ─────────────────────────────────────────────
-- (Roda manualmente após o COMMIT.)
-- SELECT count(*) FROM rodotracker_obras r WHERE NOT EXISTS (SELECT 1 FROM obras o WHERE o.id = r.id);
--   -- Deve retornar 0.
-- SELECT count(*) FROM rodotracker_activities WHERE obra_id NOT IN (SELECT id FROM obras);
--   -- Deve retornar 0.
-- SELECT count(*) FROM rodotracker_contract_items WHERE obra_id NOT IN (SELECT id FROM obras);
--   -- Deve retornar 0.
