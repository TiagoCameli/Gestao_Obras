-- HF.11 — Triggers de recálculo: cobrir UPDATE que muda tanque/depósito.
--
-- Bug #3 — fn_trigger_recalcular_nivel_transferencia:
--   Quando UPDATE muda deposito_origem_id ou deposito_destino_id, o trigger
--   recalculava apenas os NEW tanques, deixando os OLD com saldo errado
--   (não devolviam os litros). Sintoma reportado: editar tanque de uma
--   transferência mantém saldos antigos errados.
--
-- Bug #8 — fn_trigger_recalcular_nivel_esvazia: mesma falha em esvaziamentos
--   (raro mexer em deposito_id, mas a falha existe).
--
-- Fix: espelhar o padrão correto já em uso em fn_trigger_recalcular_nivel_entrada
-- e _saida — quando OLD.<tanque_id> IS DISTINCT FROM NEW.<tanque_id>, também
-- recalcular o antigo. Idempotente via CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.fn_trigger_recalcular_nivel_transferencia()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF tg_op = 'DELETE' THEN
    IF old.deposito_origem_id IS NOT NULL THEN
      PERFORM public.recalcular_nivel_deposito(old.deposito_origem_id);
    END IF;
    IF old.deposito_destino_id IS NOT NULL THEN
      PERFORM public.recalcular_nivel_deposito(old.deposito_destino_id);
    END IF;
    RETURN old;
  END IF;

  -- Recalcula NOVOS (sempre)
  IF new.deposito_origem_id IS NOT NULL THEN
    PERFORM public.recalcular_nivel_deposito(new.deposito_origem_id);
  END IF;
  IF new.deposito_destino_id IS NOT NULL THEN
    PERFORM public.recalcular_nivel_deposito(new.deposito_destino_id);
  END IF;

  -- Em UPDATE, se origem ou destino MUDARAM, também recalcula os antigos
  -- (que ficariam com saldo errado se não devolvêssemos os litros).
  IF tg_op = 'UPDATE' THEN
    IF old.deposito_origem_id IS DISTINCT FROM new.deposito_origem_id
       AND old.deposito_origem_id IS NOT NULL THEN
      PERFORM public.recalcular_nivel_deposito(old.deposito_origem_id);
    END IF;
    IF old.deposito_destino_id IS DISTINCT FROM new.deposito_destino_id
       AND old.deposito_destino_id IS NOT NULL THEN
      PERFORM public.recalcular_nivel_deposito(old.deposito_destino_id);
    END IF;
  END IF;

  RETURN new;
END;
$$;


CREATE OR REPLACE FUNCTION public.fn_trigger_recalcular_nivel_esvazia()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF tg_op = 'DELETE' THEN
    IF old.deposito_id IS NOT NULL THEN
      PERFORM public.recalcular_nivel_deposito(old.deposito_id);
    END IF;
    RETURN old;
  END IF;

  IF new.deposito_id IS NOT NULL THEN
    PERFORM public.recalcular_nivel_deposito(new.deposito_id);
  END IF;

  IF tg_op = 'UPDATE'
     AND old.deposito_id IS DISTINCT FROM new.deposito_id
     AND old.deposito_id IS NOT NULL THEN
    PERFORM public.recalcular_nivel_deposito(old.deposito_id);
  END IF;

  RETURN new;
END;
$$;
