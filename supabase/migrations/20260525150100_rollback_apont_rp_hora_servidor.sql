-- ROLLBACK da 20260525150000_apont_rp_hora_servidor.sql.
--
-- ⚠️  NÃO aplique a menos que algo quebre. Remove o trigger; a função
-- fica no schema `private` mas inerte sem o trigger associado.

DROP TRIGGER IF EXISTS apont_rp_valida_hora ON public.apont_registros_ponto;

-- Pra remover a função também, descomente:
-- DROP FUNCTION IF EXISTS private.fn_apont_validar_hora_batida();
