-- Hora do servidor em batidas automáticas + bloqueio de batida no futuro.
--
-- ANTES: `pontoApi.ts:286` faz `new Date().toISOString()` no browser; coluna
--        `apont_registros_ponto.hora timestamptz` aceita qualquer valor.
--        Usuário altera relógio do device e bate retroativo/adiantado.
--
-- DEPOIS: trigger BEFORE INSERT `apont_rp_valida_hora`:
--   * origem='automatico'  →  NEW.hora := now()  (server-side, intamperável)
--   * origem='manual'      →  bloqueia hora > now() + 5min (clock skew)
--                             retroativo continua permitido (CriarBatidaModal,
--                             LancamentoManualModal, lote — todos legítimos)
--
-- Fix #5 do apontamento-rh-audit.md.
-- Rollback: 20260525150100_rollback_apont_rp_hora_servidor.sql.

CREATE OR REPLACE FUNCTION private.fn_apont_validar_hora_batida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.origem = 'automatico' THEN
    -- Captura automática: hora vem do server. Ignora qualquer valor enviado
    -- pelo cliente (spoof de device clock impossível).
    NEW.hora := now();
  ELSIF NEW.origem = 'manual' THEN
    -- Manual: aceita retroativo (legítimo pra CriarBatidaModal/lote/correção),
    -- mas bloqueia futuro com margem de 5min pra clock skew.
    IF NEW.hora > now() + interval '5 minutes' THEN
      RAISE EXCEPTION
        'Batida no futuro não é permitida (hora=%, now=%)',
        NEW.hora, now()
        USING ERRCODE = 'P0F02';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION private.fn_apont_validar_hora_batida() IS
  'Sobrescreve hora com now() pra origem=automatico; bloqueia futuro (>5min) pra origem=manual. Errcode P0F02 pra app distinguir.';

DROP TRIGGER IF EXISTS apont_rp_valida_hora ON public.apont_registros_ponto;
CREATE TRIGGER apont_rp_valida_hora
  BEFORE INSERT ON public.apont_registros_ponto
  FOR EACH ROW EXECUTE FUNCTION private.fn_apont_validar_hora_batida();
