-- Rollback de fix_frete_emt_tarifa_037.sql
--
-- Devolve os 121 fretes da EMT TRANSPORTES de 14/05/2026 em diante à tarifa de
-- 0,35, restaurando os valores LITERAIS gravados em
-- private.bkp_fretes_tarifa_20260901 — não recalculando pela fórmula, para o
-- caso de alguma linha já não bater com ela.
--
-- O crédito na conta corrente da transportadora volta sozinho: o
-- trg_fretes_movimentos reescreve transportadora_movimentos.valor no UPDATE.
--
-- Total volta de R$ 1.506.789,84 para R$ 1.425.341,74 (- R$ 81.448,10).
--
-- Se quiser desfazer SÓ as transferências (39 fretes, R$ 6.055,00), acrescente
--   and b.tipo = 'transferencia'
-- na cláusula do update.

begin;

update public.fretes f
   set valor_tkm   = b.valor_tkm_original,
       valor_total = b.valor_total_original
  from private.bkp_fretes_tarifa_20260901 b
 where f.id = b.id;

do $$
declare n int; v numeric; e numeric;
begin
  select count(*) into n
    from private.bkp_fretes_tarifa_20260901 b
    join public.fretes f on f.id = b.id
   where f.valor_tkm is distinct from b.valor_tkm_original
      or f.valor_total is distinct from b.valor_total_original;
  if n <> 0 then raise exception '% frete(s) não voltaram ao original.', n; end if;

  select round(sum(f.valor_total), 2) into v from public.fretes f
   where f.deleted_at is null and f.transportadora = 'EMT TRANSPORTES' and f.data >= '2026-05-14';
  select round(sum(tm.valor), 2) into e
    from public.transportadora_movimentos tm
    join public.fretes f on f.id = tm.origem_id and tm.origem_tabela = 'fretes'
   where f.deleted_at is null and f.transportadora = 'EMT TRANSPORTES' and f.data >= '2026-05-14';
  if v is distinct from e then
    raise exception 'Extrato (%) não casa com os fretes (%) após o rollback.', e, v;
  end if;
  if v <> 1425341.74 then raise exception 'Total esperado 1425341.74, veio %.', v; end if;
end $$;

commit;

-- Depois de conferir, a tabela de backup pode sair:
--   drop table private.bkp_fretes_tarifa_20260901;
