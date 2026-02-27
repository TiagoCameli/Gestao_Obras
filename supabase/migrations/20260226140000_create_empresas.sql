-- Criar tabela empresas
CREATE TABLE IF NOT EXISTS empresas (
  id text PRIMARY KEY,
  nome text NOT NULL,
  cnpj text NOT NULL DEFAULT '',
  endereco text NOT NULL DEFAULT '',
  area_atuacao text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  criado_por text NOT NULL DEFAULT ''
);

ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON empresas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Alterar colaboradores: trocar FK de fornecedores para empresas
ALTER TABLE colaboradores DROP CONSTRAINT IF EXISTS colaboradores_fornecedor_id_fkey;
ALTER TABLE colaboradores RENAME COLUMN fornecedor_id TO empresa_id;
ALTER TABLE colaboradores ADD CONSTRAINT colaboradores_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES empresas(id);
