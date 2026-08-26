-- Rollback de fix_andrade_placa_faltante.sql
-- Devolve o lançamento mt8xfv6x97umm ao estado sem placa.

begin;

update public.saidas_combustivel
   set placa = ''
 where id = 'mt8xfv6x97umm';

commit;
