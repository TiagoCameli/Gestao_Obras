-- Anexos de documentos do funcionário (CTPS, RG, comprovantes etc.).
-- Aceita qualquer tipo de arquivo. Metadados ficam num jsonb; o conteúdo
-- físico fica no bucket de storage `apontamento-fotos` na pasta `documentos/`.

ALTER TABLE public.apont_funcionarios
  ADD COLUMN IF NOT EXISTS documentos jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Estrutura de cada item:
--   { id: string, nome: string, path: string, size: number, mimeType: string, uploadedAt: string }
