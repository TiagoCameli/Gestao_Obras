-- ============================================================
-- Gestao Obras — Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ── Enable RLS on all tables ──

-- ── 1. Obras ──
CREATE TABLE IF NOT EXISTS obras (
  id text PRIMARY KEY,
  nome text NOT NULL,
  endereco text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'planejamento',
  data_inicio text NOT NULL DEFAULT '',
  data_previsao_fim text NOT NULL DEFAULT '',
  responsavel text NOT NULL DEFAULT '',
  orcamento numeric NOT NULL DEFAULT 0,
  criado_por text NOT NULL DEFAULT ''
);

ALTER TABLE obras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON obras FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 2. Etapas Obra ──
CREATE TABLE IF NOT EXISTS etapas_obra (
  id text PRIMARY KEY,
  nome text NOT NULL,
  obra_id text NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  unidade text NOT NULL DEFAULT '',
  quantidade numeric NOT NULL DEFAULT 0,
  valor_unitario numeric NOT NULL DEFAULT 0,
  criado_por text NOT NULL DEFAULT ''
);

ALTER TABLE etapas_obra ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON etapas_obra FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 3. Depositos (combustivel) ──
CREATE TABLE IF NOT EXISTS depositos (
  id text PRIMARY KEY,
  nome text NOT NULL,
  obra_id text NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  capacidade_litros numeric NOT NULL DEFAULT 0,
  nivel_atual_litros numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  criado_por text NOT NULL DEFAULT ''
);

ALTER TABLE depositos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON depositos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 4. Unidades de Medida ──
CREATE TABLE IF NOT EXISTS unidades_medida (
  id text PRIMARY KEY,
  nome text NOT NULL,
  sigla text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_por text NOT NULL DEFAULT ''
);

ALTER TABLE unidades_medida ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON unidades_medida FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 5. Insumos ──
CREATE TABLE IF NOT EXISTS insumos (
  id text PRIMARY KEY,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'material',
  unidade text NOT NULL DEFAULT '',
  descricao text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  criado_por text NOT NULL DEFAULT ''
);

ALTER TABLE insumos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON insumos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 6. Fornecedores ──
CREATE TABLE IF NOT EXISTS fornecedores (
  id text PRIMARY KEY,
  nome text NOT NULL,
  cnpj text NOT NULL DEFAULT '',
  telefone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  observacoes text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  criado_por text NOT NULL DEFAULT ''
);

ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON fornecedores FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 7. Equipamentos ──
CREATE TABLE IF NOT EXISTS equipamentos (
  id text PRIMARY KEY,
  nome text NOT NULL,
  codigo_patrimonio text NOT NULL DEFAULT '',
  numero_serie text NOT NULL DEFAULT '',
  ano text NOT NULL DEFAULT '',
  marca text NOT NULL DEFAULT '',
  tipo_medicao text NOT NULL DEFAULT 'horimetro',
  medicao_inicial numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  data_aquisicao text NOT NULL DEFAULT '',
  data_venda text NOT NULL DEFAULT '',
  criado_por text NOT NULL DEFAULT ''
);

ALTER TABLE equipamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON equipamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 8. Depositos Material ──
CREATE TABLE IF NOT EXISTS depositos_material (
  id text PRIMARY KEY,
  nome text NOT NULL,
  obra_id text NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  endereco text NOT NULL DEFAULT '',
  responsavel text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  criado_por text NOT NULL DEFAULT ''
);

ALTER TABLE depositos_material ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON depositos_material FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 9. Abastecimentos ──
CREATE TABLE IF NOT EXISTS abastecimentos (
  id text PRIMARY KEY,
  data_hora text NOT NULL,
  tipo_combustivel text NOT NULL DEFAULT '',
  quantidade_litros numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  obra_id text NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  etapa_id text NOT NULL DEFAULT '',
  alocacoes jsonb NOT NULL DEFAULT '[]',
  deposito_id text NOT NULL REFERENCES depositos(id) ON DELETE CASCADE,
  veiculo text NOT NULL DEFAULT '',
  observacoes text NOT NULL DEFAULT '',
  criado_por text NOT NULL DEFAULT ''
);

ALTER TABLE abastecimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON abastecimentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 10. Entradas Combustivel ──
CREATE TABLE IF NOT EXISTS entradas_combustivel (
  id text PRIMARY KEY,
  data_hora text NOT NULL,
  deposito_id text NOT NULL REFERENCES depositos(id) ON DELETE CASCADE,
  tipo_combustivel text NOT NULL DEFAULT '',
  obra_id text NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  quantidade_litros numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  fornecedor text NOT NULL DEFAULT '',
  nota_fiscal text NOT NULL DEFAULT '',
  observacoes text NOT NULL DEFAULT '',
  criado_por text NOT NULL DEFAULT ''
);

ALTER TABLE entradas_combustivel ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON entradas_combustivel FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 11. Transferencias Combustivel ──
CREATE TABLE IF NOT EXISTS transferencias_combustivel (
  id text PRIMARY KEY,
  data_hora text NOT NULL,
  deposito_origem_id text NOT NULL REFERENCES depositos(id) ON DELETE CASCADE,
  deposito_destino_id text NOT NULL REFERENCES depositos(id) ON DELETE CASCADE,
  quantidade_litros numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  observacoes text NOT NULL DEFAULT '',
  criado_por text NOT NULL DEFAULT ''
);

ALTER TABLE transferencias_combustivel ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON transferencias_combustivel FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 12. Entradas Material ──
CREATE TABLE IF NOT EXISTS entradas_material (
  id text PRIMARY KEY,
  data_hora text NOT NULL,
  deposito_material_id text NOT NULL REFERENCES depositos_material(id) ON DELETE CASCADE,
  insumo_id text NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
  obra_id text NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  quantidade numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  fornecedor_id text NOT NULL DEFAULT '',
  nota_fiscal text NOT NULL DEFAULT '',
  observacoes text NOT NULL DEFAULT '',
  criado_por text NOT NULL DEFAULT ''
);

ALTER TABLE entradas_material ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON entradas_material FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 13. Saidas Material ──
CREATE TABLE IF NOT EXISTS saidas_material (
  id text PRIMARY KEY,
  data_hora text NOT NULL,
  deposito_material_id text NOT NULL REFERENCES depositos_material(id) ON DELETE CASCADE,
  insumo_id text NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
  obra_id text NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  quantidade numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  alocacoes jsonb NOT NULL DEFAULT '[]',
  observacoes text NOT NULL DEFAULT '',
  criado_por text NOT NULL DEFAULT ''
);

ALTER TABLE saidas_material ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON saidas_material FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 14. Transferencias Material ──
CREATE TABLE IF NOT EXISTS transferencias_material (
  id text PRIMARY KEY,
  data_hora text NOT NULL,
  deposito_origem_id text NOT NULL REFERENCES depositos_material(id) ON DELETE CASCADE,
  deposito_destino_id text NOT NULL REFERENCES depositos_material(id) ON DELETE CASCADE,
  insumo_id text NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
  quantidade numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  observacoes text NOT NULL DEFAULT '',
  criado_por text NOT NULL DEFAULT ''
);

ALTER TABLE transferencias_material ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON transferencias_material FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 15. Funcionarios ──
CREATE TABLE IF NOT EXISTS funcionarios (
  id text PRIMARY KEY,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nome text NOT NULL,
  email text NOT NULL UNIQUE,
  cpf text NOT NULL DEFAULT '',
  telefone text NOT NULL DEFAULT '',
  data_nascimento text NOT NULL DEFAULT '',
  endereco jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'ativo',
  cargo text NOT NULL DEFAULT 'Operador',
  data_admissao text NOT NULL DEFAULT '',
  observacoes text NOT NULL DEFAULT '',
  data_criacao text NOT NULL DEFAULT '',
  data_atualizacao text NOT NULL DEFAULT '',
  acoes_permitidas text[] DEFAULT NULL
);

ALTER TABLE funcionarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON funcionarios FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 16. Perfis Permissao ──
CREATE TABLE IF NOT EXISTS perfis_permissao (
  id text PRIMARY KEY,
  funcionario_id text NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
  permissoes jsonb NOT NULL DEFAULT '{}'
);

ALTER TABLE perfis_permissao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON perfis_permissao FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 17. Audit Log ──
CREATE TABLE IF NOT EXISTS audit_log (
  id text PRIMARY KEY DEFAULT (substr(md5(random()::text), 1, 12)),
  tipo text NOT NULL,
  funcionario_id text NOT NULL DEFAULT '',
  alvo_id text DEFAULT NULL,
  detalhes text NOT NULL DEFAULT '',
  data_hora timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON audit_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 18. Localidades ──
CREATE TABLE IF NOT EXISTS localidades (
  id text PRIMARY KEY,
  nome text NOT NULL,
  endereco text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT true,
  criado_por text NOT NULL DEFAULT ''
);

ALTER TABLE localidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON localidades FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 19. Login Attempts ──
CREATE TABLE IF NOT EXISTS login_attempts (
  email text PRIMARY KEY,
  tentativas integer NOT NULL DEFAULT 0,
  ultima_tentativa bigint NOT NULL DEFAULT 0,
  bloqueado_ate bigint NOT NULL DEFAULT 0
);

ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON login_attempts FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- Also allow anon for login flow (pre-auth)
CREATE POLICY "Anon access login_attempts" ON login_attempts FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- TRIGGERS: Auto-recalculate depositos.nivel_atual_litros
-- Instead of triggers on individual operations, we use a function
-- that recalculates the level from all movements.
-- ============================================================

CREATE OR REPLACE FUNCTION recalcular_nivel_deposito(p_deposito_id text)
RETURNS void AS $$
DECLARE
  v_capacidade numeric;
  v_entradas numeric;
  v_saidas numeric;
  v_transf_entrada numeric;
  v_transf_saida numeric;
  v_nivel numeric;
BEGIN
  SELECT capacidade_litros INTO v_capacidade FROM depositos WHERE id = p_deposito_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(SUM(quantidade_litros), 0) INTO v_entradas
  FROM entradas_combustivel WHERE deposito_id = p_deposito_id;

  SELECT COALESCE(SUM(quantidade_litros), 0) INTO v_saidas
  FROM abastecimentos WHERE deposito_id = p_deposito_id;

  SELECT COALESCE(SUM(quantidade_litros), 0) INTO v_transf_entrada
  FROM transferencias_combustivel WHERE deposito_destino_id = p_deposito_id;

  SELECT COALESCE(SUM(quantidade_litros), 0) INTO v_transf_saida
  FROM transferencias_combustivel WHERE deposito_origem_id = p_deposito_id;

  v_nivel := GREATEST(0, LEAST(v_capacidade, v_entradas - v_saidas + v_transf_entrada - v_transf_saida));

  UPDATE depositos SET nivel_atual_litros = v_nivel WHERE id = p_deposito_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for abastecimentos
CREATE OR REPLACE FUNCTION trigger_abastecimento_nivel()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalcular_nivel_deposito(OLD.deposito_id);
    RETURN OLD;
  END IF;
  PERFORM recalcular_nivel_deposito(NEW.deposito_id);
  IF TG_OP = 'UPDATE' AND OLD.deposito_id <> NEW.deposito_id THEN
    PERFORM recalcular_nivel_deposito(OLD.deposito_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_abastecimento_nivel
AFTER INSERT OR UPDATE OR DELETE ON abastecimentos
FOR EACH ROW EXECUTE FUNCTION trigger_abastecimento_nivel();

-- Trigger function for entradas_combustivel
CREATE OR REPLACE FUNCTION trigger_entrada_combustivel_nivel()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalcular_nivel_deposito(OLD.deposito_id);
    RETURN OLD;
  END IF;
  PERFORM recalcular_nivel_deposito(NEW.deposito_id);
  IF TG_OP = 'UPDATE' AND OLD.deposito_id <> NEW.deposito_id THEN
    PERFORM recalcular_nivel_deposito(OLD.deposito_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_entrada_combustivel_nivel
AFTER INSERT OR UPDATE OR DELETE ON entradas_combustivel
FOR EACH ROW EXECUTE FUNCTION trigger_entrada_combustivel_nivel();

-- Trigger function for transferencias_combustivel
CREATE OR REPLACE FUNCTION trigger_transferencia_combustivel_nivel()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalcular_nivel_deposito(OLD.deposito_origem_id);
    PERFORM recalcular_nivel_deposito(OLD.deposito_destino_id);
    RETURN OLD;
  END IF;
  PERFORM recalcular_nivel_deposito(NEW.deposito_origem_id);
  PERFORM recalcular_nivel_deposito(NEW.deposito_destino_id);
  IF TG_OP = 'UPDATE' THEN
    IF OLD.deposito_origem_id <> NEW.deposito_origem_id THEN
      PERFORM recalcular_nivel_deposito(OLD.deposito_origem_id);
    END IF;
    IF OLD.deposito_destino_id <> NEW.deposito_destino_id THEN
      PERFORM recalcular_nivel_deposito(OLD.deposito_destino_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_transferencia_combustivel_nivel
AFTER INSERT OR UPDATE OR DELETE ON transferencias_combustivel
FOR EACH ROW EXECUTE FUNCTION trigger_transferencia_combustivel_nivel();

-- ============================================================
-- RPC Functions for stock calculation
-- ============================================================

-- Fuel stock at a given date/time for a deposit
CREATE OR REPLACE FUNCTION calcular_estoque_combustivel_na_data(
  p_deposito_id text,
  p_data_hora text,
  p_excluir_id text DEFAULT NULL
)
RETURNS numeric AS $$
DECLARE
  v_entradas numeric;
  v_saidas numeric;
  v_transf_entrada numeric;
  v_transf_saida numeric;
BEGIN
  SELECT COALESCE(SUM(quantidade_litros), 0) INTO v_entradas
  FROM entradas_combustivel
  WHERE deposito_id = p_deposito_id AND data_hora <= p_data_hora;

  SELECT COALESCE(SUM(quantidade_litros), 0) INTO v_saidas
  FROM abastecimentos
  WHERE deposito_id = p_deposito_id AND data_hora <= p_data_hora
    AND (p_excluir_id IS NULL OR id <> p_excluir_id);

  SELECT COALESCE(SUM(quantidade_litros), 0) INTO v_transf_entrada
  FROM transferencias_combustivel
  WHERE deposito_destino_id = p_deposito_id AND data_hora <= p_data_hora;

  SELECT COALESCE(SUM(quantidade_litros), 0) INTO v_transf_saida
  FROM transferencias_combustivel
  WHERE deposito_origem_id = p_deposito_id AND data_hora <= p_data_hora
    AND (p_excluir_id IS NULL OR id <> p_excluir_id);

  RETURN v_entradas - v_saidas + v_transf_entrada - v_transf_saida;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Material stock (current) for a deposit+insumo
CREATE OR REPLACE FUNCTION calcular_estoque_material(
  p_deposito_material_id text,
  p_insumo_id text
)
RETURNS numeric AS $$
DECLARE
  v_entradas numeric;
  v_saidas numeric;
  v_transf_entrada numeric;
  v_transf_saida numeric;
BEGIN
  SELECT COALESCE(SUM(quantidade), 0) INTO v_entradas
  FROM entradas_material
  WHERE deposito_material_id = p_deposito_material_id AND insumo_id = p_insumo_id;

  SELECT COALESCE(SUM(quantidade), 0) INTO v_saidas
  FROM saidas_material
  WHERE deposito_material_id = p_deposito_material_id AND insumo_id = p_insumo_id;

  SELECT COALESCE(SUM(quantidade), 0) INTO v_transf_saida
  FROM transferencias_material
  WHERE deposito_origem_id = p_deposito_material_id AND insumo_id = p_insumo_id;

  SELECT COALESCE(SUM(quantidade), 0) INTO v_transf_entrada
  FROM transferencias_material
  WHERE deposito_destino_id = p_deposito_material_id AND insumo_id = p_insumo_id;

  RETURN v_entradas - v_saidas - v_transf_saida + v_transf_entrada;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Material stock at a given date/time
CREATE OR REPLACE FUNCTION calcular_estoque_material_na_data(
  p_deposito_material_id text,
  p_insumo_id text,
  p_data_hora text,
  p_excluir_id text DEFAULT NULL
)
RETURNS numeric AS $$
DECLARE
  v_entradas numeric;
  v_saidas numeric;
  v_transf_entrada numeric;
  v_transf_saida numeric;
BEGIN
  SELECT COALESCE(SUM(quantidade), 0) INTO v_entradas
  FROM entradas_material
  WHERE deposito_material_id = p_deposito_material_id
    AND insumo_id = p_insumo_id
    AND data_hora <= p_data_hora;

  SELECT COALESCE(SUM(quantidade), 0) INTO v_saidas
  FROM saidas_material
  WHERE deposito_material_id = p_deposito_material_id
    AND insumo_id = p_insumo_id
    AND data_hora <= p_data_hora
    AND (p_excluir_id IS NULL OR id <> p_excluir_id);

  SELECT COALESCE(SUM(quantidade), 0) INTO v_transf_saida
  FROM transferencias_material
  WHERE deposito_origem_id = p_deposito_material_id
    AND insumo_id = p_insumo_id
    AND data_hora <= p_data_hora
    AND (p_excluir_id IS NULL OR id <> p_excluir_id);

  SELECT COALESCE(SUM(quantidade), 0) INTO v_transf_entrada
  FROM transferencias_material
  WHERE deposito_destino_id = p_deposito_material_id
    AND insumo_id = p_insumo_id
    AND data_hora <= p_data_hora;

  RETURN v_entradas - v_saidas - v_transf_saida + v_transf_entrada;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- All material stock (for dashboard/reports)
CREATE OR REPLACE FUNCTION calcular_todo_estoque_material()
RETURNS TABLE(deposito_material_id text, insumo_id text, quantidade numeric) AS $$
BEGIN
  RETURN QUERY
  WITH entradas AS (
    SELECT em.deposito_material_id, em.insumo_id, SUM(em.quantidade) AS qty
    FROM entradas_material em GROUP BY em.deposito_material_id, em.insumo_id
  ),
  saidas AS (
    SELECT sm.deposito_material_id, sm.insumo_id, SUM(sm.quantidade) AS qty
    FROM saidas_material sm GROUP BY sm.deposito_material_id, sm.insumo_id
  ),
  transf_out AS (
    SELECT tm.deposito_origem_id AS deposito_material_id, tm.insumo_id, SUM(tm.quantidade) AS qty
    FROM transferencias_material tm GROUP BY tm.deposito_origem_id, tm.insumo_id
  ),
  transf_in AS (
    SELECT tm.deposito_destino_id AS deposito_material_id, tm.insumo_id, SUM(tm.quantidade) AS qty
    FROM transferencias_material tm GROUP BY tm.deposito_destino_id, tm.insumo_id
  ),
  all_keys AS (
    SELECT e.deposito_material_id, e.insumo_id FROM entradas e
    UNION SELECT s.deposito_material_id, s.insumo_id FROM saidas s
    UNION SELECT t.deposito_material_id, t.insumo_id FROM transf_out t
    UNION SELECT t.deposito_material_id, t.insumo_id FROM transf_in t
  )
  SELECT
    ak.deposito_material_id,
    ak.insumo_id,
    COALESCE(e.qty, 0) - COALESCE(s.qty, 0) - COALESCE(tout.qty, 0) + COALESCE(tin.qty, 0) AS quantidade
  FROM all_keys ak
  LEFT JOIN entradas e ON e.deposito_material_id = ak.deposito_material_id AND e.insumo_id = ak.insumo_id
  LEFT JOIN saidas s ON s.deposito_material_id = ak.deposito_material_id AND s.insumo_id = ak.insumo_id
  LEFT JOIN transf_out tout ON tout.deposito_material_id = ak.deposito_material_id AND tout.insumo_id = ak.insumo_id
  LEFT JOIN transf_in tin ON tin.deposito_material_id = ak.deposito_material_id AND tin.insumo_id = ak.insumo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 20. Pagamentos Frete ──
CREATE TABLE IF NOT EXISTS pagamentos_frete (
  id text PRIMARY KEY,
  data text NOT NULL,
  transportadora text NOT NULL,
  mes_referencia text NOT NULL DEFAULT '',
  valor numeric NOT NULL DEFAULT 0,
  metodo text NOT NULL DEFAULT 'pix',
  quantidade_combustivel numeric NOT NULL DEFAULT 0,
  responsavel text NOT NULL DEFAULT '',
  nota_fiscal text NOT NULL DEFAULT '',
  observacoes text NOT NULL DEFAULT '',
  criado_por text NOT NULL DEFAULT ''
);

ALTER TABLE pagamentos_frete ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON pagamentos_frete FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 21. Abastecimentos Carreta ──
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

-- ============================================================
-- Seed: Unidades de Medida
-- ============================================================

INSERT INTO unidades_medida (id, nome, sigla, ativo) VALUES
  ('seed_unidade_0', 'Litro (L)', 'litro', true),
  ('seed_unidade_1', 'Quilograma (kg)', 'kg', true),
  ('seed_unidade_2', 'Unidade (un)', 'unidade', true),
  ('seed_unidade_3', 'Metro (m)', 'm', true),
  ('seed_unidade_4', 'Metro quadrado (m²)', 'm2', true),
  ('seed_unidade_5', 'Metro cubico (m³)', 'm3', true),
  ('seed_unidade_6', 'Saco', 'saco', true),
  ('seed_unidade_7', 'Tonelada (t)', 'tonelada', true)
ON CONFLICT (id) DO NOTHING;
