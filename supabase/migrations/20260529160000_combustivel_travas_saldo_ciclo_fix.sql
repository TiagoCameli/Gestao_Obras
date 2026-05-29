-- =============================================================================
-- COMB.TRAVAS — Saldo nunca negativo + Ciclo fechado (servidor autoritativo)
-- =============================================================================
-- Spec: docs/superpowers/specs/2026-05-29-combustivel-travas-saldo-ciclo-design.md
--
-- TRAVA 1: nenhuma operação (entrada/saída/transferência) pode deixar o saldo
--   corrido do tanque negativo em NENHUM ponto da linha do tempo.
-- TRAVA 2: ciclo fechado. Marco = entrada OU transferência recebida que chega
--   com o tanque zerado (saldo <= 0,001 antes dela). Movimentos com data antes
--   do marco mais recente ficam travados: não dá pra mudar tanque/quantidade/
--   data (e tipo na entrada/transferência) nem excluir.
--
-- Modelo de saldo = entradas + transf recebidas − saídas − transf enviadas −
--   esvaziamentos, em ordem cronológica. Tanques externos isentos.
-- Tolerância de 0,001 L. Respeita a guarda app.fifo_recomputing (não dispara
--   durante o recálculo FIFO autoritativo).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- Helper: série de movimentos do tanque (delta com sinal + flag de entrada)
--   ord: saídas/esvaz/transf_out (saída, ord=0) antes de entradas/transf_in
--   (entrada, ord=1) no mesmo timestamp → pior caso pro saldo e "antes da
--   entrada" inclui consumo do mesmo instante.
-- ─────────────────────────────────────────────────────────────────────────

-- Menor saldo corrido do tanque (TRAVA 1).
CREATE OR REPLACE FUNCTION private.saldo_min_tanque(p_tanque_id text)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
  WITH mov AS (
    SELECT e.data_hora AS quando, e.quantidade_litros AS delta, 1 AS ord
      FROM public.entradas_combustivel e
     WHERE e.deposito_id = p_tanque_id AND e.deleted_at IS NULL
    UNION ALL
    SELECT t.data_hora, t.quantidade_litros, 1
      FROM public.transferencias_combustivel t
     WHERE t.deposito_destino_id = p_tanque_id AND t.deleted_at IS NULL
    UNION ALL
    SELECT t.data_hora, -t.quantidade_litros, 0
      FROM public.transferencias_combustivel t
     WHERE t.deposito_origem_id = p_tanque_id AND t.deleted_at IS NULL
    UNION ALL
    SELECT s.data, -s.litros, 0
      FROM public.saidas_combustivel s
     WHERE s.tanque_id = p_tanque_id AND s.origem = 'tanque' AND s.deleted_at IS NULL
    UNION ALL
    SELECT ev.data_hora, -ev.litros_descartados, 0
      FROM public.esvaziamentos_tanque ev
     WHERE ev.deposito_id = p_tanque_id
  ),
  r AS (
    SELECT SUM(delta) OVER (ORDER BY quando, ord
                            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS bal
    FROM mov
  )
  SELECT COALESCE(MIN(bal), 0) FROM r;
$$;

-- Início do ciclo aberto = timestamp do marco mais recente (entrada/transf
-- recebida com saldo <= 0,001 imediatamente antes). NULL se nunca houve marco.
CREATE OR REPLACE FUNCTION private.inicio_ciclo_aberto(p_tanque_id text)
RETURNS timestamp
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
  WITH mov AS (
    SELECT e.data_hora AS quando, e.quantidade_litros AS delta, 1 AS infl, 1 AS ord
      FROM public.entradas_combustivel e
     WHERE e.deposito_id = p_tanque_id AND e.deleted_at IS NULL
    UNION ALL
    SELECT t.data_hora, t.quantidade_litros, 1, 1
      FROM public.transferencias_combustivel t
     WHERE t.deposito_destino_id = p_tanque_id AND t.deleted_at IS NULL
    UNION ALL
    SELECT t.data_hora, -t.quantidade_litros, 0, 0
      FROM public.transferencias_combustivel t
     WHERE t.deposito_origem_id = p_tanque_id AND t.deleted_at IS NULL
    UNION ALL
    SELECT s.data, -s.litros, 0, 0
      FROM public.saidas_combustivel s
     WHERE s.tanque_id = p_tanque_id AND s.origem = 'tanque' AND s.deleted_at IS NULL
    UNION ALL
    SELECT ev.data_hora, -ev.litros_descartados, 0, 0
      FROM public.esvaziamentos_tanque ev
     WHERE ev.deposito_id = p_tanque_id
  ),
  r AS (
    SELECT quando, delta, infl,
           SUM(delta) OVER (ORDER BY quando, ord
                            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS bal_after
    FROM mov
  )
  SELECT MAX(quando)
    FROM r
   WHERE infl = 1 AND (bal_after - delta) <= 0.001;  -- saldo antes da entrada <= 0
$$;

CREATE OR REPLACE FUNCTION private.tanque_eh_externo(p_tanque_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private, pg_temp
AS $$ SELECT COALESCE((SELECT eh_externo FROM public.depositos WHERE id = p_tanque_id), false); $$;

-- ─────────────────────────────────────────────────────────────────────────
-- TRAVA 1 — guarda de saldo negativo (AFTER, faz rollback se estourar)
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.assert_saldo_nao_negativo(p_tanque_id text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp
AS $$
DECLARE v_min numeric;
BEGIN
  IF p_tanque_id IS NULL OR private.tanque_eh_externo(p_tanque_id) THEN
    RETURN;
  END IF;
  v_min := private.saldo_min_tanque(p_tanque_id);
  IF v_min < -0.001 THEN
    RAISE EXCEPTION
      'Operação deixaria o tanque "%" com saldo negativo (mínimo % L na linha do tempo). Combustível não pode ficar negativo em nenhum momento.',
      (SELECT nome FROM public.depositos WHERE id = p_tanque_id), round(v_min, 3);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.trg_guard_saldo_saida()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp
AS $$
BEGIN
  IF COALESCE(current_setting('app.fifo_recomputing', true), '') = '1' THEN RETURN NULL; END IF;
  IF TG_OP <> 'INSERT' AND OLD.tanque_id IS NOT NULL THEN
    PERFORM private.assert_saldo_nao_negativo(OLD.tanque_id);
  END IF;
  IF TG_OP <> 'DELETE' AND NEW.tanque_id IS NOT NULL
     AND NEW.tanque_id IS DISTINCT FROM (CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.tanque_id END) THEN
    PERFORM private.assert_saldo_nao_negativo(NEW.tanque_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION private.trg_guard_saldo_entrada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp
AS $$
BEGIN
  IF COALESCE(current_setting('app.fifo_recomputing', true), '') = '1' THEN RETURN NULL; END IF;
  IF TG_OP <> 'INSERT' AND OLD.deposito_id IS NOT NULL THEN
    PERFORM private.assert_saldo_nao_negativo(OLD.deposito_id);
  END IF;
  IF TG_OP <> 'DELETE' AND NEW.deposito_id IS NOT NULL
     AND NEW.deposito_id IS DISTINCT FROM (CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.deposito_id END) THEN
    PERFORM private.assert_saldo_nao_negativo(NEW.deposito_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION private.trg_guard_saldo_transferencia()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp
AS $$
DECLARE v_t text; v_tanques text[] := '{}';
BEGIN
  IF COALESCE(current_setting('app.fifo_recomputing', true), '') = '1' THEN RETURN NULL; END IF;
  IF TG_OP <> 'INSERT' THEN
    v_tanques := v_tanques || OLD.deposito_origem_id || OLD.deposito_destino_id;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    v_tanques := v_tanques || NEW.deposito_origem_id || NEW.deposito_destino_id;
  END IF;
  FOREACH v_t IN ARRAY (SELECT ARRAY(SELECT DISTINCT x FROM unnest(v_tanques) x WHERE x IS NOT NULL))
  LOOP
    PERFORM private.assert_saldo_nao_negativo(v_t);
  END LOOP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_saldo_saida ON public.saidas_combustivel;
CREATE TRIGGER trg_guard_saldo_saida
  AFTER INSERT OR UPDATE OR DELETE ON public.saidas_combustivel
  FOR EACH ROW EXECUTE FUNCTION private.trg_guard_saldo_saida();

DROP TRIGGER IF EXISTS trg_guard_saldo_entrada ON public.entradas_combustivel;
CREATE TRIGGER trg_guard_saldo_entrada
  AFTER INSERT OR UPDATE OR DELETE ON public.entradas_combustivel
  FOR EACH ROW EXECUTE FUNCTION private.trg_guard_saldo_entrada();

DROP TRIGGER IF EXISTS trg_guard_saldo_transferencia ON public.transferencias_combustivel;
CREATE TRIGGER trg_guard_saldo_transferencia
  AFTER INSERT OR UPDATE OR DELETE ON public.transferencias_combustivel
  FOR EACH ROW EXECUTE FUNCTION private.trg_guard_saldo_transferencia();

-- ─────────────────────────────────────────────────────────────────────────
-- TRAVA 2 — ciclo fechado (BEFORE, impede a operação)
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.trg_lock_ciclo_saida()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp
AS $$
DECLARE v_inicio timestamp;
BEGIN
  IF COALESCE(current_setting('app.fifo_recomputing', true), '') = '1' THEN
    RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF OLD.origem IS DISTINCT FROM 'tanque' OR OLD.tanque_id IS NULL
     OR private.tanque_eh_externo(OLD.tanque_id) THEN
    RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
  END IF;
  v_inicio := private.inicio_ciclo_aberto(OLD.tanque_id);
  IF v_inicio IS NULL OR OLD.data >= v_inicio THEN
    RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;  -- ciclo aberto, liberado
  END IF;
  -- ciclo fechado (DELETE físico OU soft-delete via deleted_at)
  IF TG_OP = 'DELETE' OR (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Ciclo fechado: o tanque "%" já zerou e recebeu combustível novo. Não dá pra excluir esta saída.',
      (SELECT nome FROM public.depositos WHERE id = OLD.tanque_id);
  END IF;
  IF NEW.tanque_id IS DISTINCT FROM OLD.tanque_id
     OR NEW.litros IS DISTINCT FROM OLD.litros
     OR NEW.data IS DISTINCT FROM OLD.data THEN
    RAISE EXCEPTION 'Ciclo fechado no tanque "%": só dá pra ajustar equipamento, obra, etapa, fotos, observação e medição. Tanque, litros e data estão travados.',
      (SELECT nome FROM public.depositos WHERE id = OLD.tanque_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.trg_lock_ciclo_entrada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp
AS $$
DECLARE v_inicio timestamp;
BEGIN
  IF COALESCE(current_setting('app.fifo_recomputing', true), '') = '1' THEN
    RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF OLD.deposito_id IS NULL OR private.tanque_eh_externo(OLD.deposito_id) THEN
    RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
  END IF;
  v_inicio := private.inicio_ciclo_aberto(OLD.deposito_id);
  IF v_inicio IS NULL OR OLD.data_hora >= v_inicio THEN
    RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'DELETE' OR (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Ciclo fechado: o tanque "%" já zerou e recebeu combustível novo depois desta entrada. Não dá pra excluir.',
      (SELECT nome FROM public.depositos WHERE id = OLD.deposito_id);
  END IF;
  IF NEW.deposito_id IS DISTINCT FROM OLD.deposito_id
     OR NEW.quantidade_litros IS DISTINCT FROM OLD.quantidade_litros
     OR NEW.data_hora IS DISTINCT FROM OLD.data_hora
     OR NEW.tipo_combustivel IS DISTINCT FROM OLD.tipo_combustivel THEN
    RAISE EXCEPTION 'Ciclo fechado no tanque "%": entrada travada. Só dá pra ajustar fornecedor, nota, fotos e observação.',
      (SELECT nome FROM public.depositos WHERE id = OLD.deposito_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.trg_lock_ciclo_transferencia()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, pg_temp
AS $$
DECLARE v_io timestamp; v_id timestamp; v_fechado boolean := false;
BEGIN
  IF COALESCE(current_setting('app.fifo_recomputing', true), '') = '1' THEN
    RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
  END IF;
  -- fechado se a transferência é anterior ao ciclo aberto de QUALQUER tanque que toca
  IF OLD.deposito_origem_id IS NOT NULL AND NOT private.tanque_eh_externo(OLD.deposito_origem_id) THEN
    v_io := private.inicio_ciclo_aberto(OLD.deposito_origem_id);
    IF v_io IS NOT NULL AND OLD.data_hora < v_io THEN v_fechado := true; END IF;
  END IF;
  IF OLD.deposito_destino_id IS NOT NULL AND NOT private.tanque_eh_externo(OLD.deposito_destino_id) THEN
    v_id := private.inicio_ciclo_aberto(OLD.deposito_destino_id);
    IF v_id IS NOT NULL AND OLD.data_hora < v_id THEN v_fechado := true; END IF;
  END IF;
  IF NOT v_fechado THEN
    RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'DELETE' OR (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Ciclo fechado: esta transferência é de um ciclo já encerrado (tanque zerou e recebeu combustível novo). Não dá pra excluir.';
  END IF;
  IF NEW.deposito_origem_id IS DISTINCT FROM OLD.deposito_origem_id
     OR NEW.deposito_destino_id IS DISTINCT FROM OLD.deposito_destino_id
     OR NEW.quantidade_litros IS DISTINCT FROM OLD.quantidade_litros
     OR NEW.data_hora IS DISTINCT FROM OLD.data_hora
     OR NEW.tipo_combustivel IS DISTINCT FROM OLD.tipo_combustivel THEN
    RAISE EXCEPTION 'Ciclo fechado: transferência travada. Só dá pra ajustar fotos e observação.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_ciclo_saida ON public.saidas_combustivel;
CREATE TRIGGER trg_lock_ciclo_saida
  BEFORE UPDATE OR DELETE ON public.saidas_combustivel
  FOR EACH ROW EXECUTE FUNCTION private.trg_lock_ciclo_saida();

DROP TRIGGER IF EXISTS trg_lock_ciclo_entrada ON public.entradas_combustivel;
CREATE TRIGGER trg_lock_ciclo_entrada
  BEFORE UPDATE OR DELETE ON public.entradas_combustivel
  FOR EACH ROW EXECUTE FUNCTION private.trg_lock_ciclo_entrada();

DROP TRIGGER IF EXISTS trg_lock_ciclo_transferencia ON public.transferencias_combustivel;
CREATE TRIGGER trg_lock_ciclo_transferencia
  BEFORE UPDATE OR DELETE ON public.transferencias_combustivel
  FOR EACH ROW EXECUTE FUNCTION private.trg_lock_ciclo_transferencia();

-- ─────────────────────────────────────────────────────────────────────────
-- Performance: índice usado pelos recálculos/saldo por tanque
-- ─────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_saidas_combustivel_tanque_data
  ON public.saidas_combustivel(tanque_id, data);

REVOKE ALL ON FUNCTION private.saldo_min_tanque(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.inicio_ciclo_aberto(text) FROM PUBLIC, anon;

-- RPC pública pro app saber se um movimento está em ciclo fechado.
CREATE OR REPLACE FUNCTION public.inicio_ciclo_aberto_tanque(p_tanque_id text)
RETURNS timestamp LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private, pg_temp
AS $$ SELECT private.inicio_ciclo_aberto(p_tanque_id); $$;
REVOKE ALL ON FUNCTION public.inicio_ciclo_aberto_tanque(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inicio_ciclo_aberto_tanque(text) TO authenticated;
