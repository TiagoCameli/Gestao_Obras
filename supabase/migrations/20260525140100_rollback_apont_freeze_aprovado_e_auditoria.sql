-- ROLLBACK da 20260525140000_apont_freeze_aprovado_e_auditoria.sql.
--
-- ⚠️  NÃO aplique a menos que algo quebre. Remove os triggers de freeze
-- e audit; deixa as funções no schema `private` (pra reutilização futura,
-- mas inertes sem trigger).

DROP TRIGGER IF EXISTS apont_rp_freeze_aprovado  ON public.apont_registros_ponto;
DROP TRIGGER IF EXISTS apont_rp_audit            ON public.apont_registros_ponto;
DROP TRIGGER IF EXISTS apont_aps_freeze_aprovado ON public.apont_apontamentos_servico;
DROP TRIGGER IF EXISTS apont_aps_audit           ON public.apont_apontamentos_servico;
DROP TRIGGER IF EXISTS apont_afd_audit           ON public.apont_aprovacao_funcionario_dia;

-- Se quiser remover também as funções, descomente:
-- DROP FUNCTION IF EXISTS private.fn_apont_freeze_aprovado();
-- DROP FUNCTION IF EXISTS private.fn_apont_audit_change();
