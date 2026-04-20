-- Add optional second nota fiscal to fretes
ALTER TABLE fretes ADD COLUMN IF NOT EXISTS nota_fiscal2 text NOT NULL DEFAULT '';
