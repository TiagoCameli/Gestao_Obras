-- Tighten RLS no bucket `apontamento-fotos`.
--
-- ANTES: única policy `apont_fotos_authed_all FOR ALL TO authenticated USING (bucket_id='apontamento-fotos')`
--        → qualquer usuário autenticado lê/escreve/deleta foto facial, RG, CPF, CTPS,
--          ASO de QUALQUER funcionário. Fix #3 do apontamento-rh-audit.md.
--
-- DEPOIS: 11 policies path-aware (SELECT/INSERT/UPDATE/DELETE × 3 prefixos), gating
--         por `private.current_has_action(p_action text)`:
--           - `documentos/<uuid>/...`   → só quem edita funcionário
--           - `ponto/<uuid>/...`        → quem bate, aprova ou vê RH
--           - `<uuid>/...` (perfil/biometria) → RH e captura facial
--
-- Rollback: ver migration 20260525120100_rollback_apont_fotos_storage_rls.sql.

BEGIN;

-- 1) Remove a policy blanket
DROP POLICY IF EXISTS apont_fotos_authed_all ON storage.objects;

-- 2) SELECT — leitura de cada tipo de objeto
CREATE POLICY apont_fotos_select_documentos
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'apontamento-fotos'
    AND name LIKE 'documentos/%'
    AND private.current_has_action('editar_func_rh')
  );

CREATE POLICY apont_fotos_select_funcionario
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'apontamento-fotos'
    AND name NOT LIKE 'documentos/%'
    AND name NOT LIKE 'ponto/%'
    AND (
      private.current_has_action('ver_apontamento_rh')
      OR private.current_has_action('captura_facial_ponto')
    )
  );

CREATE POLICY apont_fotos_select_ponto
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'apontamento-fotos'
    AND name LIKE 'ponto/%'
    AND (
      private.current_has_action('ver_apontamento_rh')
      OR private.current_has_action('aprovar_apontamento_rh')
    )
  );

-- 3) INSERT — upload de cada tipo
CREATE POLICY apont_fotos_insert_documentos
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'apontamento-fotos'
    AND name LIKE 'documentos/%'
    AND private.current_has_action('editar_func_rh')
  );

CREATE POLICY apont_fotos_insert_funcionario
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'apontamento-fotos'
    AND name NOT LIKE 'documentos/%'
    AND name NOT LIKE 'ponto/%'
    AND (
      private.current_has_action('criar_func_rh')
      OR private.current_has_action('editar_func_rh')
    )
  );

CREATE POLICY apont_fotos_insert_ponto
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'apontamento-fotos'
    AND name LIKE 'ponto/%'
    AND (
      private.current_has_action('registrar_ponto')
      OR private.current_has_action('registrar_ponto_lote')
    )
  );

-- 4) UPDATE — só onde código usa upsert:true
--    (apontamentoApi.uploadFoto e pontoApi.uploadFotoPonto). Não há upsert em documentos.
CREATE POLICY apont_fotos_update_funcionario
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'apontamento-fotos'
    AND name NOT LIKE 'documentos/%'
    AND name NOT LIKE 'ponto/%'
    AND (
      private.current_has_action('criar_func_rh')
      OR private.current_has_action('editar_func_rh')
    )
  )
  WITH CHECK (
    bucket_id = 'apontamento-fotos'
    AND name NOT LIKE 'documentos/%'
    AND name NOT LIKE 'ponto/%'
    AND (
      private.current_has_action('criar_func_rh')
      OR private.current_has_action('editar_func_rh')
    )
  );

CREATE POLICY apont_fotos_update_ponto
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'apontamento-fotos'
    AND name LIKE 'ponto/%'
    AND (
      private.current_has_action('registrar_ponto')
      OR private.current_has_action('editar_batida_ponto')
    )
  )
  WITH CHECK (
    bucket_id = 'apontamento-fotos'
    AND name LIKE 'ponto/%'
    AND (
      private.current_has_action('registrar_ponto')
      OR private.current_has_action('editar_batida_ponto')
    )
  );

-- 5) DELETE
CREATE POLICY apont_fotos_delete_documentos
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'apontamento-fotos'
    AND name LIKE 'documentos/%'
    AND private.current_has_action('editar_func_rh')
  );

CREATE POLICY apont_fotos_delete_funcionario
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'apontamento-fotos'
    AND name NOT LIKE 'documentos/%'
    AND name NOT LIKE 'ponto/%'
    AND (
      private.current_has_action('editar_func_rh')
      OR private.current_has_action('excluir_func_rh')
    )
  );

CREATE POLICY apont_fotos_delete_ponto
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'apontamento-fotos'
    AND name LIKE 'ponto/%'
    AND private.current_has_action('excluir_batida_ponto')
  );

COMMIT;
