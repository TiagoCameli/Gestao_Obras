-- ============================================================
-- Marco 5 PR28c — Fase 2: backfill Colaborador → apont_funcionarios
-- ============================================================
-- NÃO-DESTRUTIVA:
-- 1) Adiciona coluna `telefone` em apont_funcionarios (campo faltava).
-- 2) Cria funções de PREVIEW e APPLY do backfill.
-- 3) Nenhuma função executa automaticamente — só quando o usuário chama
--    `colaborador_to_apont_backfill_apply(p_colaborador_id)` na UI.
-- 4) APPLY nunca sobrescreve valor preenchido — só preenche se vazio.
-- ============================================================

ALTER TABLE apont_funcionarios
  ADD COLUMN IF NOT EXISTS telefone text;

COMMENT ON COLUMN apont_funcionarios.telefone IS
  'Telefone de contato. Adicionado em PR28c (Fase 2 da unificação Colaborador × apont_funcionario).';

DROP FUNCTION IF EXISTS colaborador_to_apont_backfill_preview(text);
CREATE OR REPLACE FUNCTION colaborador_to_apont_backfill_preview(p_colaborador_id text)
RETURNS TABLE (
  campo text,
  valor_apont text,
  valor_colab text,
  vai_preencher boolean
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_apont_id uuid;
BEGIN
  SELECT apont_funcionario_id INTO v_apont_id
  FROM colaboradores
  WHERE id = p_colaborador_id;

  IF v_apont_id IS NULL THEN
    RAISE EXCEPTION 'Colaborador % não está vinculado a nenhum apont_funcionario.', p_colaborador_id;
  END IF;

  RETURN QUERY
  WITH dados AS (
    SELECT
      f.cpf  AS apont_cpf,  c.cpf  AS colab_cpf,
      f.rg   AS apont_rg,   c.rg   AS colab_rg,
      f.telefone  AS apont_tel, c.telefone AS colab_tel,
      f.data_nascimento::text AS apont_nasc, c.data_nascimento AS colab_nasc
    FROM apont_funcionarios f
    JOIN colaboradores c ON c.id = p_colaborador_id
    WHERE f.id = v_apont_id
  )
  SELECT 'cpf'::text,            coalesce(apont_cpf,''),   coalesce(colab_cpf,''),
         (coalesce(apont_cpf,'') = '' AND coalesce(colab_cpf,'') <> '') FROM dados
  UNION ALL
  SELECT 'rg',                   coalesce(apont_rg,''),    coalesce(colab_rg,''),
         (coalesce(apont_rg,'') = '' AND coalesce(colab_rg,'') <> '') FROM dados
  UNION ALL
  SELECT 'telefone',             coalesce(apont_tel,''),   coalesce(colab_tel,''),
         (coalesce(apont_tel,'') = '' AND coalesce(colab_tel,'') <> '') FROM dados
  UNION ALL
  SELECT 'data_nascimento',      coalesce(apont_nasc,''),  coalesce(colab_nasc,''),
         (coalesce(apont_nasc,'') = '' AND coalesce(colab_nasc,'') <> ''
          AND colab_nasc ~ '^\d{4}-\d{2}-\d{2}$') FROM dados;
END;
$$;

COMMENT ON FUNCTION colaborador_to_apont_backfill_preview(text) IS
  'PR28c — Mostra o que seria copiado de um Colaborador (vinculado) para o apont_funcionario correspondente. Não modifica nada.';

DROP FUNCTION IF EXISTS colaborador_to_apont_backfill_apply(text);
CREATE OR REPLACE FUNCTION colaborador_to_apont_backfill_apply(p_colaborador_id text)
RETURNS TABLE (
  campos_preenchidos int,
  detalhe text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_apont_id  uuid;
  v_colab     RECORD;
  v_count     int := 0;
  v_detalhe   text := '';
BEGIN
  SELECT * INTO v_colab FROM colaboradores WHERE id = p_colaborador_id;
  IF v_colab IS NULL THEN
    RAISE EXCEPTION 'Colaborador % não encontrado.', p_colaborador_id;
  END IF;
  v_apont_id := v_colab.apont_funcionario_id;
  IF v_apont_id IS NULL THEN
    RAISE EXCEPTION 'Colaborador % não está vinculado a apont_funcionario.', p_colaborador_id;
  END IF;

  IF coalesce(v_colab.cpf, '') <> '' THEN
    UPDATE apont_funcionarios SET cpf = v_colab.cpf
     WHERE id = v_apont_id AND coalesce(cpf,'') = '';
    IF FOUND THEN v_count := v_count + 1; v_detalhe := v_detalhe || 'cpf '; END IF;
  END IF;

  IF coalesce(v_colab.rg, '') <> '' THEN
    UPDATE apont_funcionarios SET rg = v_colab.rg
     WHERE id = v_apont_id AND coalesce(rg,'') = '';
    IF FOUND THEN v_count := v_count + 1; v_detalhe := v_detalhe || 'rg '; END IF;
  END IF;

  IF coalesce(v_colab.telefone, '') <> '' THEN
    UPDATE apont_funcionarios SET telefone = v_colab.telefone
     WHERE id = v_apont_id AND coalesce(telefone,'') = '';
    IF FOUND THEN v_count := v_count + 1; v_detalhe := v_detalhe || 'telefone '; END IF;
  END IF;

  IF v_colab.data_nascimento ~ '^\d{4}-\d{2}-\d{2}$' THEN
    UPDATE apont_funcionarios SET data_nascimento = v_colab.data_nascimento::date
     WHERE id = v_apont_id AND data_nascimento IS NULL;
    IF FOUND THEN v_count := v_count + 1; v_detalhe := v_detalhe || 'data_nascimento '; END IF;
  END IF;

  RETURN QUERY SELECT v_count, trim(v_detalhe);
END;
$$;

COMMENT ON FUNCTION colaborador_to_apont_backfill_apply(text) IS
  'PR28c — Copia cpf/rg/telefone/data_nascimento do Colaborador para o apont_funcionario vinculado. Nunca sobrescreve valor existente.';
