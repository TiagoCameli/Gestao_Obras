-- Tabela de Sequencias de Diarias
CREATE TABLE IF NOT EXISTS sequencias_diarias (
  id text PRIMARY KEY,
  obra_id text NOT NULL REFERENCES obras(id),
  nome_diarista text NOT NULL DEFAULT '',
  telefone text NOT NULL DEFAULT '',
  valor_diaria numeric(10,2) NOT NULL DEFAULT 0,
  detalhes_servico text NOT NULL DEFAULT '',
  observacoes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'aberta',
  data_abertura date NOT NULL DEFAULT CURRENT_DATE,
  data_fechamento date,
  pago boolean NOT NULL DEFAULT false,
  data_pagamento date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sequencias_diarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON sequencias_diarias FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tabela de Registros de Horas de Diaristas
CREATE TABLE IF NOT EXISTS registros_horas_diaristas (
  id text PRIMARY KEY,
  sequencia_id text NOT NULL REFERENCES sequencias_diarias(id) ON DELETE CASCADE,
  obra_id text NOT NULL REFERENCES obras(id),
  etapa_id text NOT NULL REFERENCES etapas_obra(id),
  data date NOT NULL,
  horas numeric(4,1) NOT NULL DEFAULT 0,
  descricao text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE registros_horas_diaristas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON registros_horas_diaristas FOR ALL TO authenticated USING (true) WITH CHECK (true);
