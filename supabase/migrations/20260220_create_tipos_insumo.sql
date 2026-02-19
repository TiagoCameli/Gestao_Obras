CREATE TABLE IF NOT EXISTS tipos_insumo (
  id text PRIMARY KEY,
  nome text NOT NULL,
  valor text NOT NULL UNIQUE,
  ativo boolean DEFAULT true,
  criado_por text
);

ALTER TABLE tipos_insumo DISABLE ROW LEVEL SECURITY;

INSERT INTO tipos_insumo (id, nome, valor, ativo) VALUES
  (gen_random_uuid()::text, 'Combustível', 'combustivel', true),
  (gen_random_uuid()::text, 'Material', 'material', true);
