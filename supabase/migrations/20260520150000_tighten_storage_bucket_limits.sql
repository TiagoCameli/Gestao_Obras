-- Audit Bloco 1.5: file_size_limit + allowed_mime_types nos 3 buckets sem validação
--
-- Antes: apontamento-fotos, rodotracker-pdfs, rodotracker-photos tinham
--        file_size_limit=NULL e allowed_mime_types=NULL — qualquer tamanho
--        e qualquer tipo MIME, inclusive executáveis disfarçados de docs.
-- Depois: 20 MB cap em todos; MIME allowlist por finalidade do bucket.
--
-- Aplicação (apontamentoApi.ts) também ganha validação client-side em
-- uploadFoto e uploadDocumento pra erros amigáveis antes do upload.

UPDATE storage.buckets
SET file_size_limit = 20971520,
    allowed_mime_types = ARRAY[
      'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/csv', 'text/plain'
    ]
WHERE id = 'apontamento-fotos';

UPDATE storage.buckets
SET file_size_limit = 20971520,
    allowed_mime_types = ARRAY['application/pdf']
WHERE id = 'rodotracker-pdfs';

UPDATE storage.buckets
SET file_size_limit = 20971520,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
WHERE id = 'rodotracker-photos';
