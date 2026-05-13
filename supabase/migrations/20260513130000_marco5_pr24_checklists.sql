-- Marco 5 / PR24: estrutura de checklists pré-uso.
--
-- 4 tabelas:
--   checklists_template: modelo por tipo de equipamento (com versão)
--   checklist_perguntas: itens do checklist (sim/não/obs/foto)
--   checklist_execucoes: 1 execução do checklist (operador, equipamento, data)
--   checklist_respostas: resposta por pergunta (resp + obs + foto)

create table if not exists public.checklists_template (
  id text primary key,
  nome text not null,
  tipo_equipamento text not null,
  versao integer not null default 1,
  ativo boolean not null default true,
  observacoes text not null default '',
  created_at timestamptz not null default now(),
  created_by text not null default '',
  updated_at timestamptz not null default now(),
  updated_by text not null default '',
  deleted_at timestamptz,
  deleted_by text
);
comment on table public.checklists_template is
  'Modelos de checklist pré-uso por tipo de equipamento.';

create index if not exists idx_checklists_template_tipo
  on public.checklists_template(tipo_equipamento)
  where deleted_at is null and ativo = true;

create table if not exists public.checklist_perguntas (
  id text primary key,
  template_id text not null references public.checklists_template(id) on delete cascade,
  ordem integer not null default 0,
  categoria text not null default 'geral',
  pergunta text not null,
  descricao text not null default '',
  obrigatoria boolean not null default true,
  critica boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.checklist_perguntas is
  'Perguntas/itens de cada template de checklist. Resposta esperada é Sim.';

create index if not exists idx_checklist_perguntas_template
  on public.checklist_perguntas(template_id, ordem);

create table if not exists public.checklist_execucoes (
  id text primary key,
  template_id text not null references public.checklists_template(id),
  template_versao integer not null,
  equipamento_id text not null references public.equipamentos(id),
  operador_funcionario_id text references public.funcionarios(id),
  operador_nome text not null default '',
  medicao_atual numeric(12,2),
  status text not null default 'concluido'
    check (status in ('concluido', 'concluido_com_pendencias', 'bloqueado')),
  observacoes_gerais text not null default '',
  os_gerada_id text references public.ordens_servico(id),
  iniciado_em timestamptz not null default now(),
  concluido_em timestamptz not null default now(),
  sincronizado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by text not null default ''
);
comment on table public.checklist_execucoes is
  'Cada vez que um operador executa um checklist em um equipamento.';

create index if not exists idx_checklist_execucoes_equip
  on public.checklist_execucoes(equipamento_id, concluido_em desc);

create index if not exists idx_checklist_execucoes_operador
  on public.checklist_execucoes(operador_funcionario_id, concluido_em desc)
  where operador_funcionario_id is not null;

create index if not exists idx_checklist_execucoes_status
  on public.checklist_execucoes(status, concluido_em desc);

create table if not exists public.checklist_respostas (
  id text primary key,
  execucao_id text not null references public.checklist_execucoes(id) on delete cascade,
  pergunta_id text not null references public.checklist_perguntas(id),
  pergunta_snapshot text not null default '',
  resposta text not null check (resposta in ('sim', 'nao', 'nao_aplica')),
  observacao text not null default '',
  foto_url text,
  created_at timestamptz not null default now()
);
comment on table public.checklist_respostas is
  'Resposta de cada pergunta na execução. Resposta esperada do operador é "sim".';

create index if not exists idx_checklist_respostas_execucao
  on public.checklist_respostas(execucao_id);

create index if not exists idx_checklist_respostas_nao
  on public.checklist_respostas(execucao_id)
  where resposta = 'nao';

alter table public.checklists_template enable row level security;
alter table public.checklist_perguntas enable row level security;
alter table public.checklist_execucoes enable row level security;
alter table public.checklist_respostas enable row level security;

do $$ begin
  create policy "Authenticated full access on checklists_template" on public.checklists_template for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Authenticated full access on checklist_perguntas" on public.checklist_perguntas for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Authenticated full access on checklist_execucoes" on public.checklist_execucoes for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Authenticated full access on checklist_respostas" on public.checklist_respostas for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

create or replace view public.v_checklists_nao_conformidades as
with ultima_execucao as (
  select distinct on (equipamento_id)
    id, equipamento_id, operador_nome, concluido_em, status, os_gerada_id, observacoes_gerais
  from checklist_execucoes
  order by equipamento_id, concluido_em desc
)
select
  ue.id as execucao_id,
  ue.equipamento_id,
  eq.codigo_patrimonio,
  eq.nome as equipamento_nome,
  eq.tipo as equipamento_tipo,
  ue.operador_nome,
  ue.concluido_em,
  ue.status,
  ue.os_gerada_id,
  count(*) filter (where r.resposta = 'nao') as itens_nao,
  count(*) filter (where r.resposta = 'nao' and p.critica = true) as itens_criticos
from ultima_execucao ue
join equipamentos eq on eq.id = ue.equipamento_id
left join checklist_respostas r on r.execucao_id = ue.id
left join checklist_perguntas p on p.id = r.pergunta_id
where ue.status != 'concluido'
   or exists (select 1 from checklist_respostas r2 where r2.execucao_id = ue.id and r2.resposta = 'nao')
group by ue.id, ue.equipamento_id, eq.codigo_patrimonio, eq.nome, eq.tipo,
         ue.operador_nome, ue.concluido_em, ue.status, ue.os_gerada_id;
