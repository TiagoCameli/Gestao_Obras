-- Backfill: todas as saídas no tanque Transterra (id mori6yyt9owm9)
-- recebem obra_id = 99a8ba7d-1b26-4d19-a983-379d46ac86aa
-- (009 - Manutenção de Rodovia BR-364 (Lote - 09)).
--
-- Hoje: 167 saídas no Transterra, todas com obra_id NULL (backfill da
-- Fase 2 não tinha info de obra). Pedido do usuário: amarrar tudo a
-- esse lote, que é a obra ativa que usa o tanque.

begin;

update public.saidas_combustivel
   set obra_id = '99a8ba7d-1b26-4d19-a983-379d46ac86aa'
 where tanque_id = 'mori6yyt9owm9'
   and obra_id is distinct from '99a8ba7d-1b26-4d19-a983-379d46ac86aa';

do $$
declare
  v_total int;
  v_obra_correta int;
  v_outras int;
begin
  select count(*) into v_total
    from public.saidas_combustivel
   where tanque_id = 'mori6yyt9owm9';

  select count(*) into v_obra_correta
    from public.saidas_combustivel
   where tanque_id = 'mori6yyt9owm9'
     and obra_id = '99a8ba7d-1b26-4d19-a983-379d46ac86aa';

  v_outras := v_total - v_obra_correta;

  if v_outras > 0 then
    raise exception 'Esperado 0 saídas no Transterra fora da obra 009; encontrado %', v_outras;
  end if;

  raise notice 'Backfill OK. % saídas no Transterra agora apontam pra obra 009 (Manutenção BR-364 Lote 09).',
    v_obra_correta;
end $$;

commit;
