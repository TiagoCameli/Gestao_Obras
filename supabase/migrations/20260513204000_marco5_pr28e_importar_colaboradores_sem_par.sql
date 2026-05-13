-- ============================================================
-- Marco 5 PR28e — Fase 3b: importar colaboradores não-vinculados
-- ============================================================
-- Para cada colaborador sem apont_funcionario_id, cria um novo
-- apont_funcionario com os dados do colaborador e vincula automaticamente.
--
-- VALORES PADRÃO obrigatórios (campos NOT NULL em apont_funcionarios):
--   funcao         = 'OUTROS' (placeholder, usuário ajusta depois)
--   tipo_vinculo   = 'prestador_servico'
--   status         = colaborador.ativo ? 'ativo' : 'inativo'
--   permite_horas_extras = false
--
-- Idempotente: só processa colaboradores ainda não vinculados.
-- ============================================================

CREATE OR REPLACE FUNCTION importar_colaboradores_sem_par_no_apont()
RETURNS TABLE (criados int, ids_criados uuid[])
LANGUAGE plpgsql
AS $$
DECLARE
  r RECORD;
  v_new_id uuid;
  v_count int := 0;
  v_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  FOR r IN
    SELECT id, nome, cpf, rg, telefone, email, endereco,
           altura, tamanho_camisa, tamanho_calca, tamanho_sapato,
           data_nascimento, data_ingresso, ativo
    FROM colaboradores
    WHERE apont_funcionario_id IS NULL
    ORDER BY nome
  LOOP
    v_new_id := gen_random_uuid();
    INSERT INTO apont_funcionarios (
      id, nome, cpf, rg, telefone, email, endereco,
      altura, tamanho_camisa, tamanho_calca, tamanho_sapato,
      data_nascimento, data_admissao,
      funcao, tipo_vinculo, status,
      permite_horas_extras,
      fotos_referencia_facial, documentos,
      created_at, updated_at
    ) VALUES (
      v_new_id, r.nome,
      nullif(r.cpf, ''), nullif(r.rg, ''), nullif(r.telefone, ''),
      nullif(r.email, ''), nullif(r.endereco, ''),
      nullif(r.altura, ''), nullif(r.tamanho_camisa, ''),
      nullif(r.tamanho_calca, ''), nullif(r.tamanho_sapato, ''),
      CASE WHEN r.data_nascimento ~ '^\d{4}-\d{2}-\d{2}$' THEN r.data_nascimento::date ELSE NULL END,
      CASE WHEN r.data_ingresso ~ '^\d{4}-\d{2}-\d{2}$' THEN r.data_ingresso::date ELSE NULL END,
      'OUTROS', 'prestador_servico',
      CASE WHEN r.ativo THEN 'ativo' ELSE 'inativo' END,
      false, ARRAY[]::text[], '[]'::jsonb, now(), now()
    );
    UPDATE colaboradores SET apont_funcionario_id = v_new_id WHERE id = r.id;
    v_count := v_count + 1;
    v_ids := array_append(v_ids, v_new_id);
  END LOOP;
  RETURN QUERY SELECT v_count, v_ids;
END;
$$;
