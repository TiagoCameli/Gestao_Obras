-- Add criado_por column to all 17 entities
ALTER TABLE obras ADD COLUMN IF NOT EXISTS criado_por text NOT NULL DEFAULT '';
ALTER TABLE etapas_obra ADD COLUMN IF NOT EXISTS criado_por text NOT NULL DEFAULT '';
ALTER TABLE depositos ADD COLUMN IF NOT EXISTS criado_por text NOT NULL DEFAULT '';
ALTER TABLE abastecimentos ADD COLUMN IF NOT EXISTS criado_por text NOT NULL DEFAULT '';
ALTER TABLE entradas_combustivel ADD COLUMN IF NOT EXISTS criado_por text NOT NULL DEFAULT '';
ALTER TABLE equipamentos ADD COLUMN IF NOT EXISTS criado_por text NOT NULL DEFAULT '';
ALTER TABLE insumos ADD COLUMN IF NOT EXISTS criado_por text NOT NULL DEFAULT '';
ALTER TABLE transferencias_combustivel ADD COLUMN IF NOT EXISTS criado_por text NOT NULL DEFAULT '';
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS criado_por text NOT NULL DEFAULT '';
ALTER TABLE depositos_material ADD COLUMN IF NOT EXISTS criado_por text NOT NULL DEFAULT '';
ALTER TABLE unidades_medida ADD COLUMN IF NOT EXISTS criado_por text NOT NULL DEFAULT '';
ALTER TABLE entradas_material ADD COLUMN IF NOT EXISTS criado_por text NOT NULL DEFAULT '';
ALTER TABLE saidas_material ADD COLUMN IF NOT EXISTS criado_por text NOT NULL DEFAULT '';
ALTER TABLE transferencias_material ADD COLUMN IF NOT EXISTS criado_por text NOT NULL DEFAULT '';
ALTER TABLE localidades ADD COLUMN IF NOT EXISTS criado_por text NOT NULL DEFAULT '';
ALTER TABLE fretes ADD COLUMN IF NOT EXISTS criado_por text NOT NULL DEFAULT '';
ALTER TABLE pagamentos_frete ADD COLUMN IF NOT EXISTS criado_por text NOT NULL DEFAULT '';
