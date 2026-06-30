-- Tipos de óleo (apoio do caderno de serviços). Cada tipo carrega o intervalo
-- de troca em meses (null = sem alerta). Alerta de troca é por (equipamento, tipo).
CREATE TABLE IF NOT EXISTS public.tipos_oleo (
  id            text PRIMARY KEY,
  nome          text NOT NULL,
  aplicacao     text NOT NULL CHECK (aplicacao IN ('motor','hidraulico','transmissao','diferencial','graxa','outro')),
  intervalo_meses int CHECK (intervalo_meses IS NULL OR intervalo_meses > 0),
  ativo         boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    text
);
ALTER TABLE public.tipos_oleo ENABLE ROW LEVEL SECURITY;

CREATE POLICY tipos_oleo_select ON public.tipos_oleo FOR SELECT
  USING (private.current_has_action('ver_manutencao'));
CREATE POLICY tipos_oleo_insert ON public.tipos_oleo FOR INSERT
  WITH CHECK (private.current_has_action('gerenciar_tipos_oleo'));
CREATE POLICY tipos_oleo_update ON public.tipos_oleo FOR UPDATE
  USING (private.current_has_action('gerenciar_tipos_oleo'));
CREATE POLICY tipos_oleo_delete ON public.tipos_oleo FOR DELETE
  USING (private.current_has_action('gerenciar_tipos_oleo'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tipos_oleo TO authenticated;

INSERT INTO public.tipos_oleo (id, nome, aplicacao, intervalo_meses) VALUES
  ('toleo_motor_15w40', 'Óleo de Motor 15W40', 'motor', 6),
  ('toleo_hidraulico_68', 'Óleo Hidráulico 68', 'hidraulico', 12),
  ('toleo_transmissao_85w140', 'Óleo de Transmissão 85W140', 'transmissao', 12),
  ('toleo_diferencial', 'Óleo de Diferencial', 'diferencial', 12),
  ('toleo_atf', 'ATF (transmissão automática)', 'transmissao', 12),
  ('toleo_graxa', 'Graxa', 'graxa', NULL)
ON CONFLICT (id) DO NOTHING;
