-- Audit Fase 10 #6: bucket financeiro-anexos era PÚBLICO
--
-- Bucket está com 0 arquivos no momento da auditoria (2026-05-22), então
-- privatizar agora não quebra dado existente. Frontend muda para createSignedUrl.
--
-- Adicional: falta policy de UPDATE (audit Fase 10 — abastecimento-fotos e
-- financeiro-anexos não tinham). Sem UPDATE, upsert falha silenciosamente.

UPDATE storage.buckets
SET public = false
WHERE id = 'financeiro-anexos';

-- Cria policy UPDATE no storage.objects para financeiro-anexos (faltava).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'financeiro_anexos_update'
  ) THEN
    EXECUTE $POL$
      CREATE POLICY "financeiro_anexos_update"
      ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'financeiro-anexos' AND private.current_has_action('ver_financeiro'))
      WITH CHECK (bucket_id = 'financeiro-anexos' AND private.current_has_action('ver_financeiro'));
    $POL$;
  END IF;
END $$;

-- Endurecer SELECT/INSERT/DELETE existentes (estavam permitindo qualquer authenticated).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'financeiro_anexos_select'
  ) THEN
    DROP POLICY "financeiro_anexos_select" ON storage.objects;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'financeiro_anexos_insert'
  ) THEN
    DROP POLICY "financeiro_anexos_insert" ON storage.objects;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'financeiro_anexos_delete'
  ) THEN
    DROP POLICY "financeiro_anexos_delete" ON storage.objects;
  END IF;
END $$;

CREATE POLICY "financeiro_anexos_select"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'financeiro-anexos' AND private.current_has_action('ver_financeiro'));

CREATE POLICY "financeiro_anexos_insert"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'financeiro-anexos'
    AND (
      private.current_has_action('criar_lancamento_financeiro')
      OR private.current_has_action('editar_lancamento_financeiro')
      OR private.current_has_action('registrar_pagamento_financeiro')
    )
  );

CREATE POLICY "financeiro_anexos_delete"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'financeiro-anexos'
    AND (
      private.current_has_action('editar_lancamento_financeiro')
      OR private.current_has_action('estornar_pagamento_financeiro')
    )
  );
