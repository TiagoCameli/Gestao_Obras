-- Conta corrente das transportadoras fechada para quem não está logado.
--
-- Achado em 24/09/2026 (levantamento do Frete para o ERP): as views `transportadora_saldos` e
-- `transportadora_movimentos_detalhe` rodam como dono (sem security_invoker) e o `anon` tinha
-- todos os privilégios nelas. Resultado: sem login, a API devolvia os saldos das transportadoras
-- e o extrato inteiro. Autorizado pelo Tiago.
--
-- Só tira o `anon`. Quem está logado continua lendo exatamente como antes: ligar
-- security_invoker faria a RLS de `saidas_combustivel` (ver_frota) esconder os dados de
-- abastecimento no extrato de quem só tem ver_frete, e mudaria o que a tela mostra.
-- Rollback: 20260924150100_rollback_conta_corrente_views_sem_anon.sql

revoke all on public.transportadora_saldos from anon;
revoke all on public.transportadora_movimentos_detalhe from anon;
