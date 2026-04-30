-- ============================================================
-- Aprovação diária POR FUNCIONÁRIO (vs apont_aprovacao_dia que é
-- por equipe). Cada linha = (funcionario_id × data) aprovada.
--   - Sem linha = pendente.
--   - Com linha = aprovado em `aprovado_em` por `aprovado_por_id`.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.apont_aprovacao_funcionario_dia (
  funcionario_id  uuid        NOT NULL REFERENCES public.apont_funcionarios(id) ON DELETE CASCADE,
  data            date        NOT NULL,
  aprovado_em     timestamptz NOT NULL DEFAULT now(),
  aprovado_por_id uuid,
  PRIMARY KEY (funcionario_id, data)
);

CREATE INDEX IF NOT EXISTS apont_aprovacao_func_dia_data_idx
  ON public.apont_aprovacao_funcionario_dia(data);

ALTER TABLE public.apont_aprovacao_funcionario_dia
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated full access"
  ON public.apont_aprovacao_funcionario_dia;
CREATE POLICY "Authenticated full access"
  ON public.apont_aprovacao_funcionario_dia
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
