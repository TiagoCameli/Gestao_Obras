-- Add endereco (link/address) column to localidades
ALTER TABLE localidades ADD COLUMN IF NOT EXISTS endereco text NOT NULL DEFAULT '';
