CREATE TABLE IF NOT EXISTS fretes (
  id text PRIMARY KEY,
  data text NOT NULL,
  obra_id text REFERENCES obras(id) ON DELETE SET NULL,
  origem text NOT NULL DEFAULT '',
  destino text NOT NULL DEFAULT '',
  transportadora text NOT NULL DEFAULT '',
  insumo_id text NOT NULL REFERENCES insumos(id) ON DELETE RESTRICT,
  peso_toneladas numeric NOT NULL DEFAULT 0,
  km_rodados numeric NOT NULL DEFAULT 0,
  valor_tkm numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  nota_fiscal text NOT NULL DEFAULT '',
  observacoes text NOT NULL DEFAULT ''
);

ALTER TABLE fretes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON fretes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
