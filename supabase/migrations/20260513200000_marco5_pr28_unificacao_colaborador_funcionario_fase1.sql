-- ============================================================
-- Marco 5 PR28 — Unificação Colaboradores × Funcionários (FASE 1)
-- ============================================================
--
-- Esta migration é NÃO-DESTRUTIVA:
-- - Apenas adiciona uma coluna nullable em `colaboradores`.
-- - NÃO move, copia, apaga ou modifica nenhum dado existente.
-- - Pode ser revertida sem perda (basta DROP COLUMN).
--
-- O que ela faz:
-- 1. Adiciona `funcionario_id` em colaboradores (FK opcional → funcionarios).
-- 2. Cria função SQL `colaborador_match_funcionario_sugestoes` que sugere
--    pares prováveis (mesmo CPF normalizado OU mesmo nome+nascimento)
--    para colaboradores ainda não vinculados.
--
-- Próximos passos (em PRs separados):
-- - FASE 2: backfill de campos faltantes entre os pares vinculados.
-- - FASE 3: consolidação (funcionarios vira master, colaboradores vira view).
-- ============================================================

-- ── 1. Coluna de vínculo ──
ALTER TABLE colaboradores
  ADD COLUMN IF NOT EXISTS funcionario_id text
  REFERENCES funcionarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_colaboradores_funcionario_id
  ON colaboradores(funcionario_id);

COMMENT ON COLUMN colaboradores.funcionario_id IS
  'FK opcional para funcionarios(id). Quando preenchida, indica que este '
  'colaborador é a mesma pessoa que o funcionario referenciado. Usada na '
  'unificação progressiva dos dois cadastros (PR28). NULL = ainda não vinculado.';

-- ── 2. Função: sugere pares prováveis ──
-- Retorna pares (colaborador_id, funcionario_id, motivo) para colaboradores
-- AINDA NÃO vinculados, onde encontramos um funcionario que pode ser a
-- mesma pessoa por:
--   a) CPF idêntico (após remover máscara — só dígitos)
--   b) Mesmo nome (case-insensitive, trim) E mesma data_nascimento
--
-- A função NÃO altera nenhum dado — só lê e retorna sugestões.
-- Cabe ao usuário revisar e aprovar cada par antes de qualquer vinculação.

CREATE OR REPLACE FUNCTION colaborador_match_funcionario_sugestoes()
RETURNS TABLE (
  colaborador_id text,
  colaborador_nome text,
  colaborador_cpf text,
  colaborador_empresa_id text,
  funcionario_id text,
  funcionario_nome text,
  funcionario_cpf text,
  funcionario_cargo text,
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
    WHERE c.funcionario_id IS NULL
  ),
  func AS (
    SELECT
      f.id,
      f.nome,
      f.cpf,
      f.cargo,
      f.data_nascimento,
      regexp_replace(coalesce(f.cpf, ''), '\D', '', 'g') AS cpf_digits,
      lower(trim(f.nome))                                 AS nome_norm
    FROM funcionarios f
  )
  -- Sugestão A: mesmo CPF (mais forte) — score 100
  SELECT
    colab.id           AS colaborador_id,
    colab.nome         AS colaborador_nome,
    colab.cpf          AS colaborador_cpf,
    colab.empresa_id   AS colaborador_empresa_id,
    func.id            AS funcionario_id,
    func.nome          AS funcionario_nome,
    func.cpf           AS funcionario_cpf,
    func.cargo         AS funcionario_cargo,
    'CPF idêntico'     AS motivo,
    100                AS score
  FROM colab
  JOIN func ON colab.cpf_digits = func.cpf_digits AND length(colab.cpf_digits) = 11

  UNION ALL

  -- Sugestão B: mesmo nome + mesma data de nascimento — score 80
  -- (só usa quando ambos têm data preenchida e nome igual)
  SELECT
    colab.id,
    colab.nome,
    colab.cpf,
    colab.empresa_id,
    func.id,
    func.nome,
    func.cpf,
    func.cargo,
    'Mesmo nome + data de nascimento',
    80
  FROM colab
  JOIN func ON colab.nome_norm = func.nome_norm
           AND colab.data_nascimento = func.data_nascimento
           AND colab.data_nascimento <> ''
           AND NOT EXISTS (
             -- não duplica se já tem match por CPF
             SELECT 1 FROM colab c2 JOIN func f2
               ON c2.cpf_digits = f2.cpf_digits AND length(c2.cpf_digits) = 11
              WHERE c2.id = colab.id AND f2.id = func.id
           )

  ORDER BY score DESC, colaborador_nome, funcionario_nome;
$$;

COMMENT ON FUNCTION colaborador_match_funcionario_sugestoes() IS
  'PR28 — Lista pares (colaborador, funcionario) prováveis para revisão manual. '
  'Não altera nenhum dado. Critérios: CPF idêntico (score 100) ou mesmo nome + '
  'data de nascimento (score 80). Só considera colaboradores ainda não vinculados.';
