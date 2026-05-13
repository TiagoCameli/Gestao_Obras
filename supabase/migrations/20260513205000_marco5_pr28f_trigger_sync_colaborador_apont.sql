-- ============================================================
-- Marco 5 PR28f — Trigger de sincronização Colaborador → apont_funcionario
-- ============================================================
-- Quando um Colaborador VINCULADO é editado, espelha mudanças no
-- apont_funcionario correspondente.
-- REGRA DE OURO: nunca sobrescreve valor preenchido (exceto nome).
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_sync_colab_to_apont()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_apont_id uuid;
BEGIN
  v_apont_id := NEW.apont_funcionario_id;
  IF v_apont_id IS NULL THEN RETURN NEW; END IF;
  UPDATE apont_funcionarios SET nome = NEW.nome WHERE id = v_apont_id;

  IF coalesce(NEW.cpf,'') <> '' THEN
    UPDATE apont_funcionarios SET cpf = NEW.cpf WHERE id = v_apont_id AND coalesce(cpf,'') = '';
  END IF;
  IF coalesce(NEW.rg,'') <> '' THEN
    UPDATE apont_funcionarios SET rg = NEW.rg WHERE id = v_apont_id AND coalesce(rg,'') = '';
  END IF;
  IF coalesce(NEW.telefone,'') <> '' THEN
    UPDATE apont_funcionarios SET telefone = NEW.telefone WHERE id = v_apont_id AND coalesce(telefone,'') = '';
  END IF;
  IF coalesce(NEW.email,'') <> '' THEN
    UPDATE apont_funcionarios SET email = NEW.email WHERE id = v_apont_id AND coalesce(email,'') = '';
  END IF;
  IF coalesce(NEW.endereco,'') <> '' THEN
    UPDATE apont_funcionarios SET endereco = NEW.endereco WHERE id = v_apont_id AND coalesce(endereco,'') = '';
  END IF;
  IF coalesce(NEW.altura,'') <> '' THEN
    UPDATE apont_funcionarios SET altura = NEW.altura WHERE id = v_apont_id AND coalesce(altura,'') = '';
  END IF;
  IF coalesce(NEW.tamanho_camisa,'') <> '' THEN
    UPDATE apont_funcionarios SET tamanho_camisa = NEW.tamanho_camisa WHERE id = v_apont_id AND coalesce(tamanho_camisa,'') = '';
  END IF;
  IF coalesce(NEW.tamanho_calca,'') <> '' THEN
    UPDATE apont_funcionarios SET tamanho_calca = NEW.tamanho_calca WHERE id = v_apont_id AND coalesce(tamanho_calca,'') = '';
  END IF;
  IF coalesce(NEW.tamanho_sapato,'') <> '' THEN
    UPDATE apont_funcionarios SET tamanho_sapato = NEW.tamanho_sapato WHERE id = v_apont_id AND coalesce(tamanho_sapato,'') = '';
  END IF;
  IF NEW.data_nascimento ~ '^\d{4}-\d{2}-\d{2}$' THEN
    UPDATE apont_funcionarios SET data_nascimento = NEW.data_nascimento::date WHERE id = v_apont_id AND data_nascimento IS NULL;
  END IF;
  IF NEW.ativo = false THEN
    UPDATE apont_funcionarios SET status = 'inativo' WHERE id = v_apont_id AND status = 'ativo';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_colab_to_apont ON colaboradores;
CREATE TRIGGER sync_colab_to_apont
  AFTER UPDATE ON colaboradores
  FOR EACH ROW WHEN (NEW.apont_funcionario_id IS NOT NULL)
  EXECUTE FUNCTION trigger_sync_colab_to_apont();
