-- =============================================================================
-- FI.1a — Tabela saidas_lotes (detalhamento FIFO por porção de lote consumida)
-- =============================================================================
-- Cada linha = uma porção de lote consumida por uma saída.
-- Ex: saída de 100L que pega 70L do lote A (R$ 5,50) + 30L do lote B (R$ 6,00):
--   (saida_id=S, fonte_tipo='entrada', fonte_id=A, litros=70, preco_lote=5.50)
--   (saida_id=S, fonte_tipo='entrada', fonte_id=B, litros=30, preco_lote=6.00)
--
-- Fonte = entradas_combustivel (compra) OU transferencias_combustivel (lote
-- derivado de outro tanque). preco_lote registra o preço daquela porção no
-- momento do consumo (snapshot imutável).

CREATE TABLE IF NOT EXISTS public.saidas_lotes (
  id text PRIMARY KEY DEFAULT 'sl-' || gen_random_uuid()::text,
  saida_id text NOT NULL,
  fonte_tipo text NOT NULL CHECK (fonte_tipo IN ('entrada', 'transferencia')),
  fonte_id text NOT NULL,
  litros numeric NOT NULL CHECK (litros > 0),
  preco_lote numeric NOT NULL CHECK (preco_lote >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_saidas_lotes_saida
    FOREIGN KEY (saida_id) REFERENCES public.saidas_combustivel(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_saidas_lotes_saida_id ON public.saidas_lotes(saida_id);
CREATE INDEX IF NOT EXISTS idx_saidas_lotes_fonte ON public.saidas_lotes(fonte_tipo, fonte_id);

ALTER TABLE public.saidas_lotes ENABLE ROW LEVEL SECURITY;

-- Mirror das policies de saidas_combustivel:
--   SELECT  -> ver_frota
--   INSERT  -> criar_saida_combustivel OR criar_abastecimento_carreta
--   UPDATE  -> editar_combustivel
--   DELETE  -> excluir_combustivel
-- UPDATE/DELETE existem para correções administrativas, mas em uso normal as
-- linhas de saidas_lotes são snapshot imutável (criadas via RPC FIFO).

CREATE POLICY saidas_lotes_select ON public.saidas_lotes
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_frota'));

CREATE POLICY saidas_lotes_insert ON public.saidas_lotes
  FOR INSERT TO authenticated
  WITH CHECK (
    private.current_has_action('criar_saida_combustivel')
    OR private.current_has_action('criar_abastecimento_carreta')
  );

CREATE POLICY saidas_lotes_update ON public.saidas_lotes
  FOR UPDATE TO authenticated
  USING (private.current_has_action('editar_combustivel'))
  WITH CHECK (private.current_has_action('editar_combustivel'));

CREATE POLICY saidas_lotes_delete ON public.saidas_lotes
  FOR DELETE TO authenticated
  USING (private.current_has_action('excluir_combustivel'));
