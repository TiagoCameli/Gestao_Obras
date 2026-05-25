-- Adiciona coluna pra registrar a distância euclidiana do match facial
-- de cada batida. Usada pra calibrar threshold com dados reais.
--
-- Spec: docs/superpowers/specs/2026-05-25-face-recognition-speed-accuracy-design.md
-- Rollback: 20260525180100_rollback_apont_registros_ponto_distancia_face.sql

ALTER TABLE public.apont_registros_ponto
  ADD COLUMN IF NOT EXISTS distancia_face numeric NULL;

COMMENT ON COLUMN public.apont_registros_ponto.distancia_face IS
  'Distância euclidiana entre frame capturado e melhor referência facial. NULL pra batidas manuais. Threshold atual: 0.55 (match se < threshold). Usada pra calibrar threshold com dados reais.';
