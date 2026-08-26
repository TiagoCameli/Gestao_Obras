-- Preenche a única placa que faltava nos abastecimentos da Andrade
--
-- Lançamento mt8xfv6x97umm — 17/08/2026 12:12, 80 L, R$ 520,00, tanque Posto
-- Progresso, motorista ARNILDON REIS ALVES, lançado pela Andreia.
--
-- Ficou de fora de fix_andrade_placas_e_motoristas.sql porque a placa não era
-- dedutível: o Arnildon dirige DUAS carretas (RSX0D29, com 55 lançamentos, e
-- RSX0E39, com 7). Confirmado pelo Tiago em 26/08/2026: é a RSX0D29.
--
-- Com isso os 212 abastecimentos da Andrade ficam com placa E motorista.
--
-- Rollback: rollback_andrade_placa_faltante.sql

begin;

update public.saidas_combustivel
   set placa = 'RSX0D29'
 where id = 'mt8xfv6x97umm'
   and btrim(coalesce(placa,''), E' \t\r\n') = '';

do $$
declare n int; v numeric;
begin
  select count(*) into n from public.saidas_combustivel
   where transportadora_id = 'mn921nnyuvp1t' and deleted_at is null
     and btrim(coalesce(placa,''), E' \t\r\n') = '';
  if n <> 0 then raise exception 'Ainda restam % abastecimento(s) sem placa.', n; end if;

  select valor_total into v from public.saidas_combustivel where id = 'mt8xfv6x97umm';
  if round(v,4) <> 520.0000 then raise exception 'valor_total mudou: %. Abortando.', v; end if;
end $$;

commit;
