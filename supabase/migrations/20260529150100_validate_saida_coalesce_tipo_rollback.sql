-- ROLLBACK de 20260529150000_validate_saida_coalesce_tipo_fix.sql
-- Restaura fn_validate_saida_combustivel ao comportamento original
-- (auto-stamp direto, sem COALESCE). Baseline: 20260522030000.
--
-- ATENÇÃO: reverter reintroduz o bug 23502 (NULL em tipo_combustivel)
-- em tanques que contenham saídas "NULL-stamp". Só use se necessário.

CREATE OR REPLACE FUNCTION public.fn_validate_saida_combustivel()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_eh_externo boolean;
  v_nome_tanque text;
  v_saldo numeric;
  v_data_text text;
  v_excluir text;
  v_skip_saldo boolean := false;
BEGIN
  IF NEW.origem IS DISTINCT FROM 'tanque' OR NEW.tanque_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT eh_externo, nome
    INTO v_eh_externo, v_nome_tanque
    FROM public.depositos
   WHERE id = NEW.tanque_id;

  IF COALESCE(v_eh_externo, false) THEN
    RETURN NEW;
  END IF;

  v_data_text := NEW.data::text;

  -- (a) Auto-stamp do tipo_combustivel
  NEW.tipo_combustivel := public.calcular_combustivel_tanque_na_data(
    NEW.tanque_id,
    v_data_text
  );

  IF TG_OP = 'UPDATE'
     AND OLD.litros = NEW.litros
     AND OLD.data = NEW.data
     AND OLD.tanque_id IS NOT DISTINCT FROM NEW.tanque_id
     AND OLD.origem IS NOT DISTINCT FROM NEW.origem
  THEN
    v_skip_saldo := true;
  END IF;

  IF NOT v_skip_saldo THEN
    v_excluir := CASE WHEN TG_OP = 'UPDATE' THEN NEW.id ELSE NULL END;
    v_saldo := public.calcular_estoque_combustivel_na_data(
      NEW.tanque_id,
      v_data_text,
      v_excluir
    );

    IF NEW.litros > v_saldo THEN
      RAISE EXCEPTION
        'Saldo insuficiente no tanque "%": disponível % L em %, tentativa de saída de % L.',
        COALESCE(v_nome_tanque, NEW.tanque_id),
        v_saldo,
        v_data_text,
        NEW.litros;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
