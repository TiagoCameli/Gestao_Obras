-- Tabela de Apontamentos (clock-in / clock-out)
CREATE TABLE IF NOT EXISTS apontamentos (
  id text PRIMARY KEY,
  data text NOT NULL,
  hora_inicio text NOT NULL,
  hora_fim text NOT NULL DEFAULT '',
  obra_id text NOT NULL REFERENCES obras(id),
  etapa_obra_id text NOT NULL REFERENCES etapas_obra(id),
  equipamento_id text REFERENCES equipamentos(id),
  colaborador_id text REFERENCES colaboradores(id),
  tipo text NOT NULL,
  horas_trabalhadas numeric NOT NULL DEFAULT 0,
  observacoes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'aberto',
  criado_por text NOT NULL DEFAULT ''
);

ALTER TABLE apontamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON apontamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
