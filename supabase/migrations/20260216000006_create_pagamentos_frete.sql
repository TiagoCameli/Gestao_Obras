-- Pagamentos de Frete (por transportadora/mes)
CREATE TABLE IF NOT EXISTS pagamentos_frete (
  id text PRIMARY KEY,
  data text NOT NULL,
  transportadora text NOT NULL,
  mes_referencia text NOT NULL DEFAULT '',
  valor numeric NOT NULL DEFAULT 0,
  metodo text NOT NULL DEFAULT 'pix',
  quantidade_combustivel numeric NOT NULL DEFAULT 0,
  responsavel text NOT NULL DEFAULT '',
  nota_fiscal text NOT NULL DEFAULT '',
  observacoes text NOT NULL DEFAULT ''
);

ALTER TABLE pagamentos_frete ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON pagamentos_frete FOR ALL TO authenticated USING (true) WITH CHECK (true);
