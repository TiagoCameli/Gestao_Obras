-- MP.1 — Combustível: limites de tamanho e MIME no bucket abastecimento-fotos.
--
-- Audit item 8: bucket criado sem file_size_limit nem allowed_mime_types.
-- A migration tighten_storage_bucket_limits (Bloco 1.5) cobriu 3 outros
-- buckets mas omitiu abastecimento-fotos. POST direto via Storage API
-- aceitaria qualquer MIME e tamanho. Limit aplicado: 20 MB + lista MIME
-- alinhada ao apontamento-fotos (que tem o uso mais permissivo — fotos
-- de máquina + documentos NF + planilhas).

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
WHERE id = 'abastecimento-fotos';
