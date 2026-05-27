-- supabase/migrations/20260526190000_activities_estaca_fracao_nomenclatura_fix.sql
ALTER TABLE rodotracker_activities
  ADD COLUMN estaca text NULL,
  ADD COLUMN fracao text NULL,
  ADD COLUMN nomenclatura text NULL;

CREATE INDEX idx_rodotracker_activities_nomenclatura
  ON rodotracker_activities (obra_id, medicao, nomenclatura)
  WHERE nomenclatura IS NOT NULL;
