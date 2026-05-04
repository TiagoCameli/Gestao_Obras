-- Adiciona coluna `status` em equipamentos com 4 valores:
--   'ativa' (default), 'manutencao_corretiva', 'manutencao_preventiva',
--   'fora_funcionamento'
-- Backfill: ativos viram 'ativa', inativos viram 'fora_funcionamento'.
-- A coluna `ativo` (boolean) continua existindo e é mantida em sincronia
-- pelo app: ativo = (status != 'fora_funcionamento').

alter table public.equipamentos
  add column if not exists status text not null default 'ativa';

update public.equipamentos
  set status = case when ativo then 'ativa' else 'fora_funcionamento' end
  where status = 'ativa';

create index if not exists equipamentos_status_idx on public.equipamentos(status) where ativo;
