-- ============================================================
-- Marco 5 PR28i — Bidirecional: apont_funcionario → colaborador
-- ============================================================
-- 1. Importa apont_funcionarios sem espelho como Colaboradores.
-- 2. Trigger INSERT em apont_funcionarios: cria colab espelho.
-- 3. Trigger UPDATE em apont_funcionarios: espelha mudanças no colab.
--
-- Proteção anti-loop: triggers só executam quando pg_trigger_depth() = 1
-- (chamada direta do usuário, não cadeia de outro trigger).
--
-- empresa_id default = EMT Construtora (mm4em4xic5sp2). Usuário ajusta
-- depois se algum colab for de empresa diferente.
-- ============================================================

CREATE OR REPLACE FUNCTION importar_apont_sem_par_no_colab()
RETURNS TABLE (criados int, ids_criados text[])
LANGUAGE plpgsql AS $$
DECLARE
  r RECORD;
  v_new_id text;
  v_count int := 0;
  v_ids text[] := ARRAY[]::text[];
  v_empresa_default text := 'mm4em4xic5sp2';
BEGIN
  FOR r IN
    SELECT af.id, af.nome, af.cpf, af.rg, af.telefone, af.email, af.endereco,
           af.altura, af.tamanho_camisa, af.tamanho_calca, af.tamanho_sapato,
           af.data_nascimento, af.data_admissao, af.status
    FROM apont_funcionarios af
    LEFT JOIN colaboradores c ON c.apont_funcionario_id = af.id
    WHERE c.id IS NULL
    ORDER BY af.nome
  LOOP
    v_new_id := 'colab_' || replace(r.id::text, '-', '');
    INSERT INTO colaboradores (
      id, nome, empresa_id, data_nascimento, data_ingresso, telefone, email,
      altura, tamanho_camisa, tamanho_calca, tamanho_sapato,
      endereco, cpf, rg, observacoes, ativo, criado_por, apont_funcionario_id
    ) VALUES (
      v_new_id, r.nome, v_empresa_default,
      coalesce(r.data_nascimento::text, ''), coalesce(r.data_admissao::text, ''),
      coalesce(r.telefone, ''), coalesce(r.email, ''),
      coalesce(r.altura, ''), coalesce(r.tamanho_camisa, ''),
      coalesce(r.tamanho_calca, ''), coalesce(r.tamanho_sapato, ''),
      coalesce(r.endereco, ''), coalesce(r.cpf, ''), coalesce(r.rg, ''),
      '', r.status IN ('ativo','afastado'), 'pr28i-import', r.id
    );
    v_count := v_count + 1;
    v_ids := array_append(v_ids, v_new_id);
  END LOOP;
  RETURN QUERY SELECT v_count, v_ids;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_apont_insert_cria_colab()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_new_id text;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM colaboradores WHERE apont_funcionario_id = NEW.id) THEN
    RETURN NEW;
  END IF;
  v_new_id := 'colab_' || replace(NEW.id::text, '-', '');
  INSERT INTO colaboradores (
    id, nome, empresa_id, data_nascimento, data_ingresso, telefone, email,
    altura, tamanho_camisa, tamanho_calca, tamanho_sapato,
    endereco, cpf, rg, observacoes, ativo, criado_por, apont_funcionario_id
  ) VALUES (
    v_new_id, NEW.nome, 'mm4em4xic5sp2',
    coalesce(NEW.data_nascimento::text, ''), coalesce(NEW.data_admissao::text, ''),
    coalesce(NEW.telefone, ''), coalesce(NEW.email, ''),
    coalesce(NEW.altura, ''), coalesce(NEW.tamanho_camisa, ''),
    coalesce(NEW.tamanho_calca, ''), coalesce(NEW.tamanho_sapato, ''),
    coalesce(NEW.endereco, ''), coalesce(NEW.cpf, ''), coalesce(NEW.rg, ''),
    '', NEW.status IN ('ativo','afastado'), 'pr28i-auto', NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apont_insert_cria_colab ON apont_funcionarios;
CREATE TRIGGER apont_insert_cria_colab
  AFTER INSERT ON apont_funcionarios
  FOR EACH ROW EXECUTE FUNCTION trigger_apont_insert_cria_colab();

CREATE OR REPLACE FUNCTION trigger_sync_apont_to_colab()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_colab_id text;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  SELECT id INTO v_colab_id FROM colaboradores WHERE apont_funcionario_id = NEW.id;
  IF v_colab_id IS NULL THEN RETURN NEW; END IF;

  UPDATE colaboradores SET nome = NEW.nome WHERE id = v_colab_id;

  IF coalesce(NEW.cpf,'') <> '' THEN
    UPDATE colaboradores SET cpf = NEW.cpf WHERE id = v_colab_id AND coalesce(cpf,'') = '';
  END IF;
  IF coalesce(NEW.rg,'') <> '' THEN
    UPDATE colaboradores SET rg = NEW.rg WHERE id = v_colab_id AND coalesce(rg,'') = '';
  END IF;
  IF coalesce(NEW.telefone,'') <> '' THEN
    UPDATE colaboradores SET telefone = NEW.telefone WHERE id = v_colab_id AND coalesce(telefone,'') = '';
  END IF;
  IF coalesce(NEW.email,'') <> '' THEN
    UPDATE colaboradores SET email = NEW.email WHERE id = v_colab_id AND coalesce(email,'') = '';
  END IF;
  IF coalesce(NEW.endereco,'') <> '' THEN
    UPDATE colaboradores SET endereco = NEW.endereco WHERE id = v_colab_id AND coalesce(endereco,'') = '';
  END IF;
  IF coalesce(NEW.altura,'') <> '' THEN
    UPDATE colaboradores SET altura = NEW.altura WHERE id = v_colab_id AND coalesce(altura,'') = '';
  END IF;
  IF coalesce(NEW.tamanho_camisa,'') <> '' THEN
    UPDATE colaboradores SET tamanho_camisa = NEW.tamanho_camisa WHERE id = v_colab_id AND coalesce(tamanho_camisa,'') = '';
  END IF;
  IF coalesce(NEW.tamanho_calca,'') <> '' THEN
    UPDATE colaboradores SET tamanho_calca = NEW.tamanho_calca WHERE id = v_colab_id AND coalesce(tamanho_calca,'') = '';
  END IF;
  IF coalesce(NEW.tamanho_sapato,'') <> '' THEN
    UPDATE colaboradores SET tamanho_sapato = NEW.tamanho_sapato WHERE id = v_colab_id AND coalesce(tamanho_sapato,'') = '';
  END IF;
  IF NEW.data_nascimento IS NOT NULL THEN
    UPDATE colaboradores SET data_nascimento = NEW.data_nascimento::text
      WHERE id = v_colab_id AND coalesce(data_nascimento, '') = '';
  END IF;
  IF NEW.status IN ('inativo','demitido') THEN
    UPDATE colaboradores SET ativo = false WHERE id = v_colab_id AND ativo = true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_apont_to_colab ON apont_funcionarios;
CREATE TRIGGER sync_apont_to_colab
  AFTER UPDATE ON apont_funcionarios
  FOR EACH ROW EXECUTE FUNCTION trigger_sync_apont_to_colab();
