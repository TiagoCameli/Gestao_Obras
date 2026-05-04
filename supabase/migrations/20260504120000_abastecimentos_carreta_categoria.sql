-- Adiciona coluna `categoria` em abastecimentos_carreta para separar
-- abastecimentos da Transterra vs EMT.
-- Backfill: todos os registros existentes são da Transterra.

alter table public.abastecimentos_carreta
  add column if not exists categoria text not null default 'transterra';

create index if not exists abastecimentos_carreta_categoria_idx on public.abastecimentos_carreta(categoria);
