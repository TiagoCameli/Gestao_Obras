-- Create abastecimentos_carreta table
CREATE TABLE IF NOT EXISTS abastecimentos_carreta (
  id text PRIMARY KEY,
  data text NOT NULL,
  transportadora text NOT NULL DEFAULT '',
  placa_carreta text NOT NULL DEFAULT '',
  tipo_combustivel text NOT NULL DEFAULT '',
  quantidade_litros numeric NOT NULL DEFAULT 0,
  valor_unidade numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  observacoes text NOT NULL DEFAULT '',
  criado_por text NOT NULL DEFAULT ''
);

ALTER TABLE abastecimentos_carreta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON abastecimentos_carreta FOR ALL TO authenticated USING (true) WITH CHECK (true);
