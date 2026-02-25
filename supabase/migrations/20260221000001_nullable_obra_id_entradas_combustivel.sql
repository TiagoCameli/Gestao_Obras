-- Torna obra_id opcional na tabela entradas_combustivel
ALTER TABLE entradas_combustivel ALTER COLUMN obra_id DROP NOT NULL;
