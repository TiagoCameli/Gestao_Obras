-- Rollback de fix_motoristas_andrade_nome_completo.sql
-- Devolve o texto original do campo motorista nos abastecimentos da Andrade.

begin;

update public.saidas_combustivel s
   set motorista = b.motorista
  from public.saidas_motorista_backup_20260826 b
 where b.id = s.id
   and s.motorista is distinct from b.motorista;

do $$
declare n int;
begin
  select count(*) into n
    from public.saidas_combustivel s
    join public.saidas_motorista_backup_20260826 b on b.id = s.id
   where s.motorista is distinct from b.motorista;
  if n <> 0 then raise exception 'Rollback não fechou em % linha(s).', n; end if;
end $$;

commit;

-- Só depois de conferir:
-- drop table public.saidas_motorista_backup_20260826;
