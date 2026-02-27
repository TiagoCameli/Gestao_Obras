-- Permitir ausências (falta, licença médica, férias) sem obra/etapa
ALTER TABLE apontamentos ALTER COLUMN obra_id DROP NOT NULL;
ALTER TABLE apontamentos ALTER COLUMN etapa_obra_id DROP NOT NULL;
