-- Tabela para tipos de equipamento dinâmicos
CREATE TABLE IF NOT EXISTS tipos_equipamento (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  codigo TEXT NOT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  criado_por TEXT DEFAULT ''
);

-- Seed com os tipos padrão
INSERT INTO tipos_equipamento (id, nome, codigo, ativo, criado_por) VALUES
  ('te_carro', 'Carro', 'VL', true, 'sistema'),
  ('te_moto', 'Moto', 'MT', true, 'sistema'),
  ('te_trator_pneu', 'Trator de Pneu', 'TRP', true, 'sistema'),
  ('te_trator_esteira', 'Trator de Esteira', 'TRE', true, 'sistema'),
  ('te_escavadeira', 'Escavadeira Hidráulica', 'EH', true, 'sistema'),
  ('te_retroescavadeira', 'Retroescavadeira', 'RT', true, 'sistema'),
  ('te_motoniveladora', 'Motoniveladora', 'MN', true, 'sistema'),
  ('te_pa_carregadeira', 'Pá Carregadeira', 'PC', true, 'sistema'),
  ('te_caminhao_basculante', 'Caminhão Basculante', 'CB', true, 'sistema'),
  ('te_semirreboque', 'Semirreboque', 'CS', true, 'sistema'),
  ('te_minicarregadeira', 'Minicarregadeira', 'MC', true, 'sistema'),
  ('te_rolo_pe_carneiro', 'Rolo Pé de Carneiro', 'RPC', true, 'sistema'),
  ('te_vibroacabadora', 'Vibroacabadora', 'VB', true, 'sistema'),
  ('te_caminhao_espargidor', 'Caminhão Espargidor', 'CE', true, 'sistema'),
  ('te_caminhao_pipa', 'Caminhão Pipa', 'CP', true, 'sistema'),
  ('te_telescopio', 'Telescópio de Elevação', 'TE', true, 'sistema'),
  ('te_rolo_pneu', 'Rolo de Pneu', 'RP', true, 'sistema'),
  ('te_rolo_chapa', 'Rolo Chapa', 'RC', true, 'sistema'),
  ('te_caminhao_munck', 'Caminhão Munck', 'CM', true, 'sistema'),
  ('te_caminhao_betoneira', 'Caminhão Betoneira', 'CBT', true, 'sistema'),
  ('te_meloza', 'Meloza', 'MZ', true, 'sistema'),
  ('te_implementos', 'Implementos', 'IMP', true, 'sistema'),
  ('te_caminhao_pintura', 'Caminhão de Pintura', 'CPT', true, 'sistema'),
  ('te_usina_asfalto', 'Usina de Asfalto', 'UA', true, 'sistema')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE tipos_equipamento ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "tipos_equipamento_select" ON tipos_equipamento
  FOR SELECT TO authenticated USING (true);

-- Allow authenticated users to insert
CREATE POLICY "tipos_equipamento_insert" ON tipos_equipamento
  FOR INSERT TO authenticated WITH CHECK (true);

-- Allow authenticated users to update
CREATE POLICY "tipos_equipamento_update" ON tipos_equipamento
  FOR UPDATE TO authenticated USING (true);

-- Allow authenticated users to delete
CREATE POLICY "tipos_equipamento_delete" ON tipos_equipamento
  FOR DELETE TO authenticated USING (true);
