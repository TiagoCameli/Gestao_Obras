CREATE TABLE IF NOT EXISTS colaboradores (
  id text PRIMARY KEY,
  nome text NOT NULL,
  fornecedor_id text NOT NULL REFERENCES fornecedores(id),
  data_nascimento text NOT NULL DEFAULT '',
  data_ingresso text NOT NULL DEFAULT '',
  telefone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  altura text NOT NULL DEFAULT '',
  tamanho_camisa text NOT NULL DEFAULT '',
  tamanho_calca text NOT NULL DEFAULT '',
  tamanho_sapato text NOT NULL DEFAULT '',
  endereco text NOT NULL DEFAULT '',
  cpf text NOT NULL DEFAULT '',
  rg text NOT NULL DEFAULT '',
  observacoes text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  criado_por text NOT NULL DEFAULT ''
);

ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON colaboradores FOR ALL TO authenticated USING (true) WITH CHECK (true);
