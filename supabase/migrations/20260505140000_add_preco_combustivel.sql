-- Separa preço do combustível da taxa em saidas_combustivel (Fase 7).
-- Visibilidade contábil pro form de carreta — usuário poderá entrar
-- preço + taxa em campos distintos. Trigger fn_saidas_combustivel_movimentos
-- NÃO muda: preco_unitario continua sendo a soma e dita o valor_total
-- que vai pra conta corrente. Saldos das transportadoras NÃO mudam.
--
-- Backfill em 2 fases:
--   * carreta_transportadora (167 rows): preco_combustivel = preco_unitario − coalesce(taxa_litro, 0).
--   * equipamento_proprio (756 rows): preco_combustivel = preco_unitario (taxa sempre 0 nesses).
--
-- Validação inline:
--   (a) zero rows com preco_combustivel NULL pós-backfill,
--   (b) preco_combustivel + taxa_litro = preco_unitario (delta < 0.0001) em todas.

begin;

alter table public.saidas_combustivel
  add column if not exists preco_combustivel numeric(14,4);

comment on column public.saidas_combustivel.preco_combustivel is
  'Preço/litro do combustível em si (sem incluir taxa). Para carreta_transportadora, '
  'input manual no form. Para equipamento_proprio, derivado do preço médio do tanque. '
  'preco_unitario = preco_combustivel + taxa_litro.';

update public.saidas_combustivel
   set preco_combustivel = preco_unitario - coalesce(taxa_litro, 0)
 where preco_combustivel is null
   and tipo_consumidor = 'carreta_transportadora';

update public.saidas_combustivel
   set preco_combustivel = preco_unitario
 where preco_combustivel is null
   and tipo_consumidor = 'equipamento_proprio';

do $$
declare
  v_null_count int;
  v_diff_count int;
  v_total int;
begin
  select count(*) into v_null_count
    from public.saidas_combustivel where preco_combustivel is null;
  if v_null_count > 0 then
    raise exception 'Esperado 0 saídas com preco_combustivel NULL pós-backfill; encontrado %', v_null_count;
  end if;

  select count(*) into v_diff_count
    from public.saidas_combustivel
   where abs((preco_combustivel + coalesce(taxa_litro, 0)) - preco_unitario) > 0.0001;
  if v_diff_count > 0 then
    raise exception 'Esperado 0 saídas com preco_combustivel + taxa_litro != preco_unitario; encontrado %', v_diff_count;
  end if;

  select count(*) into v_total from public.saidas_combustivel;
  raise notice 'Backfill OK. preco_combustivel populado em % saídas. Saldos não mudam (trigger inalterado).',
    v_total;
end $$;

commit;
