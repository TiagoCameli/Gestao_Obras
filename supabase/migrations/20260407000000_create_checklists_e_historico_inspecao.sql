-- Tabela de checklists de equipamentos (máquinas e caminhões)
CREATE TABLE IF NOT EXISTS checklists_equipamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_id TEXT NOT NULL REFERENCES equipamentos(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  unidade TEXT NOT NULL DEFAULT '',
  area_inspecao TEXT NOT NULL DEFAULT '',
  turnos JSONB NOT NULL DEFAULT '[]'::jsonb,
  respostas JSONB NOT NULL DEFAULT '{}'::jsonb,
  observacoes TEXT NOT NULL DEFAULT '',
  criado_por TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE checklists_equipamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checklists_equipamento_all" ON checklists_equipamento FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabela de histórico de inspeção
CREATE TABLE IF NOT EXISTS historico_inspecao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_id TEXT NOT NULL REFERENCES equipamentos(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  horario TEXT NOT NULL DEFAULT '',
  descricao TEXT NOT NULL DEFAULT '',
  providencia TEXT NOT NULL DEFAULT '',
  operador TEXT NOT NULL DEFAULT '',
  encarregado TEXT NOT NULL DEFAULT '',
  criado_por TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE historico_inspecao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "historico_inspecao_all" ON historico_inspecao FOR ALL TO authenticated USING (true) WITH CHECK (true);
