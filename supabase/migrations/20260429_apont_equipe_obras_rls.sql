-- ============================================================
-- RLS para a junção apont_equipe_obras (faltou na migração anterior).
-- Mesmo padrão das outras tabelas do módulo: authenticated tem acesso
-- total (USING + WITH CHECK true).
-- ============================================================

ALTER TABLE public.apont_equipe_obras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated full access" ON public.apont_equipe_obras;

CREATE POLICY "Authenticated full access"
  ON public.apont_equipe_obras
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
