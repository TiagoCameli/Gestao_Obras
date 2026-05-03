-- ============================================================================
-- Módulo de Manutenção — gestao-obras
-- Migration inicial: cria tabelas, índices, triggers e RLS
-- ============================================================================
-- Padrões seguidos do projeto:
-- - text PK (não uuid) — segue padrão equipamentos
-- - snake_case nas colunas
-- - RLS habilitado com policy "Authenticated full access"
-- - Trigger genérico de updated_at
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CATÁLOGOS (raramente mudam — populados via seed)
-- ----------------------------------------------------------------------------

-- Catálogo de fluidos (óleos, graxas, líquidos)
CREATE TABLE IF NOT EXISTS manutencao_fluidos (
  id text PRIMARY KEY,
  tipo text NOT NULL,                       -- 'oleo_motor', 'oleo_hidraulico', etc
  cat_product_name text,                    -- 'Cat DEO-ULS'
  api_specification text,                   -- 'API CK-4'
  viscosity text,                           -- '15W-40'
  description text NOT NULL,
  ambient_temp_min_c numeric,
  ambient_temp_max_c numeric,
  package_sizes text[],                     -- ['20L', '200L']
  custo_medio_litro_brl numeric,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  criado_por text NOT NULL DEFAULT ''
);

COMMENT ON TABLE manutencao_fluidos IS 'Catálogo de óleos, graxas e fluidos usados na frota';

-- Catálogo de peças (part numbers Cat e equivalentes)
CREATE TABLE IF NOT EXISTS manutencao_pecas (
  part_number text PRIMARY KEY,
  description text NOT NULL,
  manufacturer text NOT NULL DEFAULT 'Caterpillar',
  tipo text NOT NULL,                       -- 'oleo_motor', 'ar_primario', etc
  alternative_part_numbers text[],
  custo_medio_brl numeric,
  fornecedor_principal text,                -- 'Sotreq Porto Velho'
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  criado_por text NOT NULL DEFAULT ''
);

COMMENT ON TABLE manutencao_pecas IS 'Catálogo de peças e filtros com part numbers';

-- Catálogo de modelos de equipamento (320C, 416E, 12H, etc)
CREATE TABLE IF NOT EXISTS equipamento_modelos (
  id text PRIMARY KEY,                      -- 'cat-320c', 'cat-416e'
  fabricante text NOT NULL,                 -- 'Caterpillar'
  modelo_nome text NOT NULL,                -- '320C'
  familia text NOT NULL,                    -- 'Escavadeira Hidráulica de Médio Porte'
  tipo_equipamento_codigo text,             -- FK para tipos_equipamento.codigo
  ano_inicio_producao integer,
  ano_fim_producao integer,
  prefixos_serie text[],                    -- ['ANB', 'PAB', 'PAC', 'BER']

  -- Specs do motor (JSONB pra flexibilidade)
  motor jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- estrutura: { catModel, displacementL, netPowerKW, netPowerHP, cylinders, ... }

  -- Capacidades de fluido (JSONB)
  capacidades jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- estrutura: { fuelTankL, engineCrankcaseL, hydraulicSystemTotalL, ... }

  -- Fluidos recomendados por sistema (JSONB array)
  fluidos_recomendados jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- estrutura: [{ system, fluidId, notes }]

  -- Filtros (JSONB array) — ref ao manutencao_pecas via part_number
  filtros jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- estrutura: [{ filterType, partNumber, alternativePartNumbers, quantity, notes }]

  -- Notas técnicas (markdown)
  problemas_conhecidos text,
  manual_url text,
  manual_referencia text,

  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  criado_por text NOT NULL DEFAULT ''
);

COMMENT ON TABLE equipamento_modelos IS 'Catálogo de modelos de equipamento com specs técnicas e filtros';
CREATE INDEX IF NOT EXISTS idx_modelos_fabricante ON equipamento_modelos(fabricante) WHERE ativo;
CREATE INDEX IF NOT EXISTS idx_modelos_tipo ON equipamento_modelos(tipo_equipamento_codigo) WHERE ativo;

-- Catálogo de tarefas de manutenção (por modelo)
CREATE TABLE IF NOT EXISTS manutencao_tarefas (
  id text PRIMARY KEY,                      -- 'cat-320c-h500-engine-oil'
  modelo_id text NOT NULL REFERENCES equipamento_modelos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  categoria text NOT NULL,                  -- 'diaria', 'h_50', 'h_250', 'h_500', etc
  intervalo_horas integer,
  intervalo_dias integer,
  prioridade text NOT NULL DEFAULT 'media', -- 'critica', 'alta', 'media', 'baixa'
  executor_papel text NOT NULL,             -- 'operador', 'mecanico_propio', etc
  duracao_estimada_min integer,

  -- Recursos necessários (JSONB)
  pecas_necessarias jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{ partNumber, quantity, notes }]
  fluidos_necessarios jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{ fluidId, quantityLiters, notes }]
  ferramentas_necessarias jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{ name, size, catSpecialToolNumber }]

  -- Procedimento técnico (JSONB array de steps)
  procedimento jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{ order, title, description, estimatedMinutes, warningNotes }]

  -- Descrição técnica e contexto
  descricao_tecnica text NOT NULL DEFAULT '',  -- markdown — o que e por quê
  sistemas_afetados text[],                    -- ['Motor C-7 ACERT', 'Sist. lubrificação']

  -- Specs técnicas
  torques jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{ componentName, torqueNm, torqueLbFt, threadLockerRequired }]
  specs_tecnicas jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{ parametro, valorNominal, valorMinimo, valorMaximo, unidade, condicaoMedicao, metodoMedicao }]

  -- Critérios de aceite e sinais de alerta
  criterios_aceite jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{ ordem, descricao, comoVerificar, acaoSeReprovar }]
  sinais_alerta jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{ sinal, significado, acao, severidade }]

  notas_seguranca text,
  epi text[],
  notas_tecnicas text,
  manual_referencia text,
  pre_requisitos text[],                    -- ids de outras tasks

  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  criado_por text NOT NULL DEFAULT ''
);

COMMENT ON TABLE manutencao_tarefas IS 'Catálogo de tarefas de manutenção por modelo de equipamento';
CREATE INDEX IF NOT EXISTS idx_tarefas_modelo ON manutencao_tarefas(modelo_id) WHERE ativo;
CREATE INDEX IF NOT EXISTS idx_tarefas_categoria ON manutencao_tarefas(categoria) WHERE ativo;

-- ----------------------------------------------------------------------------
-- 2. EXTENSÃO DA TABELA equipamentos EXISTENTE
-- ----------------------------------------------------------------------------

-- Adicionar referência ao modelo do catálogo (opcional — não quebra existentes)
ALTER TABLE equipamentos
  ADD COLUMN IF NOT EXISTS modelo_id text REFERENCES equipamento_modelos(id) ON DELETE SET NULL;

ALTER TABLE equipamentos
  ADD COLUMN IF NOT EXISTS prefixo_serie text;

ALTER TABLE equipamentos
  ADD COLUMN IF NOT EXISTS horimetro_funcional boolean NOT NULL DEFAULT true;

ALTER TABLE equipamentos
  ADD COLUMN IF NOT EXISTS horimetro_atual numeric;

ALTER TABLE equipamentos
  ADD COLUMN IF NOT EXISTS notas_unidade text;

ALTER TABLE equipamentos
  ADD COLUMN IF NOT EXISTS alertas_criticos text[];

CREATE INDEX IF NOT EXISTS idx_equipamentos_modelo ON equipamentos(modelo_id) WHERE ativo;

-- ----------------------------------------------------------------------------
-- 3. HISTÓRICO E OPERACIONAL
-- ----------------------------------------------------------------------------

-- Leituras periódicas de horímetro/odômetro (para máquinas que vão começar
-- a ter horímetro funcionando agora — armazena histórico)
CREATE TABLE IF NOT EXISTS manutencao_horimetro_leituras (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  equipamento_id text NOT NULL REFERENCES equipamentos(id) ON DELETE CASCADE,
  data_leitura date NOT NULL,
  valor numeric NOT NULL,
  origem text NOT NULL DEFAULT 'manual', -- 'manual', 'manutencao', 'apontamento'
  observacao text,
  registrado_por text,                  -- funcionario_id ou auth.uid
  criado_em timestamptz NOT NULL DEFAULT now(),
  criado_por text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_horimetro_equipamento_data
  ON manutencao_horimetro_leituras(equipamento_id, data_leitura DESC);

COMMENT ON TABLE manutencao_horimetro_leituras IS 'Histórico de leituras de horímetro/odômetro';

-- Agendamentos (cronograma futuro de manutenções)
CREATE TABLE IF NOT EXISTS manutencao_agendamentos (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  equipamento_id text NOT NULL REFERENCES equipamentos(id) ON DELETE CASCADE,
  tarefa_id text NOT NULL REFERENCES manutencao_tarefas(id) ON DELETE CASCADE,

  data_prevista date NOT NULL,
  horimetro_previsto numeric,
  custo_estimado_brl numeric,

  status text NOT NULL DEFAULT 'agendada',  -- 'agendada','atrasada','concluida','cancelada'
  alerta_dias_antes integer DEFAULT 7,
  origem text NOT NULL DEFAULT 'auto',      -- 'auto' (gerado pelo sistema), 'manual'
  baseado_em_registro_id text,              -- ref ao último registro que originou este agendamento

  observacao text,

  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  criado_por text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_agendamento_equipamento
  ON manutencao_agendamentos(equipamento_id, status);
CREATE INDEX IF NOT EXISTS idx_agendamento_data_status
  ON manutencao_agendamentos(data_prevista, status);

COMMENT ON TABLE manutencao_agendamentos IS 'Cronograma de manutenções futuras';

-- Registros de manutenção executada (histórico)
CREATE TABLE IF NOT EXISTS manutencao_registros (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  equipamento_id text NOT NULL REFERENCES equipamentos(id) ON DELETE CASCADE,
  tarefa_id text NOT NULL REFERENCES manutencao_tarefas(id) ON DELETE RESTRICT,
  agendamento_id text REFERENCES manutencao_agendamentos(id) ON DELETE SET NULL,

  executado_em timestamptz NOT NULL,
  executado_por_funcionario_id text,        -- ref funcionarios
  executor_papel text NOT NULL,             -- 'operador', 'mecanico_propio', etc

  horimetro_no_momento numeric,
  status text NOT NULL DEFAULT 'concluida', -- 'concluida','pendente','parcial','cancelada'

  -- Recursos REALMENTE consumidos (pode diferir do planejado)
  pecas_usadas jsonb NOT NULL DEFAULT '[]'::jsonb,
  fluidos_usados jsonb NOT NULL DEFAULT '[]'::jsonb,
  custo_total_brl numeric,

  -- Documentação em campo
  fotos_urls text[],                        -- urls do bucket manutencao-fotos
  observacoes text,
  problemas_encontrados text,
  acoes_recomendadas text,

  -- Reservado para análise de óleo (Fase 2 — S.O.S Cat)
  oleo_amostra_coletada boolean DEFAULT false,
  oleo_amostra_resultado text,              -- 'normal','atencao','acao_imediata'
  oleo_amostra_pdf_url text,
  oleo_amostra_data_envio date,
  oleo_amostra_data_resultado date,

  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  criado_por text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_registro_equipamento_data
  ON manutencao_registros(equipamento_id, executado_em DESC);
CREATE INDEX IF NOT EXISTS idx_registro_tarefa
  ON manutencao_registros(tarefa_id, executado_em DESC);

COMMENT ON TABLE manutencao_registros IS 'Histórico de manutenções executadas';

-- Alertas (manutenção atrasada, S.O.S crítico, filtro saturado, etc)
CREATE TABLE IF NOT EXISTS manutencao_alertas (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  equipamento_id text NOT NULL REFERENCES equipamentos(id) ON DELETE CASCADE,
  tipo text NOT NULL,                       -- 'manutencao_atrasada','horimetro_proximo','filtro_indicador','consumo_oleo_alto','analise_oleo_critica'
  severidade text NOT NULL DEFAULT 'info',  -- 'info','warning','critical'
  mensagem text NOT NULL,

  agendamento_id text REFERENCES manutencao_agendamentos(id) ON DELETE CASCADE,
  registro_id text REFERENCES manutencao_registros(id) ON DELETE CASCADE,

  reconhecido_em timestamptz,
  reconhecido_por_funcionario_id text,

  criado_em timestamptz NOT NULL DEFAULT now(),
  criado_por text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_alerta_equipamento_aberto
  ON manutencao_alertas(equipamento_id) WHERE reconhecido_em IS NULL;
CREATE INDEX IF NOT EXISTS idx_alerta_severidade
  ON manutencao_alertas(severidade, criado_em DESC) WHERE reconhecido_em IS NULL;

COMMENT ON TABLE manutencao_alertas IS 'Alertas ativos do módulo de manutenção';

-- ----------------------------------------------------------------------------
-- 4. TRIGGERS DE updated_at (segue padrão do projeto)
-- ----------------------------------------------------------------------------

-- Função genérica (criar só se não existir — outras migrations podem ter criado)
CREATE OR REPLACE FUNCTION manutencao_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_fluidos_updated') THEN
    CREATE TRIGGER trg_fluidos_updated BEFORE UPDATE ON manutencao_fluidos
      FOR EACH ROW EXECUTE FUNCTION manutencao_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_pecas_updated') THEN
    CREATE TRIGGER trg_pecas_updated BEFORE UPDATE ON manutencao_pecas
      FOR EACH ROW EXECUTE FUNCTION manutencao_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_modelos_updated') THEN
    CREATE TRIGGER trg_modelos_updated BEFORE UPDATE ON equipamento_modelos
      FOR EACH ROW EXECUTE FUNCTION manutencao_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tarefas_updated') THEN
    CREATE TRIGGER trg_tarefas_updated BEFORE UPDATE ON manutencao_tarefas
      FOR EACH ROW EXECUTE FUNCTION manutencao_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_agendamentos_updated') THEN
    CREATE TRIGGER trg_agendamentos_updated BEFORE UPDATE ON manutencao_agendamentos
      FOR EACH ROW EXECUTE FUNCTION manutencao_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_registros_updated') THEN
    CREATE TRIGGER trg_registros_updated BEFORE UPDATE ON manutencao_registros
      FOR EACH ROW EXECUTE FUNCTION manutencao_set_updated_at();
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. RLS — segue padrão "Authenticated full access"
-- ----------------------------------------------------------------------------

ALTER TABLE manutencao_fluidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE manutencao_pecas ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipamento_modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE manutencao_tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE manutencao_horimetro_leituras ENABLE ROW LEVEL SECURITY;
ALTER TABLE manutencao_agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE manutencao_registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE manutencao_alertas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Authenticated full access' AND tablename='manutencao_fluidos') THEN
    CREATE POLICY "Authenticated full access" ON manutencao_fluidos
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Authenticated full access' AND tablename='manutencao_pecas') THEN
    CREATE POLICY "Authenticated full access" ON manutencao_pecas
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Authenticated full access' AND tablename='equipamento_modelos') THEN
    CREATE POLICY "Authenticated full access" ON equipamento_modelos
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Authenticated full access' AND tablename='manutencao_tarefas') THEN
    CREATE POLICY "Authenticated full access" ON manutencao_tarefas
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Authenticated full access' AND tablename='manutencao_horimetro_leituras') THEN
    CREATE POLICY "Authenticated full access" ON manutencao_horimetro_leituras
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Authenticated full access' AND tablename='manutencao_agendamentos') THEN
    CREATE POLICY "Authenticated full access" ON manutencao_agendamentos
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Authenticated full access' AND tablename='manutencao_registros') THEN
    CREATE POLICY "Authenticated full access" ON manutencao_registros
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Authenticated full access' AND tablename='manutencao_alertas') THEN
    CREATE POLICY "Authenticated full access" ON manutencao_alertas
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. STORAGE BUCKET — IMPORTANTE
-- ----------------------------------------------------------------------------
-- Em projetos Supabase managed, o role `authenticated` NÃO costuma ter
-- permissão para INSERT em storage.buckets via SQL. O DO-block abaixo tenta
-- criar e silencia erros — se você notar que o bucket NÃO foi criado depois
-- desta migration, entre no Supabase Dashboard → Storage e crie manualmente:
--   • Nome: manutencao-fotos
--   • Public: false (privado)
-- As policies de storage.objects são aplicadas em seguida; também silenciam
-- erros se rodadas sem permissão.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'manutencao-fotos') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('manutencao-fotos', 'manutencao-fotos', false);
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Se não houver permissão para criar bucket via SQL, apenas ignora
  -- (criar manualmente via dashboard)
  RAISE NOTICE 'Bucket manutencao-fotos precisa ser criado manualmente no dashboard';
END $$;

-- Policies do bucket (executar quando bucket existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'manutencao-fotos') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE policyname = 'manutencao_fotos_authenticated_read' AND tablename = 'objects'
    ) THEN
      CREATE POLICY "manutencao_fotos_authenticated_read" ON storage.objects
        FOR SELECT TO authenticated
        USING (bucket_id = 'manutencao-fotos');
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE policyname = 'manutencao_fotos_authenticated_write' AND tablename = 'objects'
    ) THEN
      CREATE POLICY "manutencao_fotos_authenticated_write" ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'manutencao-fotos');
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE policyname = 'manutencao_fotos_authenticated_delete' AND tablename = 'objects'
    ) THEN
      CREATE POLICY "manutencao_fotos_authenticated_delete" ON storage.objects
        FOR DELETE TO authenticated
        USING (bucket_id = 'manutencao-fotos');
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Policies de storage precisam ser configuradas após criar o bucket';
END $$;

-- ============================================================================
-- FIM DA MIGRATION INICIAL
-- ============================================================================
