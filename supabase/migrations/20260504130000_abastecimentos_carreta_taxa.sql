-- Adiciona campo `taxa_litro` em abastecimentos_carreta (R$ adicional por litro,
-- usado em abastecimentos categoria='emt' onde combustível sai do estoque do tanque
-- e a taxa cobre serviço/margem da operação).

alter table public.abastecimentos_carreta
  add column if not exists taxa_litro numeric not null default 0;
