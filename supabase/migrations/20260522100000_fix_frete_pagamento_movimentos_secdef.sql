-- Audit Frete (Item #1 do frete-audit.md): trigger functions de frete
-- precisam ser SECURITY DEFINER para passar a policy granular criada em
-- 20260521120400.
--
-- A policy `transportadora_movimentos_insert` exige `gerenciar_permissoes`.
-- As funções `fn_fretes_movimentos` e `fn_pagamentos_frete_movimentos` são
-- chamadas via trigger AFTER INSERT/UPDATE/DELETE em `fretes` e
-- `pagamentos_frete` por qualquer usuário com `criar_frete` /
-- `criar_pagamento_frete` — não admin. Como rodavam INVOKER, o INSERT em
-- `transportadora_movimentos` falhava silenciosamente → conta-corrente da
-- transportadora não recebia crédito/débito.
--
-- Migration 20260521120500 corrigiu o mesmo problema em
-- `fn_saidas_combustivel_movimentos` mas esqueceu as duas do frete.
--
-- Idempotente.

ALTER FUNCTION public.fn_fretes_movimentos()
  SECURITY DEFINER
  SET search_path = public, pg_temp;

ALTER FUNCTION public.fn_pagamentos_frete_movimentos()
  SECURITY DEFINER
  SET search_path = public, pg_temp;
