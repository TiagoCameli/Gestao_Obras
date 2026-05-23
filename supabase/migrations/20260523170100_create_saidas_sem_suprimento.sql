-- =============================================================================
-- FI.1b — Tabela saidas_sem_suprimento (auditoria de saídas órfãs FIFO)
-- =============================================================================
-- Quando FIFO não encontra entrada/transferência anterior pra suprir uma
-- saída, registra aqui pra revisão do usuário. Típico: saídas históricas
-- migradas sem estoque inicial formalizado.
--
-- Convention wall-clock (pós-pivot 2026-05-23):
--   data_saida   -> timestamp without time zone (espelha saidas_combustivel.data)
--   detectado_em -> timestamptz (system metadata, igual created_at em outras tabelas)
--   revisado_em  -> timestamptz (system metadata)

CREATE TABLE IF NOT EXISTS public.saidas_sem_suprimento (
  id text PRIMARY KEY DEFAULT 'sss-' || gen_random_uuid()::text,
  saida_id text NOT NULL,
  tanque_id text NOT NULL,
  data_saida timestamp NOT NULL,
  litros_solicitados numeric NOT NULL,
  litros_supridos numeric NOT NULL DEFAULT 0,
  litros_sem_suprimento numeric NOT NULL,
  observacao text DEFAULT 'Saída anterior a qualquer entrada/transferência registrada no tanque',
  detectado_em timestamptz NOT NULL DEFAULT now(),
  revisado boolean NOT NULL DEFAULT false,
  revisado_por text,
  revisado_em timestamptz,
  CONSTRAINT fk_sss_saida
    FOREIGN KEY (saida_id) REFERENCES public.saidas_combustivel(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sss_tanque ON public.saidas_sem_suprimento(tanque_id, data_saida);
CREATE INDEX IF NOT EXISTS idx_sss_nao_revisados
  ON public.saidas_sem_suprimento(detectado_em) WHERE NOT revisado;

ALTER TABLE public.saidas_sem_suprimento ENABLE ROW LEVEL SECURITY;

-- Auditoria: leitura aberta a quem vê frota; mutations admin-only.
CREATE POLICY sss_select ON public.saidas_sem_suprimento
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_frota'));

CREATE POLICY sss_admin_all ON public.saidas_sem_suprimento
  FOR ALL TO authenticated
  USING (private.current_has_action('gerenciar_permissoes'))
  WITH CHECK (private.current_has_action('gerenciar_permissoes'));
