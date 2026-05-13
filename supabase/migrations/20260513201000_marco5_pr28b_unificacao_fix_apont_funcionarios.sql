-- ============================================================
-- Marco 5 PR28b — Fix: vínculo correto é com apont_funcionarios
-- ============================================================
-- A migration PR28 anterior criou colaboradores.funcionario_id apontando
-- para `funcionarios` (tabela de USUÁRIOS do sistema, 9 registros).
-- Mas o requisito é unificar com `apont_funcionarios` (57 registros,
-- pessoas do Apontamento RH). Esta migration corrige.
--
-- NÃO-DESTRUTIVA: o vínculo `funcionario_id` nunca chegou a ser usado.
-- ============================================================

-- Remove a função antiga (refeita abaixo apontando para apont_funcionarios)
DROP FUNCTION IF EXISTS colaborador_match_funcionario_sugestoes();

-- Remove a coluna criada por engano (estava nullable e vazia)
ALTER TABLE colaboradores DROP COLUMN IF EXISTS funcionario_id;
DROP INDEX IF EXISTS idx_colaboradores_funcionario_id;

-- Nova coluna: vínculo correto com apont_funcionarios
ALTER TABLE colaboradores
  ADD COLUMN IF NOT EXISTS apont_funcionario_id uuid
  REFERENCES apont_funcionarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_colaboradores_apont_funcionario_id
  ON colaboradores(apont_funcionario_id);

COMMENT ON COLUMN colaboradores.apont_funcionario_id IS
  'FK opcional para apont_funcionarios(id). Quando preenchida, indica que '
  'este colaborador é a mesma pessoa que o funcionário do Apontamento RH '
  'referenciado. Usada na unificação progressiva (PR28). NULL = não vinculado.';

-- Função: sugere pares prováveis (colaborador × apont_funcionario).
-- Critérios:
--   1) CPF idêntico (score 100)
--   2) Mesmo nome (lower+trim) + mesma data_nascimento (score 80)
--   3) Mesmo nome (lower+trim) sem data — score 50 (revisar com cuidado)
CREATE OR REPLACE FUNCTION colaborador_match_apont_funcionario_sugestoes()
RETURNS TABLE (
  colaborador_id text,
  colaborador_nome text,
  colaborador_cpf text,
  colaborador_empresa_id text,
  funcionario_id uuid,
  funcionario_nome text,
  funcionario_cpf text,
  funcionario_funcao text,
  funcionario_tipo_vinculo text,
  motivo text,
  score int
)
LANGUAGE sql
STABLE
AS $$
  WITH colab AS (
    SELECT
      c.id,
      c.nome,
      c.cpf,
      c.empresa_id,
      c.data_nascimento,
      regexp_replace(coalesce(c.cpf, ''), '\D', '', 'g') AS cpf_digits,
      lower(trim(c.nome))                                 AS nome_norm
    FROM colaboradores c
    WHERE c.apont_funcionario_id IS NULL
  ),
  func AS (
    SELECT
      f.id,
      f.nome,
      f.cpf,
      f.funcao,
      f.tipo_vinculo,
      f.data_nascimento,
      regexp_replace(coalesce(f.cpf, ''), '\D', '', 'g') AS cpf_digits,
      lower(trim(f.nome))                                 AS nome_norm
    FROM apont_funcionarios f
  ),
  por_cpf AS (
    SELECT colab.id, colab.nome, colab.cpf, colab.empresa_id,
           func.id, func.nome, func.cpf, func.funcao, func.tipo_vinculo,
           'CPF idêntico' AS motivo, 100 AS score
    FROM colab
    JOIN func ON colab.cpf_digits = func.cpf_digits AND length(colab.cpf_digits) = 11
  ),
  por_nome_data AS (
    SELECT colab.id, colab.nome, colab.cpf, colab.empresa_id,
           func.id, func.nome, func.cpf, func.funcao, func.tipo_vinculo,
           'Mesmo nome + data de nascimento', 80
    FROM colab
    JOIN func ON colab.nome_norm = func.nome_norm
             AND colab.data_nascimento::text <> ''
             AND colab.data_nascimento::text = func.data_nascimento::text
  ),
  por_nome AS (
    SELECT colab.id, colab.nome, colab.cpf, colab.empresa_id,
           func.id, func.nome, func.cpf, func.funcao, func.tipo_vinculo,
           'Mesmo nome (sem data — revisar com atenção)', 50
    FROM colab
    JOIN func ON colab.nome_norm = func.nome_norm
  ),
  todos AS (
    SELECT * FROM por_cpf
    UNION ALL SELECT * FROM por_nome_data
    UNION ALL SELECT * FROM por_nome
  ),
  ranked AS (
    SELECT *,
           ROW_NUMBER() OVER (PARTITION BY colaborador_id, funcionario_id ORDER BY score DESC) AS rn
    FROM todos
  )
  SELECT colaborador_id, colaborador_nome, colaborador_cpf, colaborador_empresa_id,
         funcionario_id, funcionario_nome, funcionario_cpf, funcionario_funcao, funcionario_tipo_vinculo,
         motivo, score
  FROM ranked
  WHERE rn = 1
  ORDER BY score DESC, colaborador_nome, funcionario_nome;
$$;

COMMENT ON FUNCTION colaborador_match_apont_funcionario_sugestoes() IS
  'PR28 — Lista pares prováveis para revisão manual. Critérios: CPF idêntico (100), '
  'nome+nascimento (80), só nome (50).';
