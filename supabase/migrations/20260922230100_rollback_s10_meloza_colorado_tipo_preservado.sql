-- Rollback de 20260922230000_s10_meloza_colorado_tipo_preservado.sql. Só para emergência.
-- Repõe fn_validate_saida_combustivel como estava em 22/09 de manhã (cópia da
-- 20260922110000_sync_combustivel_banco_vivo.sql) e o carimbo S10 das duas saídas.
-- O UPDATE dispara o recálculo do FIFO do tanque, que volta ao estado anterior.

CREATE OR REPLACE FUNCTION public.fn_validate_saida_combustivel()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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

  -- COALESCE: nunca troca um tipo valido por NULL.
  NEW.tipo_combustivel := COALESCE(
    public.calcular_combustivel_tanque_na_data(NEW.tanque_id, v_data_text),
    NEW.tipo_combustivel
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
$function$;

update public.saidas_combustivel
   set tipo_combustivel = 'mlplpomwf0uod'
 where id in ('mfuelbkf31', 'mfuelbkf32');
