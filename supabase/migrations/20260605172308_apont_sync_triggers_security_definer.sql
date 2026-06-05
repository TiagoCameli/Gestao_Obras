-- FIX: cadastro de funcionario no Apontamento RH falhava com
-- "new row violates row-level security policy for table colaboradores".
--
-- CAUSA: ao inserir/editar apont_funcionarios, os triggers de sync criam/atualizam
-- a linha espelho em public.colaboradores. As funcoes rodavam como SECURITY INVOKER
-- (o proprio usuario RH). A policy de colaboradores exige a acao 'criar_colaboradores'
-- / 'editar_colaboradores', que o usuario do RH (criar_func_rh) NAO tem. RLS barra o
-- insert do trigger e derruba a transacao inteira -> RH nao consegue salvar.
--
-- Reproduzido como usuario authenticated com criar_func_rh e sem criar_colaboradores:
--   ERROR 42501: new row violates row-level security policy for table "colaboradores"
--   CONTEXT: trigger_apont_insert_cria_colab() line 9
--
-- DECISAO: os triggers de sync sao espelhamento interno controlado (sem SQL dinamico,
-- search_path travado, dono = postgres). Passam a SECURITY DEFINER pra rodar como o
-- dono e ignorar RLS de colaboradores, sem afrouxar nenhuma policy de usuario.
--
-- Idempotente: ALTER FUNCTION ... SECURITY DEFINER pode reaplicar sem efeito colateral.
ALTER FUNCTION public.trigger_apont_insert_cria_colab() SECURITY DEFINER;
ALTER FUNCTION public.trigger_sync_apont_to_colab() SECURITY DEFINER;
