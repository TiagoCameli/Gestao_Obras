-- ROLLBACK da 20260525170000_apont_func_empresa_id_remove_hardcode.sql.
--
-- ⚠️  NÃO aplique a menos que algo quebre. Restaura o hardcode
-- `empresa_id='mm4em4xic5sp2'` nos triggers/funções e remove a coluna
-- de apont_funcionarios. PRESERVA a integridade dos dados existentes
-- — colaboradores criados pelos triggers ficam com EMT (que era o
-- valor padrão antes).

-- 1) Restaura função de import com hardcode
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
$function$;

-- 2) Restaura trigger com hardcode
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
$function$;

-- 3) Remove FK e coluna
ALTER TABLE public.apont_funcionarios DROP CONSTRAINT IF EXISTS apont_func_empresa_fk;
ALTER TABLE public.apont_funcionarios DROP COLUMN IF EXISTS empresa_id;
