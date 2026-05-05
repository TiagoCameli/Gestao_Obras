-- Set preco_combustivel_areacre = 6.10 em todas as saidas Diesel S10
-- na Transterra desde 2026-03-08 (decisão operacional do usuário —
-- Areacre fechou preço fixo nesse período). Trigger novo do split
-- (Fase 8) recalcula automaticamente os 85 movimentos
-- credito_abastecimento_transterra correspondentes.
--
-- Filtros:
--   tanque_id = 'mori6yyt9owm9' (Transterra Areacre)
--   tipo_combustivel = 'mlplpomwf0uod' (Diesel S10)
--   data >= '2026-03-08'
--
-- Δ esperado saldo Areacre: -R$ 45.248,37 (cai de R$ 501.807,84 → R$ 456.559,47).

begin;

update public.saidas_combustivel
   set preco_combustivel_areacre = 6.10
 where tanque_id = 'mori6yyt9owm9'
   and tipo_combustivel = 'mlplpomwf0uod'
   and data >= '2026-03-08';

do $$
declare
  v_count_total int;
  v_count_outliers int;
  v_sum_credito numeric;
begin
  -- Conta saidas matching o filtro
  select count(*) into v_count_total
    from public.saidas_combustivel
   where tanque_id = 'mori6yyt9owm9'
     and tipo_combustivel = 'mlplpomwf0uod'
     and data >= '2026-03-08';

  -- Após o UPDATE acima, ZERO dessas saidas deve ter preco_areacre != 6.10.
  -- Esse check é robusto contra atividade concorrente (count exato pode mudar
  -- entre pre-check e migration; o invariante é "todas com 6.10").
  select count(*) into v_count_outliers
    from public.saidas_combustivel
   where tanque_id = 'mori6yyt9owm9'
     and tipo_combustivel = 'mlplpomwf0uod'
     and data >= '2026-03-08'
     and (preco_combustivel_areacre is null or preco_combustivel_areacre <> 6.10);

  if v_count_outliers > 0 then
    raise exception 'Esperado 0 saidas Diesel S10 Transterra desde 2026-03-08 com preco_areacre != 6.10; encontrado %', v_count_outliers;
  end if;

  -- Sum credito_abastecimento_transterra dessas saidas (atualizado pelo trigger)
  select coalesce(sum(m.valor), 0) into v_sum_credito
    from public.transportadora_movimentos m
    join public.saidas_combustivel s on s.id = m.origem_id
   where m.tipo = 'credito_abastecimento_transterra'
     and s.tanque_id = 'mori6yyt9owm9'
     and s.tipo_combustivel = 'mlplpomwf0uod'
     and s.data >= '2026-03-08';

  raise notice 'OK. % saidas Diesel S10 Transterra desde 2026-03-08 atualizadas para preco_areacre=6.10. Sum credito recalculado: R$ %.',
    v_count_total, v_sum_credito;
end $$;

commit;
