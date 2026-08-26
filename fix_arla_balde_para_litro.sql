-- Arla lançado em BALDE vira Arla em LITRO
--
-- Problema: o insumo Arla (mlprklw2nm0up) está cadastrado com unidade "litro",
-- mas 81 saídas foram lançadas com o balde como unidade: o campo `litros`
-- recebeu a QUANTIDADE DE BALDES (1 a 4) e o preço recebeu o valor do balde
-- (R$ 130,00 ou R$ 150,00). Os outros 118 lançamentos usam litro de verdade
-- (20 a 100 L, a R$ 6,50 ou R$ 7,50).
--
-- O balde é de 20 L, e isso não é chute: os dois pares de preço fecham exato.
--   R$ 130,00 / R$ 6,50 = 20      R$ 150,00 / R$ 7,50 = 20
--
-- O dinheiro sempre esteve certo (litros × preço = valor_total nos 199
-- lançamentos). O que está errado é só a unidade, e por isso o consumo de Arla
-- aparece 3.572 L menor do que foi.
--
-- Segurança: as 81 saídas estão TODAS em tanque externo (80 Transterra Areacre,
-- 1 Posto Progresso). Nesses tanques o nível não é controlado
-- (recalcular_nivel_deposito usa GREATEST(...,0) e não há entradas) e
-- private.recompute_fifo_tanque tem curto-circuito explícito para eh_externo,
-- então a conversão não mexe em estoque nem reprecifica saída nenhuma.
--
-- Conta corrente: o crédito do dono do tanque é
--   litros × (preco_combustivel_areacre + taxa_litro)
-- e `taxa_litro` é ZERO nas 81. Multiplicar litros por 20 e dividir o preço por
-- 20 deixa crédito e débito idênticos — ensaiado em transação desfeita:
--   litros 5.348 -> 8.920 | dinheiro R$ 66.200,00 -> R$ 66.200,00 (delta 0)
--   conta corrente líquida -R$ 36.450,00 -> -R$ 36.450,00 (delta 0)
--
-- Rollback: rollback_arla_balde_para_litro.sql (restaura da tabela de backup).

begin;

-- 1) Backup dos valores originais. DROP previsto para 26/10/2026 (60 dias).
create table if not exists public.saidas_arla_backup_20260826 as
select id, litros, preco_combustivel, preco_combustivel_areacre, preco_unitario, valor_total
  from public.saidas_combustivel
 where tipo_combustivel = 'mlprklw2nm0up'
   and deleted_at is null
   and preco_combustivel in (130, 150);

comment on table public.saidas_arla_backup_20260826 is
  'Backup de fix_arla_balde_para_litro.sql (26/08/2026). Só serve ao rollback. DROP previsto 26/10/2026.';

-- 2) A conversão. `valor_total` NÃO entra: ele já está correto.
update public.saidas_combustivel
   set litros                    = litros * 20,
       preco_combustivel         = preco_combustivel / 20,
       preco_combustivel_areacre = preco_combustivel_areacre / 20,
       preco_unitario            = preco_unitario / 20
 where tipo_combustivel = 'mlprklw2nm0up'
   and deleted_at is null
   and preco_combustivel in (130, 150);

-- 3) Guardas: aborta se o dinheiro tiver se mexido.
do $$
declare n int;
begin
  select count(*) into n from public.saidas_arla_backup_20260826;
  if n <> 81 then
    raise exception 'Esperava 81 linhas no backup, achei %. Abortando.', n;
  end if;

  select count(*) into n
    from public.saidas_combustivel
   where tipo_combustivel = 'mlprklw2nm0up' and deleted_at is null
     and round(litros * preco_combustivel, 4) <> round(valor_total, 4);
  if n <> 0 then
    raise exception '% linha(s) de Arla com litros*preco <> valor_total. Abortando.', n;
  end if;

  select count(*) into n
    from public.saidas_combustivel s
    join public.saidas_arla_backup_20260826 b on b.id = s.id
   where round(s.valor_total, 4) <> round(b.valor_total, 4);
  if n <> 0 then
    raise exception '% linha(s) tiveram valor_total alterado. Abortando.', n;
  end if;
end $$;

commit;
