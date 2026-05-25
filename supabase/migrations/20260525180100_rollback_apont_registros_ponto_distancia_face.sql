-- ROLLBACK da 20260525180000. Drop trivial (coluna nullable, sem FK).
ALTER TABLE public.apont_registros_ponto DROP COLUMN IF EXISTS distancia_face;
