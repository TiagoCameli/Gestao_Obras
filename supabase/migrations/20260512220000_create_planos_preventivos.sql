-- Marco 3 / PR14 — Planos preventivos por tipo de equipamento.
--
-- Hierarquia:
--   planos_preventivos       — 1 plano por tipo+fabricante+modelo (ou genérico)
--     └─ plano_atividades    — N atividades dentro do plano (troca óleo motor,
--                              filtros, etc.) com periodicidade por horímetro/
--                              km/dias
--           └─ plano_atividade_pecas — peças padrão consumidas pela atividade
--
--   equipamento_plano        — associa N planos a um equipamento
--   execucoes_atividade      — log de cada execução de uma atividade num
--                              equipamento (alimenta cálculo da próxima)
--
-- Disparo da próxima preventiva:
--   próxima_medicao = última_execução_medicao + periodicidade_horimetro
--   próxima_data = última_execução_data + periodicidade_dias
--   → a que vier primeiro dispara

begin;

create table if not exists public.planos_preventivos (
  id text primary key,
  nome text not null,
  tipo_equipamento text not null,
  fabricante text not null default '',
  modelo_referencia text not null default '',
  ativo boolean not null default true,
  observacoes text not null default '',
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now(),
  updated_by text,
  deleted_at timestamptz,
  deleted_by text
);
create index if not exists planos_preventivos_tipo_idx
  on public.planos_preventivos (tipo_equipamento)
  where deleted_at is null;
alter table public.planos_preventivos enable row level security;
drop policy if exists "Authenticated full access" on public.planos_preventivos;
create policy "Authenticated full access" on public.planos_preventivos
  for all to authenticated using (true) with check (true);

create table if not exists public.plano_atividades (
  id text primary key,
  plano_id text not null references public.planos_preventivos(id) on delete cascade,
  nome text not null,
  categoria text check (categoria is null or categoria in (
    'lubrificacao','filtros','pneus','eletrica','mecanica',
    'hidraulica','inspecao','limpeza','analise_laboratorio'
  )),
  periodicidade_horimetro numeric,
  periodicidade_km numeric,
  periodicidade_dias int,
  tolerancia_percentual numeric not null default 10,
  tempo_estimado_h numeric,
  custo_estimado numeric(14,2),
  procedimento text not null default '',
  obrigatoria boolean not null default true,
  ordem int not null default 0,
  exige_oficina_externa boolean not null default false,
  epi_necessario text[] not null default '{}',
  arquivo_urls text[] not null default '{}',
  created_at timestamptz not null default now(),
  created_by text,
  constraint pa_pelomenos_uma_periodicidade check (
    periodicidade_horimetro is not null
    or periodicidade_km is not null
    or periodicidade_dias is not null
  )
);
create index if not exists plano_atividades_plano_idx
  on public.plano_atividades (plano_id, ordem);
alter table public.plano_atividades enable row level security;
drop policy if exists "Authenticated full access" on public.plano_atividades;
create policy "Authenticated full access" on public.plano_atividades
  for all to authenticated using (true) with check (true);

create table if not exists public.plano_atividade_pecas (
  id text primary key,
  atividade_id text not null references public.plano_atividades(id) on delete cascade,
  insumo_id text not null references public.insumos(id) on delete restrict,
  quantidade numeric not null check (quantidade > 0),
  unidade_medida_id text references public.unidades_medida(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by text
);
create index if not exists plano_atividade_pecas_atv_idx
  on public.plano_atividade_pecas (atividade_id);
alter table public.plano_atividade_pecas enable row level security;
drop policy if exists "Authenticated full access" on public.plano_atividade_pecas;
create policy "Authenticated full access" on public.plano_atividade_pecas
  for all to authenticated using (true) with check (true);

create table if not exists public.equipamento_plano (
  id text primary key,
  equipamento_id text not null references public.equipamentos(id) on delete cascade,
  plano_id text not null references public.planos_preventivos(id) on delete restrict,
  ativo boolean not null default true,
  data_inicio date not null,
  observacoes text not null default '',
  created_at timestamptz not null default now(),
  created_by text,
  constraint equipamento_plano_unique unique (equipamento_id, plano_id)
);
create index if not exists equipamento_plano_equip_idx
  on public.equipamento_plano (equipamento_id)
  where ativo = true;
alter table public.equipamento_plano enable row level security;
drop policy if exists "Authenticated full access" on public.equipamento_plano;
create policy "Authenticated full access" on public.equipamento_plano
  for all to authenticated using (true) with check (true);

create table if not exists public.execucoes_atividade (
  id text primary key,
  equipamento_id text not null references public.equipamentos(id) on delete cascade,
  atividade_id text not null references public.plano_atividades(id) on delete cascade,
  os_id text references public.ordens_servico(id) on delete set null,
  data_execucao timestamptz not null,
  medicao_execucao numeric,
  custo numeric(14,2) not null default 0,
  observacoes text not null default '',
  created_at timestamptz not null default now(),
  created_by text
);
create index if not exists execucoes_atividade_equip_atv_idx
  on public.execucoes_atividade (equipamento_id, atividade_id, data_execucao desc);
alter table public.execucoes_atividade enable row level security;
drop policy if exists "Authenticated full access" on public.execucoes_atividade;
create policy "Authenticated full access" on public.execucoes_atividade
  for all to authenticated using (true) with check (true);

-- View: próximas preventivas
create or replace view public.v_proximas_preventivas as
with ultima_exec as (
  select distinct on (equipamento_id, atividade_id)
    equipamento_id, atividade_id,
    data_execucao,
    medicao_execucao
  from public.execucoes_atividade
  order by equipamento_id, atividade_id, data_execucao desc
)
select
  ep.equipamento_id,
  e.codigo_patrimonio,
  e.nome as equipamento_nome,
  e.tipo as equipamento_tipo,
  e.tipo_medicao,
  pa.id as atividade_id,
  pa.nome as atividade_nome,
  pa.categoria,
  pa.periodicidade_horimetro,
  pa.periodicidade_km,
  pa.periodicidade_dias,
  pa.tolerancia_percentual,
  pa.obrigatoria,
  ue.data_execucao as ultima_execucao_data,
  ue.medicao_execucao as ultima_execucao_medicao,
  med.medicao_atual,
  case
    when pa.periodicidade_horimetro is not null
      then coalesce(ue.medicao_execucao, e.medicao_inicial) + pa.periodicidade_horimetro
    when pa.periodicidade_km is not null
      then coalesce(ue.medicao_execucao, e.medicao_inicial) + pa.periodicidade_km
    else null
  end as proxima_medicao,
  case
    when pa.periodicidade_horimetro is not null
      then (coalesce(ue.medicao_execucao, e.medicao_inicial) + pa.periodicidade_horimetro) - coalesce(med.medicao_atual, 0)
    when pa.periodicidade_km is not null
      then (coalesce(ue.medicao_execucao, e.medicao_inicial) + pa.periodicidade_km) - coalesce(med.medicao_atual, 0)
    else null
  end as unidades_restantes,
  case
    when pa.periodicidade_dias is not null
      then coalesce(ue.data_execucao, ep.data_inicio::timestamptz) + (pa.periodicidade_dias || ' days')::interval
    else null
  end as proxima_data,
  case
    when pa.periodicidade_dias is not null
      then extract(day from (coalesce(ue.data_execucao, ep.data_inicio::timestamptz) + (pa.periodicidade_dias || ' days')::interval) - now())::int
    else null
  end as dias_restantes
from public.equipamento_plano ep
join public.equipamentos e on e.id = ep.equipamento_id
join public.plano_atividades pa on pa.plano_id = ep.plano_id
left join ultima_exec ue on ue.equipamento_id = ep.equipamento_id and ue.atividade_id = pa.id
left join public.v_equipamento_medicao_atual med on med.equipamento_id = ep.equipamento_id
where ep.ativo = true;

comment on view public.v_proximas_preventivas is
  'Para cada (equipamento, atividade preventiva aplicada), calcula proxima '
  'execucao prevista por horimetro/km e por data. Use no dashboard, na '
  'agenda e no detalhe do equipamento.';

commit;
