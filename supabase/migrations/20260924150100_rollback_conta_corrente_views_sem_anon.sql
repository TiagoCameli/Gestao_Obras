-- Rollback de 20260924150000_conta_corrente_views_sem_anon.sql. Reabre as views para o anon
-- (volta a vazar saldo e extrato sem login). Só aplicar se algo público depender delas.

grant all on public.transportadora_saldos to anon;
grant all on public.transportadora_movimentos_detalhe to anon;
