-- ============================================================
-- DRY RUN — só LÊ, não modifica nada.
-- Roda este arquivo PRIMEIRO no SQL Editor do Supabase.
-- Revise os 3 SELECTs abaixo antes de aplicar a migração de fato.
-- ============================================================

-- 1. Pares casados por nome (após normalização: lowercase + remoção de não-alfanuméricos).
--    Para cada par com IDs diferentes, a migração vai realinhar todas as FKs
--    de rodotracker_* para apontar para obras.id (mantendo obras.id como master).
WITH normalized AS (
  SELECT
    o.id          AS obras_id,
    o.nome        AS obras_nome,
    r.id          AS rodo_id,
    r.name        AS rodo_name,
    lower(regexp_replace(o.nome, '[^a-zA-Z0-9]', '', 'g')) AS norm_obras,
    lower(regexp_replace(r.name, '[^a-zA-Z0-9]', '', 'g')) AS norm_rodo
  FROM obras o
  CROSS JOIN rodotracker_obras r
)
SELECT
  obras_nome,
  rodo_name,
  obras_id,
  rodo_id,
  CASE WHEN obras_id = rodo_id THEN 'já alinhado'
       ELSE 'precisa realinhar' END AS situacao
FROM normalized
WHERE norm_obras = norm_rodo
ORDER BY obras_nome;

-- 2. rodotracker_obras ÓRFÃOS (sem correspondência em obras).
--    Estes ganharão uma nova linha em obras com o MESMO id (sem alteração de FK).
SELECT
  r.id   AS rodo_id,
  r.name AS rodo_name,
  r.tipo_obra,
  r.contrato,
  'criar em obras com mesmo id' AS acao
FROM rodotracker_obras r
WHERE NOT EXISTS (
  SELECT 1 FROM obras o
  WHERE lower(regexp_replace(o.nome, '[^a-zA-Z0-9]', '', 'g'))
      = lower(regexp_replace(r.name, '[^a-zA-Z0-9]', '', 'g'))
);

-- 3. obras sem rodotracker_obras (sem extensão geo).
--    Estas ficam só no cadastros — quando o usuário entrar no módulo de medição
--    pela primeira vez, o app vai criar a extensão geo automaticamente.
SELECT
  o.id   AS obras_id,
  o.nome AS obras_nome,
  'sem extensão de medição (ok, criada sob demanda)' AS situacao
FROM obras o
WHERE NOT EXISTS (
  SELECT 1 FROM rodotracker_obras r
  WHERE lower(regexp_replace(r.name, '[^a-zA-Z0-9]', '', 'g'))
      = lower(regexp_replace(o.nome, '[^a-zA-Z0-9]', '', 'g'))
);
