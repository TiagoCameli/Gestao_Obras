-- Adiciona FK abastecimentos.equipamento_id → equipamentos(id).
-- A coluna `veiculo` (text livre) é mantida por compatibilidade e auditoria,
-- mas a partir de agora todo lançamento novo deve preencher equipamento_id.
-- Backfill é feito via script (scripts/migrarAbastecimentosVeiculo.mjs)
-- porque envolve matching fuzzy por nome do equipamento.

alter table public.abastecimentos
  add column if not exists equipamento_id text
    references public.equipamentos(id) on delete set null;

create index if not exists abastecimentos_equipamento_idx on public.abastecimentos(equipamento_id);
