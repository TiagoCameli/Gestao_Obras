-- Marco 2 / PR9 — Ordens de Serviço (cerne do módulo de Manutenção).
--
-- Estrutura:
--   ordens_servico        — uma linha por OS
--   os_pecas              — peças usadas na OS (baixa do almoxarifado futura)
--   os_mao_obra           — apontamento de horas dos mecânicos próprios
--   os_transicoes         — log auditado de mudanças de status (auto)
--   os_contador           — gera numeração OS-YYYY-NNNN reiniciando por ano
--
-- Status flow:
--   rascunho → aberta → aguardando_pecas ↔ em_execucao
--                                       → aguardando_aprovacao → concluida
--   qualquer status → cancelada
--
-- Triggers:
--   - AFTER INSERT/UPDATE em ordens_servico grava transição em os_transicoes
--     com ID único (clock_timestamp em microssegundos)
--
-- Limpeza prévia: a base teve um módulo de OS antigo wipado. Se ainda
-- existir função gerar_numero_os com assinatura antiga, dropar antes.

drop function if exists public.gerar_numero_os() cascade;

begin;

create table if not exists public.os_contador (
  ano int primary key,
  ultimo_numero int not null default 0
);
alter table public.os_contador enable row level security;
drop policy if exists "Authenticated full access" on public.os_contador;
create policy "Authenticated full access" on public.os_contador
  for all to authenticated using (true) with check (true);

create or replace function public.gerar_numero_os() returns text
language plpgsql
volatile
as $$
declare
  ano_atual int := extract(year from now())::int;
  proximo int;
begin
  insert into public.os_contador (ano, ultimo_numero) values (ano_atual, 1)
    on conflict (ano) do update set ultimo_numero = public.os_contador.ultimo_numero + 1
    returning ultimo_numero into proximo;
  return 'OS-' || ano_atual || '-' || lpad(proximo::text, 4, '0');
end;
$$;

comment on function public.gerar_numero_os() is
  'Gera numero da OS no formato OS-YYYY-NNNN reiniciando contador a cada ano.';

create table if not exists public.ordens_servico (
  id text primary key,
  numero text unique not null,
  equipamento_id text not null references public.equipamentos(id) on delete restrict,
  tipo text not null check (tipo in ('preventiva','corretiva','preditiva','melhoria','garantia','recall')),
  prioridade text not null default 'media' check (prioridade in ('baixa','media','alta','critica')),
  status text not null default 'aberta' check (status in (
    'rascunho','aberta','aguardando_pecas','em_execucao','aguardando_aprovacao','concluida','cancelada'
  )),
  origem text check (origem is null or origem in (
    'plano_preventivo','checklist','anomalia_combustivel','manual','recall'
  )),
  origem_id text,
  atividade_id text,
  obra_id text references public.obras(id) on delete set null,
  solicitante_id text,
  responsavel_id text,
  fornecedor_servico_id text references public.fornecedores(id) on delete set null,
  data_abertura timestamptz not null default now(),
  data_prevista_inicio timestamptz,
  data_inicio_execucao timestamptz,
  data_conclusao timestamptz,
  prazo_atendimento timestamptz,
  medicao_abertura numeric,
  medicao_conclusao numeric,
  parada_inicio timestamptz,
  parada_fim timestamptz,
  defeito_reportado text not null default '',
  sintomas text[] not null default '{}',
  sistemas_afetados text[] not null default '{}',
  causa_raiz text not null default '',
  solucao_aplicada text not null default '',
  recomendacoes text not null default '',
  custo_pecas numeric(14,2) not null default 0,
  custo_servico_terceiro numeric(14,2) not null default 0,
  custo_mao_obra_propria numeric(14,2) not null default 0,
  custo_total numeric(14,2) generated always as
    (coalesce(custo_pecas,0) + coalesce(custo_servico_terceiro,0) + coalesce(custo_mao_obra_propria,0)) stored,
  aprovado_por text,
  aprovado_em timestamptz,
  garantia_acionada boolean not null default false,
  foto_urls text[] not null default '{}',
  arquivo_urls text[] not null default '{}',
  observacoes text not null default '',
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now(),
  updated_by text,
  deleted_at timestamptz,
  deleted_by text
);

create index if not exists ordens_servico_equip_status_idx on public.ordens_servico (equipamento_id, status) where deleted_at is null;
create index if not exists ordens_servico_data_abertura_idx on public.ordens_servico (data_abertura desc) where deleted_at is null;
create index if not exists ordens_servico_status_idx on public.ordens_servico (status) where deleted_at is null;

alter table public.ordens_servico enable row level security;
drop policy if exists "Authenticated full access" on public.ordens_servico;
create policy "Authenticated full access" on public.ordens_servico
  for all to authenticated using (true) with check (true);

comment on table public.ordens_servico is
  'Ordens de Servico do equipamento. Status flow: rascunho -> aberta -> '
  'aguardando_pecas/em_execucao -> aguardando_aprovacao -> concluida. '
  'Custo total calculado automaticamente. Numero gerado por gerar_numero_os().';

create table if not exists public.os_pecas (
  id text primary key,
  os_id text not null references public.ordens_servico(id) on delete cascade,
  insumo_id text not null references public.insumos(id) on delete restrict,
  deposito_id text references public.depositos(id) on delete set null,
  quantidade numeric not null check (quantidade > 0),
  unidade_medida_id text references public.unidades_medida(id) on delete set null,
  custo_unitario numeric(14,2) not null,
  custo_total numeric(14,2) generated always as (quantidade * custo_unitario) stored,
  status text not null default 'reservada' check (status in ('reservada','consumida','devolvida')),
  saida_material_id text references public.saidas_material(id) on delete set null,
  observacoes text not null default '',
  created_at timestamptz not null default now(),
  created_by text
);
create index if not exists os_pecas_os_idx on public.os_pecas (os_id);
alter table public.os_pecas enable row level security;
drop policy if exists "Authenticated full access" on public.os_pecas;
create policy "Authenticated full access" on public.os_pecas for all to authenticated using (true) with check (true);

create table if not exists public.os_mao_obra (
  id text primary key,
  os_id text not null references public.ordens_servico(id) on delete cascade,
  colaborador_id text not null references public.colaboradores(id) on delete restrict,
  data date not null,
  horas numeric not null check (horas > 0),
  custo_hora numeric(10,2),
  custo_total numeric(14,2) generated always as (horas * coalesce(custo_hora,0)) stored,
  observacoes text not null default '',
  created_at timestamptz not null default now(),
  created_by text
);
create index if not exists os_mao_obra_os_idx on public.os_mao_obra (os_id);
create index if not exists os_mao_obra_colab_idx on public.os_mao_obra (colaborador_id, data desc);
alter table public.os_mao_obra enable row level security;
drop policy if exists "Authenticated full access" on public.os_mao_obra;
create policy "Authenticated full access" on public.os_mao_obra for all to authenticated using (true) with check (true);

create table if not exists public.os_transicoes (
  id text primary key,
  os_id text not null references public.ordens_servico(id) on delete cascade,
  status_de text,
  status_para text not null,
  motivo text not null default '',
  created_at timestamptz not null default now(),
  created_by text
);
create index if not exists os_transicoes_os_idx on public.os_transicoes (os_id, created_at desc);
alter table public.os_transicoes enable row level security;
drop policy if exists "Authenticated full access" on public.os_transicoes;
create policy "Authenticated full access" on public.os_transicoes for all to authenticated using (true) with check (true);

create or replace function public.tg_os_grava_transicao() returns trigger
language plpgsql as $$
declare trans_id text;
begin
  if tg_op = 'INSERT' then
    trans_id := 'trans-' || NEW.id || '-init';
    insert into public.os_transicoes (id, os_id, status_de, status_para, motivo, created_by)
      values (trans_id, NEW.id, null, NEW.status, 'Criação', NEW.created_by)
      on conflict (id) do nothing;
  elsif OLD.status is distinct from NEW.status then
    -- clock_timestamp() avanca dentro da mesma transacao (statement_timestamp nao)
    trans_id := 'trans-' || NEW.id || '-' ||
      replace(extract(epoch from clock_timestamp())::numeric(20,6)::text, '.', '');
    insert into public.os_transicoes (id, os_id, status_de, status_para, motivo, created_by)
      values (trans_id, NEW.id, OLD.status, NEW.status, '', NEW.updated_by)
      on conflict (id) do nothing;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_os_grava_transicao_ins on public.ordens_servico;
create trigger trg_os_grava_transicao_ins after insert on public.ordens_servico
  for each row execute function public.tg_os_grava_transicao();

drop trigger if exists trg_os_grava_transicao_upd on public.ordens_servico;
create trigger trg_os_grava_transicao_upd after update on public.ordens_servico
  for each row when (OLD.status is distinct from NEW.status)
  execute function public.tg_os_grava_transicao();

commit;
