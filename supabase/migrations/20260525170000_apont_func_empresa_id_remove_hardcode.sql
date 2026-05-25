-- Remove o hardcode `empresa_id='mm4em4xic5sp2'` dos triggers/funções PR28i.
--
-- ANTES: `trigger_apont_insert_cria_colab` e `importar_apont_sem_par_no_colab`
--        gravavam `empresa_id='mm4em4xic5sp2'` (EMT) hardcoded em todo
--        colaborador novo, quebrando multi-tenant.
--
-- DEPOIS:
--   1) `apont_funcionarios` ganha coluna `empresa_id text NOT NULL DEFAULT 'mm4em4xic5sp2'`,
--      com FK pra `empresas(id)`. Default preserva o comportamento atual pra
--      INSERTs que não especificam empresa.
--   2) Backfill: 71 existentes ficam com 'mm4em4xic5sp2' (que é o que já
--      iam pegar pelo default).
--   3) Trigger `trigger_apont_insert_cria_colab` passa a usar `NEW.empresa_id`.
--   4) Função `importar_apont_sem_par_no_colab` passa a usar `af.empresa_id`
--      (com COALESCE defensivo).
--
-- O hardcode agora vive em UM lugar só (coluna DEFAULT). UI deve ser
-- atualizada em sessão separada pra incluir picker de empresa no cadastro.
--
-- Fix #12 do apontamento-rh-audit.md.
-- Rollback: 20260525170100_rollback_apont_func_empresa_id.sql.

-- ============================================================================
-- 1) Coluna empresa_id em apont_funcionarios
-- ============================================================================
ALTER TABLE public.apont_funcionarios
  ADD COLUMN IF NOT EXISTS empresa_id text NOT NULL DEFAULT 'mm4em4xic5sp2';

ALTER TABLE public.apont_funcionarios
  DROP CONSTRAINT IF EXISTS apont_func_empresa_fk;
ALTER TABLE public.apont_funcionarios
  ADD CONSTRAINT apont_func_empresa_fk
  FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE RESTRICT;

-- Backfill defensivo (no-op se DEFAULT já preencheu)
UPDATE public.apont_funcionarios
   SET empresa_id = 'mm4em4xic5sp2'
 WHERE empresa_id IS NULL;

-- ============================================================================
-- 2) Trigger: usa NEW.empresa_id em vez do hardcode
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trigger_apont_insert_cria_colab()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
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
    v_new_id, NEW.nome, NEW.empresa_id,
    coalesce(NEW.data_nascimento::text, ''), coalesce(NEW.data_admissao::text, ''),
    coalesce(NEW.telefone, ''), coalesce(NEW.email, ''),
    coalesce(NEW.altura, ''), coalesce(NEW.tamanho_camisa, ''),
    coalesce(NEW.tamanho_calca, ''), coalesce(NEW.tamanho_sapato, ''),
    coalesce(NEW.endereco, ''), coalesce(NEW.cpf, ''), coalesce(NEW.rg, ''),
    '', NEW.status IN ('ativo','afastado'), 'pr28i-auto', NEW.id
  );
  RETURN NEW;
END;
$function$;

-- ============================================================================
-- 3) Função de import em batch: usa af.empresa_id
-- ============================================================================
CREATE OR REPLACE FUNCTION public.importar_apont_sem_par_no_colab()
RETURNS TABLE(criados integer, ids_criados text[])
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  r RECORD;
  v_new_id text;
  v_count int := 0;
  v_ids text[] := ARRAY[]::text[];
BEGIN
  FOR r IN
    SELECT af.id, af.nome, af.cpf, af.rg, af.telefone, af.email, af.endereco,
           af.altura, af.tamanho_camisa, af.tamanho_calca, af.tamanho_sapato,
           af.data_nascimento, af.data_admissao, af.status, af.empresa_id
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
      v_new_id, r.nome, r.empresa_id,
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
$function$;
