-- ============================================================
-- Marco 5 PR28g — Trigger INSERT: novo Colaborador cria apont_funcionario
-- ============================================================
-- Quando um Colaborador é CRIADO sem apont_funcionario_id, cria
-- automaticamente o apont_funcionario espelho e vincula.
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_colab_insert_cria_apont()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_new_id uuid;
BEGIN
  IF NEW.apont_funcionario_id IS NOT NULL THEN RETURN NEW; END IF;
  v_new_id := gen_random_uuid();
  INSERT INTO apont_funcionarios (
    id, nome, cpf, rg, telefone, email, endereco,
    altura, tamanho_camisa, tamanho_calca, tamanho_sapato,
    data_nascimento, data_admissao,
    funcao, tipo_vinculo, status,
    permite_horas_extras, fotos_referencia_facial, documentos,
    created_at, updated_at
  ) VALUES (
    v_new_id, NEW.nome,
    nullif(NEW.cpf, ''), nullif(NEW.rg, ''), nullif(NEW.telefone, ''),
    nullif(NEW.email, ''), nullif(NEW.endereco, ''),
    nullif(NEW.altura, ''), nullif(NEW.tamanho_camisa, ''),
    nullif(NEW.tamanho_calca, ''), nullif(NEW.tamanho_sapato, ''),
    CASE WHEN NEW.data_nascimento ~ '^\d{4}-\d{2}-\d{2}$' THEN NEW.data_nascimento::date ELSE NULL END,
    CASE WHEN NEW.data_ingresso ~ '^\d{4}-\d{2}-\d{2}$' THEN NEW.data_ingresso::date ELSE NULL END,
    'OUTROS', 'prestador_servico',
    CASE WHEN NEW.ativo THEN 'ativo' ELSE 'inativo' END,
    false, ARRAY[]::text[], '[]'::jsonb, now(), now()
  );
  NEW.apont_funcionario_id := v_new_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS colab_insert_cria_apont ON colaboradores;
CREATE TRIGGER colab_insert_cria_apont
  BEFORE INSERT ON colaboradores
  FOR EACH ROW
  EXECUTE FUNCTION trigger_colab_insert_cria_apont();
