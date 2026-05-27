-- supabase/migrations/20260526190100_activities_estaca_fracao_nomenclatura_rollback.sql
DROP INDEX IF EXISTS idx_rodotracker_activities_nomenclatura;
ALTER TABLE rodotracker_activities
  DROP COLUMN IF EXISTS nomenclatura,
  DROP COLUMN IF EXISTS fracao,
  DROP COLUMN IF EXISTS estaca;
