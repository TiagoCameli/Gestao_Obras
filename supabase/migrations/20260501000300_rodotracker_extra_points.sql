-- Pontos extras de uma atividade. Usado por Sinalização (várias placas
-- num mesmo registro). Estrutura: [[lat, lng], ...]

ALTER TABLE public.rodotracker_activities
  ADD COLUMN IF NOT EXISTS extra_points jsonb;
