CREATE TABLE pedidos_material (
  id text PRIMARY KEY,
  data text NOT NULL,
  fornecedor_id text NOT NULL DEFAULT '',
  itens jsonb NOT NULL DEFAULT '[]',
  observacoes text NOT NULL DEFAULT '',
  criado_por text NOT NULL DEFAULT ''
);

ALTER TABLE pedidos_material ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON pedidos_material FOR ALL TO authenticated USING (true) WITH CHECK (true);
