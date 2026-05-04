-- Corrige FK de apont_equipe_obras.obra_id: passa a referenciar a tabela
-- mestre `obras` (cadastros) ao invés de `rodotracker_obras`. Obras só
-- existem em rodotracker depois que alguém abre a obra na Medição;
-- a master é a fonte canônica.

ALTER TABLE public.apont_equipe_obras
  DROP CONSTRAINT IF EXISTS apont_equipe_obras_obra_id_fkey;

ALTER TABLE public.apont_equipe_obras
  ADD CONSTRAINT apont_equipe_obras_obra_id_fkey
  FOREIGN KEY (obra_id) REFERENCES public.obras(id) ON DELETE CASCADE;
