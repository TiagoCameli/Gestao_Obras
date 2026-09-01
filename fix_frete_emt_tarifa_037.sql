-- Sobe a tarifa da EMT TRANSPORTES de 0,35 para 0,37 a partir de 14/05/2026
--
-- A Areacre virou a tarifa num corte limpo: 272 fretes a 0,35 até 13/05/2026 e
-- 196 fretes a 0,37 a partir de 14/05/2026, sem nenhuma sobreposição. A EMT
-- TRANSPORTES ficou para trás — seguiu a 0,35 em todos os 168 fretes dela,
-- inclusive nos 121 posteriores ao corte.
--
-- Pedido do Tiago em 01/09/2026: alinhar a EMT à mesma data de virada.
--
-- Escopo: 121 fretes ativos (deleted_at is null) da EMT TRANSPORTES com
-- data >= 2026-05-14 e valor_tkm = 0,35. Ficam de fora os 47 anteriores ao
-- corte (corretos a 0,35) e 2 apagados no soft delete.
--   82 de material     R$ 1.319.379,24 -> R$ 1.394.772,34  (+ R$ 75.393,10)
--   39 de transferência R$   105.962,50 -> R$   112.017,50  (+ R$  6.055,00)
--   total               R$ 1.425.341,74 -> R$ 1.506.789,84  (+ R$  81.448,10)
--
-- valor_total é derivado: round(peso_toneladas * km_rodados * valor_tkm, 2).
-- Confirmado nos 168 fretes da EMT antes do fix (168/168 batiam). valor_material
-- NÃO entra nessa conta. Mexer só no valor_tkm deixaria o crédito defasado.
--
-- O crédito da transportadora acompanha sozinho: trg_fretes_movimentos, no
-- UPDATE de frete ativo com a mesma transportadora, faz
-- `update transportadora_movimentos set valor = new.valor_total`.
--
-- Backup dos valores originais: private.bkp_fretes_tarifa_20260901
-- (fora do schema public de propósito — o PostgREST não expõe `private`).
--
-- Rollback: rollback_frete_emt_tarifa_037.sql

begin;

create table if not exists private.bkp_fretes_tarifa_20260901 as
select id, transportadora, data, tipo, peso_toneladas, km_rodados,
       valor_tkm   as valor_tkm_original,
       valor_total as valor_total_original,
       now()       as capturado_em
from public.fretes
where deleted_at is null
  and transportadora = 'EMT TRANSPORTES'
  and data >= '2026-05-14'
  and valor_tkm = 0.35;

update public.fretes f
   set valor_tkm   = 0.37,
       valor_total = round((f.peso_toneladas * f.km_rodados * 0.37)::numeric, 2)
  from private.bkp_fretes_tarifa_20260901 b
 where f.id = b.id
   and f.deleted_at is null
   and f.valor_tkm = 0.35;

do $$
declare n int; v numeric; e numeric;
begin
  -- toda a janela ficou a 0,37, e nada antes do corte foi tocado
  select count(*) into n from public.fretes
   where deleted_at is null and transportadora = 'EMT TRANSPORTES'
     and data >= '2026-05-14' and valor_tkm <> 0.37;
  if n <> 0 then raise exception 'Restaram % frete(s) fora de 0,37 na janela.', n; end if;

  select count(*) into n from public.fretes
   where deleted_at is null and transportadora = 'EMT TRANSPORTES'
     and data < '2026-05-14' and valor_tkm <> 0.35;
  if n <> 0 then raise exception '% frete(s) anteriores a 14/05 saíram de 0,35.', n; end if;

  -- valor_total refeito pela fórmula em todas as linhas da janela
  select count(*) into n from public.fretes
   where deleted_at is null and transportadora = 'EMT TRANSPORTES' and data >= '2026-05-14'
     and abs(valor_total - round((peso_toneladas * km_rodados * 0.37)::numeric, 2)) > 0.005;
  if n <> 0 then raise exception '% frete(s) com valor_total fora da fórmula.', n; end if;

  -- o extrato da transportadora tem que casar centavo a centavo com os fretes
  select round(sum(f.valor_total), 2) into v from public.fretes f
   where f.deleted_at is null and f.transportadora = 'EMT TRANSPORTES' and f.data >= '2026-05-14';
  select round(sum(tm.valor), 2) into e
    from public.transportadora_movimentos tm
    join public.fretes f on f.id = tm.origem_id and tm.origem_tabela = 'fretes'
   where f.deleted_at is null and f.transportadora = 'EMT TRANSPORTES' and f.data >= '2026-05-14';
  if v is distinct from e then
    raise exception 'Extrato (%) não casa com os fretes (%).', e, v;
  end if;
  if v <> 1506789.84 then raise exception 'Total esperado 1506789.84, veio %.', v; end if;
end $$;

commit;
