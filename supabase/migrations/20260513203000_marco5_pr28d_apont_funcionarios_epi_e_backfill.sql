-- ============================================================
-- Marco 5 PR28d — Fase 3a: EPI + endereco + email em apont_funcionarios
--                          + backfill estendido (10 campos)
-- ============================================================
-- NÃO-DESTRUTIVA: só adiciona colunas nullable e atualiza as funções.
-- O APPLY continua sem sobrescrever valores preenchidos.
-- ============================================================

ALTER TABLE apont_funcionarios
  ADD COLUMN IF NOT EXISTS altura          text,
  ADD COLUMN IF NOT EXISTS tamanho_camisa  text,
  ADD COLUMN IF NOT EXISTS tamanho_calca   text,
  ADD COLUMN IF NOT EXISTS tamanho_sapato  text,
  ADD COLUMN IF NOT EXISTS endereco        text,
  ADD COLUMN IF NOT EXISTS email           text;

DROP FUNCTION IF EXISTS colaborador_to_apont_backfill_preview(text);
CREATE OR REPLACE FUNCTION colaborador_to_apont_backfill_preview(p_colaborador_id text)
RETURNS TABLE (campo text, valor_apont text, valor_colab text, vai_preencher boolean)
LANGUAGE plpgsql STABLE AS $$
DECLARE v_apont_id uuid;
BEGIN
  SELECT apont_funcionario_id INTO v_apont_id FROM colaboradores WHERE id = p_colaborador_id;
  IF v_apont_id IS NULL THEN RAISE EXCEPTION 'Colaborador % não vinculado.', p_colaborador_id; END IF;
  RETURN QUERY
  WITH dados AS (
    SELECT
      f.cpf, c.cpf AS c_cpf,
      f.rg, c.rg AS c_rg,
      f.telefone, c.telefone AS c_tel,
      f.email, c.email AS c_email,
      f.endereco, c.endereco AS c_end,
      f.altura, c.altura AS c_altura,
      f.tamanho_camisa, c.tamanho_camisa AS c_camisa,
      f.tamanho_calca, c.tamanho_calca AS c_calca,
      f.tamanho_sapato, c.tamanho_sapato AS c_sapato,
      f.data_nascimento::text AS f_nasc, c.data_nascimento AS c_nasc
    FROM apont_funcionarios f JOIN colaboradores c ON c.id = p_colaborador_id
    WHERE f.id = v_apont_id
  )
  SELECT 'cpf'::text, coalesce(cpf,''), coalesce(c_cpf,''),
         (coalesce(cpf,'')='' AND coalesce(c_cpf,'')<>'') FROM dados
  UNION ALL SELECT 'rg', coalesce(rg,''), coalesce(c_rg,''),
         (coalesce(rg,'')='' AND coalesce(c_rg,'')<>'') FROM dados
  UNION ALL SELECT 'telefone', coalesce(telefone,''), coalesce(c_tel,''),
         (coalesce(telefone,'')='' AND coalesce(c_tel,'')<>'') FROM dados
  UNION ALL SELECT 'email', coalesce(email,''), coalesce(c_email,''),
         (coalesce(email,'')='' AND coalesce(c_email,'')<>'') FROM dados
  UNION ALL SELECT 'endereco', coalesce(endereco,''), coalesce(c_end,''),
         (coalesce(endereco,'')='' AND coalesce(c_end,'')<>'') FROM dados
  UNION ALL SELECT 'altura', coalesce(altura,''), coalesce(c_altura,''),
         (coalesce(altura,'')='' AND coalesce(c_altura,'')<>'') FROM dados
  UNION ALL SELECT 'tamanho_camisa', coalesce(tamanho_camisa,''), coalesce(c_camisa,''),
         (coalesce(tamanho_camisa,'')='' AND coalesce(c_camisa,'')<>'') FROM dados
  UNION ALL SELECT 'tamanho_calca', coalesce(tamanho_calca,''), coalesce(c_calca,''),
         (coalesce(tamanho_calca,'')='' AND coalesce(c_calca,'')<>'') FROM dados
  UNION ALL SELECT 'tamanho_sapato', coalesce(tamanho_sapato,''), coalesce(c_sapato,''),
         (coalesce(tamanho_sapato,'')='' AND coalesce(c_sapato,'')<>'') FROM dados
  UNION ALL SELECT 'data_nascimento', coalesce(f_nasc,''), coalesce(c_nasc,''),
         (coalesce(f_nasc,'')='' AND coalesce(c_nasc,'')<>'' AND c_nasc ~ '^\d{4}-\d{2}-\d{2}$') FROM dados;
END;
$$;

DROP FUNCTION IF EXISTS colaborador_to_apont_backfill_apply(text);
CREATE OR REPLACE FUNCTION colaborador_to_apont_backfill_apply(p_colaborador_id text)
RETURNS TABLE (campos_preenchidos int, detalhe text)
LANGUAGE plpgsql AS $$
DECLARE
  v_apont_id uuid;
  v_colab RECORD;
  v_count int := 0;
  v_detalhe text := '';
BEGIN
  SELECT * INTO v_colab FROM colaboradores WHERE id = p_colaborador_id;
  IF v_colab IS NULL THEN RAISE EXCEPTION 'Colaborador % não encontrado.', p_colaborador_id; END IF;
  v_apont_id := v_colab.apont_funcionario_id;
  IF v_apont_id IS NULL THEN RAISE EXCEPTION 'Colaborador % não vinculado.', p_colaborador_id; END IF;

  IF coalesce(v_colab.cpf,'')<>'' THEN
    UPDATE apont_funcionarios SET cpf=v_colab.cpf WHERE id=v_apont_id AND coalesce(cpf,'')='';
    IF FOUND THEN v_count:=v_count+1; v_detalhe:=v_detalhe||'cpf '; END IF; END IF;
  IF coalesce(v_colab.rg,'')<>'' THEN
    UPDATE apont_funcionarios SET rg=v_colab.rg WHERE id=v_apont_id AND coalesce(rg,'')='';
    IF FOUND THEN v_count:=v_count+1; v_detalhe:=v_detalhe||'rg '; END IF; END IF;
  IF coalesce(v_colab.telefone,'')<>'' THEN
    UPDATE apont_funcionarios SET telefone=v_colab.telefone WHERE id=v_apont_id AND coalesce(telefone,'')='';
    IF FOUND THEN v_count:=v_count+1; v_detalhe:=v_detalhe||'telefone '; END IF; END IF;
  IF coalesce(v_colab.email,'')<>'' THEN
    UPDATE apont_funcionarios SET email=v_colab.email WHERE id=v_apont_id AND coalesce(email,'')='';
    IF FOUND THEN v_count:=v_count+1; v_detalhe:=v_detalhe||'email '; END IF; END IF;
  IF coalesce(v_colab.endereco,'')<>'' THEN
    UPDATE apont_funcionarios SET endereco=v_colab.endereco WHERE id=v_apont_id AND coalesce(endereco,'')='';
    IF FOUND THEN v_count:=v_count+1; v_detalhe:=v_detalhe||'endereco '; END IF; END IF;
  IF coalesce(v_colab.altura,'')<>'' THEN
    UPDATE apont_funcionarios SET altura=v_colab.altura WHERE id=v_apont_id AND coalesce(altura,'')='';
    IF FOUND THEN v_count:=v_count+1; v_detalhe:=v_detalhe||'altura '; END IF; END IF;
  IF coalesce(v_colab.tamanho_camisa,'')<>'' THEN
    UPDATE apont_funcionarios SET tamanho_camisa=v_colab.tamanho_camisa WHERE id=v_apont_id AND coalesce(tamanho_camisa,'')='';
    IF FOUND THEN v_count:=v_count+1; v_detalhe:=v_detalhe||'camisa '; END IF; END IF;
  IF coalesce(v_colab.tamanho_calca,'')<>'' THEN
    UPDATE apont_funcionarios SET tamanho_calca=v_colab.tamanho_calca WHERE id=v_apont_id AND coalesce(tamanho_calca,'')='';
    IF FOUND THEN v_count:=v_count+1; v_detalhe:=v_detalhe||'calca '; END IF; END IF;
  IF coalesce(v_colab.tamanho_sapato,'')<>'' THEN
    UPDATE apont_funcionarios SET tamanho_sapato=v_colab.tamanho_sapato WHERE id=v_apont_id AND coalesce(tamanho_sapato,'')='';
    IF FOUND THEN v_count:=v_count+1; v_detalhe:=v_detalhe||'sapato '; END IF; END IF;
  IF v_colab.data_nascimento ~ '^\d{4}-\d{2}-\d{2}$' THEN
    UPDATE apont_funcionarios SET data_nascimento=v_colab.data_nascimento::date WHERE id=v_apont_id AND data_nascimento IS NULL;
    IF FOUND THEN v_count:=v_count+1; v_detalhe:=v_detalhe||'nascimento '; END IF; END IF;

  RETURN QUERY SELECT v_count, trim(v_detalhe);
END;
$$;
