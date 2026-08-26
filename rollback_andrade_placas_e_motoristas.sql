-- Rollback de fix_andrade_placas_e_motoristas.sql
-- Devolve placa e motorista originais nos abastecimentos da Andrade.
--
-- ATENÇÃO: este rollback desfaz SÓ esta leva. A padronização de nome anterior
-- (fix_motoristas_andrade_nome_completo.sql) tem rollback próprio, e a ordem
-- para voltar tudo é: este primeiro, o outro depois.

begin;

update public.saidas_combustivel s
   set placa = b.placa,
       motorista = b.motorista
  from public.saidas_andrade_backup2_20260826 b
 where b.id = s.id
   and (s.placa is distinct from b.placa or s.motorista is distinct from b.motorista);

do $$
declare n int;
begin
  select count(*) into n
    from public.saidas_combustivel s
    join public.saidas_andrade_backup2_20260826 b on b.id = s.id
   where s.placa is distinct from b.placa or s.motorista is distinct from b.motorista;
  if n <> 0 then raise exception 'Rollback não fechou em % linha(s).', n; end if;
end $$;

commit;

-- Só depois de conferir:
-- drop table public.saidas_andrade_backup2_20260826;
