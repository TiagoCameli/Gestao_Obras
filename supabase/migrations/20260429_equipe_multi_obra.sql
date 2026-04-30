-- ============================================================
-- Equipe → várias obras (M:N).
--
-- 1) Cria a junção apont_equipe_obras (equipe_id × obra_id).
-- 2) Backfill com a obra atual de cada equipe.
-- 3) Torna apont_equipes.obra_id NULLable (mantida como obra "principal"
--    para retro-compatibilidade enquanto o app migra; ignorada na lógica
--    de filtro a partir de agora).
--
-- Idempotente.
-- ============================================================

BEGIN;

-- (1) Junção
CREATE TABLE IF NOT EXISTS public.apont_equipe_obras (
  equipe_id  uuid NOT NULL REFERENCES public.apont_equipes(id) ON DELETE CASCADE,
  obra_id    text NOT NULL REFERENCES public.rodotracker_obras(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (equipe_id, obra_id)
);

CREATE INDEX IF NOT EXISTS apont_equipe_obras_obra_idx
  ON public.apont_equipe_obras(obra_id);

-- (2) Backfill
INSERT INTO public.apont_equipe_obras (equipe_id, obra_id)
SELECT id, obra_id
  FROM public.apont_equipes
 WHERE obra_id IS NOT NULL
ON CONFLICT (equipe_id, obra_id) DO NOTHING;

-- (3) Permitir equipe sem obra principal
ALTER TABLE public.apont_equipes
  ALTER COLUMN obra_id DROP NOT NULL;

COMMIT;
