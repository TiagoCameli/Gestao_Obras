-- Coluna jsonb para armazenar quantitativos por item de contrato em
-- atividades de Sinalização Vertical. Estrutura:
--   { medicaoNumber: number, contributions: { "<code>": number } }

ALTER TABLE public.rodotracker_activities
  ADD COLUMN IF NOT EXISTS sinalizacao_vertical jsonb;
