-- HF.12 — Combustível: validação de capacidade no DB.
--
-- Bug #7 — backdating uma transferência/entrada pra data em que o destino
-- tinha menos litros permite estourar a capacidade atual do tanque, porque
-- o recálculo no AFTER trigger atualiza nivel_atual_litros pra >
-- capacidade_litros silenciosamente.
--
-- Fix: BEFORE INSERT/UPDATE em entradas_combustivel e transferencias_combustivel
-- valida que o saldo do tanque destino APÓS a operação (saldo atual + delta
-- de litros desta operação) não excede a capacidade. Considera saldo de
-- update mode (subtrai litros antigos da operação sendo editada).
--
-- Tanques externos (eh_externo) ficam fora — não temos controle de estoque.
-- Capacidade nula ou zero também passa (não há limite configurado).
--
-- Idempotente via CREATE OR REPLACE + DROP/CREATE trigger.

-- ── (a) Entradas ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_validate_capacidade_entrada()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_capacidade numeric;
  v_nivel_atual numeric;
  v_eh_externo boolean;
  v_nome text;
  v_delta numeric;
  v_novo_nivel numeric;
BEGIN
  IF new.deposito_id IS NULL OR new.deleted_at IS NOT NULL THEN
    RETURN new;
  END IF;

  SELECT capacidade_litros, nivel_atual_litros, eh_externo, nome
    INTO v_capacidade, v_nivel_atual, v_eh_externo, v_nome
    FROM public.depositos
   WHERE id = new.deposito_id;

  IF COALESCE(v_eh_externo, false) OR COALESCE(v_capacidade, 0) <= 0 THEN
    RETURN new;
  END IF;

  -- Delta = nova quantidade - antiga (se UPDATE no mesmo tanque)
  v_delta := new.quantidade_litros;
  IF tg_op = 'UPDATE'
     AND old.deposito_id = new.deposito_id
     AND old.deleted_at IS NULL THEN
    v_delta := v_delta - old.quantidade_litros;
  END IF;

  v_novo_nivel := COALESCE(v_nivel_atual, 0) + v_delta;

  IF v_novo_nivel > v_capacidade THEN
    RAISE EXCEPTION
      'Capacidade excedida no tanque "%": % L atuais + % L = % L, capacidade % L.',
      COALESCE(v_nome, new.deposito_id),
      COALESCE(v_nivel_atual, 0),
      v_delta,
      v_novo_nivel,
      v_capacidade;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_capacidade_entrada ON public.entradas_combustivel;
CREATE TRIGGER trg_validate_capacidade_entrada
  BEFORE INSERT OR UPDATE ON public.entradas_combustivel
  FOR EACH ROW EXECUTE FUNCTION public.fn_validate_capacidade_entrada();

-- ── (b) Transferências ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_validate_capacidade_transferencia()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_capacidade numeric;
  v_nivel_atual numeric;
  v_eh_externo boolean;
  v_nome text;
  v_delta numeric;
  v_novo_nivel numeric;
BEGIN
  IF new.deposito_destino_id IS NULL OR new.deleted_at IS NOT NULL THEN
    RETURN new;
  END IF;

  SELECT capacidade_litros, nivel_atual_litros, eh_externo, nome
    INTO v_capacidade, v_nivel_atual, v_eh_externo, v_nome
    FROM public.depositos
   WHERE id = new.deposito_destino_id;

  IF COALESCE(v_eh_externo, false) OR COALESCE(v_capacidade, 0) <= 0 THEN
    RETURN new;
  END IF;

  -- Delta = novos litros - antigos (se UPDATE com mesmo destino)
  v_delta := new.quantidade_litros;
  IF tg_op = 'UPDATE'
     AND old.deposito_destino_id = new.deposito_destino_id
     AND old.deleted_at IS NULL THEN
    v_delta := v_delta - old.quantidade_litros;
  END IF;

  v_novo_nivel := COALESCE(v_nivel_atual, 0) + v_delta;

  IF v_novo_nivel > v_capacidade THEN
    RAISE EXCEPTION
      'Capacidade excedida no tanque destino "%": % L atuais + % L = % L, capacidade % L.',
      COALESCE(v_nome, new.deposito_destino_id),
      COALESCE(v_nivel_atual, 0),
      v_delta,
      v_novo_nivel,
      v_capacidade;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_capacidade_transferencia ON public.transferencias_combustivel;
CREATE TRIGGER trg_validate_capacidade_transferencia
  BEFORE INSERT OR UPDATE ON public.transferencias_combustivel
  FOR EACH ROW EXECUTE FUNCTION public.fn_validate_capacidade_transferencia();
