-- Rollback de fix_arla_balde_para_litro.sql
--
-- Devolve as 81 saídas de Arla à unidade balde (litros = nº de baldes,
-- preço = valor do balde), a partir da tabela de backup criada pelo fix.
--
-- Depois do fix não dá para reidentificar essas linhas por preço: elas passam a
-- ter R$ 6,50 / R$ 7,50, iguais aos 118 lançamentos que já estavam em litro.
-- Por isso o rollback depende da tabela de backup — não rode o DROP dela antes
-- de ter certeza de que o fix está bom.

begin;

update public.saidas_combustivel s
   set litros                    = b.litros,
       preco_combustivel         = b.preco_combustivel,
       preco_combustivel_areacre = b.preco_combustivel_areacre,
       preco_unitario            = b.preco_unitario
  from public.saidas_arla_backup_20260826 b
 where b.id = s.id;

do $$
declare n int;
begin
  select count(*) into n
    from public.saidas_combustivel s
    join public.saidas_arla_backup_20260826 b on b.id = s.id
   where round(s.valor_total,4) <> round(b.valor_total,4)
      or s.litros <> b.litros;
  if n <> 0 then
    raise exception 'Rollback não fechou em % linha(s). Abortando.', n;
  end if;
end $$;

commit;

-- Só depois de conferir:
-- drop table public.saidas_arla_backup_20260826;
