-- HF.7 follow-up: fn_saidas_combustivel_movimentos deve ser SECURITY DEFINER
-- pra bypassar a nova policy de INSERT em transportadora_movimentos.
--
-- A policy 'transportadora_movimentos_insert' criada em HF.7 (20260521120400)
-- exige private.current_has_action('gerenciar_permissoes') — restrita a admin.
-- A trigger fn_saidas_combustivel_movimentos é chamada quando uma saída tipo
-- carreta é registrada por qualquer operador (não-admin). Sem SECDEF, a trigger
-- roda como o role do invocador → INSERT em transportadora_movimentos é
-- bloqueado pela policy → fluxo carreta quebra.
--
-- Fix: marcar a função como SECDEF (roda como postgres, owner da tabela,
-- bypassa RLS) + SET search_path = public, pg_temp (defesa contra schema
-- shadowing).

ALTER FUNCTION public.fn_saidas_combustivel_movimentos()
  SECURITY DEFINER
  SET search_path = public, pg_temp;
