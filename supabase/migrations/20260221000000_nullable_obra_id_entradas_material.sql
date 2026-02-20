-- Torna obra_id opcional na tabela entradas_material
ALTER TABLE entradas_material ALTER COLUMN obra_id DROP NOT NULL;
