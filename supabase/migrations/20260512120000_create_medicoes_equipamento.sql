-- Marco 0 / PR1 — Tabela de leituras de medição (horímetro/odômetro) do equipamento.
--
-- Toda fonte que possa observar a medição corrente do equipamento (abastecimento,
-- checklist, ordem de serviço, apontamento de horas, leitura manual) grava aqui
-- uma linha. A view v_equipamento_medicao_atual retorna a leitura mais recente
-- de cada equipamento.
--
-- Decisões de design:
--   * id text (padrão do app, ids gerados no front).
--   * tipo_medicao redundante com equipamentos.tipo_medicao porque a coluna
--     do equipamento pode mudar (horímetro -> odômetro depois de uma reforma)
--     e queremos preservar o que foi efetivamente observado.
--   * origem é text livre validado por CHECK, não enum, para permitir novas
--     origens sem migration.
--   * valor numeric sem precisão (igual demais campos do app).
--   * foto_urls/arquivo_urls seguem o padrão de anexos das outras tabelas.
--   * ON DELETE CASCADE no equipamento_id: se o equipamento é deletado de fato
--     (hoje raro — soft delete via ativo), as leituras vão junto.

begin;

create table if not exists public.medicoes_equipamento (
  id text primary key,
  equipamento_id text not null references public.equipamentos(id) on delete cascade,
  data timestamptz not null,
  tipo_medicao text not null check (tipo_medicao in ('horimetro', 'odometro', 'km')),
  valor numeric not null check (valor >= 0),
  origem text not null check (origem in (
    'abastecimento',
    'checklist',
    'ordem_servico',
    'apontamento',
    'manual',
    'import'
  )),
  origem_id text,
  observacoes text not null default '',
  foto_urls text[] not null default '{}',
  arquivo_urls text[] not null default '{}',
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now(),
  updated_by text,
  deleted_at timestamptz,
  deleted_by text
);

create index if not exists medicoes_equipamento_equip_data_idx
  on public.medicoes_equipamento (equipamento_id, data desc)
  where deleted_at is null;

create index if not exists medicoes_equipamento_origem_idx
  on public.medicoes_equipamento (origem, origem_id)
  where deleted_at is null;

alter table public.medicoes_equipamento enable row level security;

drop policy if exists "Authenticated full access" on public.medicoes_equipamento;
create policy "Authenticated full access" on public.medicoes_equipamento
  for all to authenticated using (true) with check (true);

comment on table public.medicoes_equipamento is
  'Log cronológico de leituras de horímetro/odômetro/km dos equipamentos. '
  'Fontes: abastecimento, checklist, ordem de serviço, apontamento, leitura manual, importação. '
  'A view v_equipamento_medicao_atual retorna a leitura mais recente por equipamento.';

comment on column public.medicoes_equipamento.tipo_medicao is
  'Snapshot do tipo no momento da leitura. Não confundir com equipamentos.tipo_medicao (a coluna do mestre).';

comment on column public.medicoes_equipamento.origem is
  'De onde veio a leitura: abastecimento | checklist | ordem_servico | apontamento | manual | import.';

comment on column public.medicoes_equipamento.origem_id is
  'ID do registro de origem (saida_combustivel.id, checklist.id, os.id, apontamento.id). NULL para manual/import.';

-- ──────────────────────────────────────────────────────────────────────
-- View v_equipamento_medicao_atual
-- ──────────────────────────────────────────────────────────────────────

create or replace view public.v_equipamento_medicao_atual as
select distinct on (equipamento_id)
  equipamento_id,
  valor       as medicao_atual,
  tipo_medicao,
  data        as data_ultima_leitura,
  origem      as origem_ultima_leitura,
  origem_id   as origem_id_ultima_leitura
from public.medicoes_equipamento
where deleted_at is null
order by equipamento_id, data desc, created_at desc;

comment on view public.v_equipamento_medicao_atual is
  'Última leitura de horímetro/odômetro por equipamento. Use como "medição corrente".';

commit;
