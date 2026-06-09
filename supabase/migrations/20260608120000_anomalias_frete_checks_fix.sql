-- Aba de Anomalias do Frete — tabela de verificação ("marcar como verificada").
-- id = id determinístico da anomalia (ex: "F1-<freteId>", "F4-nf-<nf>").
-- RLS gated na ação JÁ EXISTENTE 'ver_frete' (sem chave de ação nova, sem backfill).

CREATE TABLE IF NOT EXISTS public.anomalias_frete_checks (
  id          text primary key,
  checked_at  timestamptz not null default now(),
  checked_by  text,
  motivo      text,
  created_at  timestamptz not null default now()
);

ALTER TABLE public.anomalias_frete_checks ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.anomalias_frete_checks TO authenticated;

CREATE POLICY "anomalias_frete_checks_select"
  ON public.anomalias_frete_checks FOR SELECT TO authenticated
  USING (private.current_has_action('ver_frete'));

CREATE POLICY "anomalias_frete_checks_insert"
  ON public.anomalias_frete_checks FOR INSERT TO authenticated
  WITH CHECK (private.current_has_action('ver_frete'));

CREATE POLICY "anomalias_frete_checks_update"
  ON public.anomalias_frete_checks FOR UPDATE TO authenticated
  USING (private.current_has_action('ver_frete'))
  WITH CHECK (private.current_has_action('ver_frete'));

CREATE POLICY "anomalias_frete_checks_delete"
  ON public.anomalias_frete_checks FOR DELETE TO authenticated
  USING (private.current_has_action('ver_frete'));
