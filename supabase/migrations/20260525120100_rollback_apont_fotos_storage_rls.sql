-- ROLLBACK da migration 20260525120000_apont_fotos_storage_rls.sql.
--
-- ⚠️  NÃO aplique a menos que algo quebre. Restaura a policy blanket original
-- (`apont_fotos_authed_all FOR ALL TO authenticated`), ou seja, REABRE o bucket.
-- Mantida no histórico do repo pra documentar o caminho de reversão.

BEGIN;

DROP POLICY IF EXISTS apont_fotos_select_documentos    ON storage.objects;
DROP POLICY IF EXISTS apont_fotos_select_funcionario   ON storage.objects;
DROP POLICY IF EXISTS apont_fotos_select_ponto         ON storage.objects;
DROP POLICY IF EXISTS apont_fotos_insert_documentos    ON storage.objects;
DROP POLICY IF EXISTS apont_fotos_insert_funcionario   ON storage.objects;
DROP POLICY IF EXISTS apont_fotos_insert_ponto         ON storage.objects;
DROP POLICY IF EXISTS apont_fotos_update_funcionario   ON storage.objects;
DROP POLICY IF EXISTS apont_fotos_update_ponto         ON storage.objects;
DROP POLICY IF EXISTS apont_fotos_delete_documentos    ON storage.objects;
DROP POLICY IF EXISTS apont_fotos_delete_funcionario   ON storage.objects;
DROP POLICY IF EXISTS apont_fotos_delete_ponto         ON storage.objects;

CREATE POLICY apont_fotos_authed_all
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'apontamento-fotos')
  WITH CHECK (bucket_id = 'apontamento-fotos');

COMMIT;
