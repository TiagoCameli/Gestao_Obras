-- ═══════════════════════════════════════════════════════════════════════════
-- Módulo Apontamento de Funcionários — schema isolado.
-- Implementa a seção 12 da spec (spec-modulo-apontamento-funcionarios v1.0).
-- Prefixo `apont_` evita colisão com tabelas legadas (apontamentos, obras,
-- colaboradores, etc). RLS no modo "team tool": qualquer autenticado lê/escreve.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Centros de custo ──────────────────────────────────────────────────────
create table if not exists public.apont_centros_custo (
  id          uuid        primary key default gen_random_uuid(),
  codigo      text        not null unique,
  nome        text        not null,
  ativo       boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── Obras ─────────────────────────────────────────────────────────────────
create table if not exists public.apont_obras (
  id          uuid        primary key default gen_random_uuid(),
  codigo      text        not null unique,
  nome        text        not null,
  status      text        not null default 'ativa',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── Equipes ───────────────────────────────────────────────────────────────
create table if not exists public.apont_equipes (
  id              uuid        primary key default gen_random_uuid(),
  nome            text        not null,
  obra_id         uuid        not null references public.apont_obras(id) on delete restrict,
  encarregado_id  uuid,
  ativo           boolean     not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists apont_equipes_obra_idx on public.apont_equipes(obra_id);

-- ─── Funcionários ──────────────────────────────────────────────────────────
create table if not exists public.apont_funcionarios (
  id                       uuid        primary key default gen_random_uuid(),
  nome                     text        not null,
  cpf                      text        not null unique,
  rg                       text,
  pis                      text,
  ctps                     text,
  data_nascimento          date        not null,
  foto_perfil              text,                                    -- path no storage
  fotos_referencia_facial  text[]      not null default '{}',       -- 1..5 paths
  funcao                   text        not null,                    -- enum textual
  tipo_vinculo             text        not null,                    -- CLT|diarista|terceirizado|MEI
  salario_base             numeric(12,2),                           -- obrigatório se CLT
  valor_diaria             numeric(12,2),                           -- obrigatório se diarista
  valor_hora               numeric(12,4),                           -- calculado pelo app
  centro_custo_id          uuid        not null references public.apont_centros_custo(id) on delete restrict,
  obra_id                  uuid        not null references public.apont_obras(id) on delete restrict,
  equipe_id                uuid        not null references public.apont_equipes(id) on delete restrict,
  encarregado_id           uuid        references public.apont_funcionarios(id) on delete set null,
  data_admissao            date        not null,
  data_demissao            date,
  status                   text        not null default 'ativo',    -- ativo|inativo|afastado|demitido
  contato_emergencia       text,
  permite_horas_extras     boolean     not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint apont_func_vinculo_check check (
    tipo_vinculo in ('CLT','diarista','terceirizado','MEI')
  ),
  constraint apont_func_status_check check (
    status in ('ativo','inativo','afastado','demitido')
  ),
  constraint apont_func_remuneracao_check check (
    salario_base is not null and salario_base > 0
  )
);
create index if not exists apont_func_obra_idx        on public.apont_funcionarios(obra_id);
create index if not exists apont_func_equipe_idx      on public.apont_funcionarios(equipe_id);
create index if not exists apont_func_status_idx      on public.apont_funcionarios(status);
create index if not exists apont_func_encarregado_idx on public.apont_funcionarios(encarregado_id);

-- FK do encarregado da equipe (depois de funcionarios existir)
alter table public.apont_equipes
  drop constraint if exists apont_equipes_encarregado_fk;
alter table public.apont_equipes
  add constraint apont_equipes_encarregado_fk
  foreign key (encarregado_id) references public.apont_funcionarios(id) on delete set null;

-- ─── Serviços (catálogo) ──────────────────────────────────────────────────
create table if not exists public.apont_servicos (
  id          uuid        primary key default gen_random_uuid(),
  nome        text        not null unique,
  descricao   text,
  ativo       boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Catálogo padrão (idempotente)
insert into public.apont_servicos (nome) values
  ('CBUQ'),
  ('Paliativo'),
  ('Correção de defeito'),
  ('Troca de solo'),
  ('Remendo profundo'),
  ('Drenagem'),
  ('Terraplenagem'),
  ('Pintura de ligação'),
  ('Imprimação'),
  ('Sinalização'),
  ('Outros')
on conflict (nome) do nothing;

-- ─── Registros de ponto (Aba 1) ───────────────────────────────────────────
create table if not exists public.apont_registros_ponto (
  id                   uuid        primary key default gen_random_uuid(),
  funcionario_id       uuid        not null references public.apont_funcionarios(id) on delete cascade,
  data                 date        not null,
  tipo_batida          text        not null,                        -- entrada|saida_almoco|retorno_almoco|saida_final
  hora                 timestamptz not null,
  latitude             double precision,
  longitude            double precision,
  foto                 text,                                        -- path no storage
  origem               text        not null default 'automatico',   -- automatico|manual
  registrado_por_id    uuid        references auth.users(id) on delete set null,
  aprovado_por_id      uuid        references auth.users(id) on delete set null,
  status_aprovacao     text        not null default 'aprovado',     -- aprovado|pendente_aprovacao|rejeitado
  motivo_manual        text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint apont_rp_tipo_check check (
    tipo_batida in ('entrada','saida_almoco','retorno_almoco','saida_final')
  ),
  constraint apont_rp_origem_check check (origem in ('automatico','manual')),
  constraint apont_rp_status_check check (
    status_aprovacao in ('aprovado','pendente_aprovacao','rejeitado')
  )
);
create index if not exists apont_rp_func_data_idx on public.apont_registros_ponto(funcionario_id, data);
create index if not exists apont_rp_data_idx      on public.apont_registros_ponto(data);

-- ─── Aprovação de ponto do dia (engenheiro) ───────────────────────────────
create table if not exists public.apont_aprovacoes_ponto_dia (
  id              uuid        primary key default gen_random_uuid(),
  equipe_id       uuid        not null references public.apont_equipes(id) on delete cascade,
  data            date        not null,
  engenheiro_id   uuid        references auth.users(id) on delete set null,
  aprovado_em     timestamptz not null default now(),
  observacao      text,
  unique (equipe_id, data)
);

-- ─── Apontamentos por serviço (Aba 2) ─────────────────────────────────────
create table if not exists public.apont_apontamentos_servico (
  id                 uuid        primary key default gen_random_uuid(),
  funcionario_id     uuid        not null references public.apont_funcionarios(id) on delete cascade,
  data               date        not null,
  servico_id         uuid        not null references public.apont_servicos(id) on delete restrict,
  estaca_inicial     text        not null,
  estaca_final       text        not null,
  lado               text        not null,                            -- direito|esquerdo|ambos
  horas              numeric(6,2) not null,
  tipo               text        not null,                            -- produtivo|improdutivo
  motivo_improdutivo text,
  observacao         text,
  registrado_por_id  uuid        references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint apont_as_lado_check check (lado in ('direito','esquerdo','ambos')),
  constraint apont_as_tipo_check check (tipo in ('produtivo','improdutivo')),
  constraint apont_as_horas_check check (horas > 0)
);
create index if not exists apont_as_func_data_idx on public.apont_apontamentos_servico(funcionario_id, data);
create index if not exists apont_as_servico_idx   on public.apont_apontamentos_servico(servico_id);

-- ─── Ausências (faltas, atestados, férias, licenças) ──────────────────────
create table if not exists public.apont_ausencias (
  id                uuid        primary key default gen_random_uuid(),
  funcionario_id    uuid        not null references public.apont_funcionarios(id) on delete cascade,
  data_inicio       date        not null,
  data_fim          date        not null,
  tipo              text        not null,                            -- falta_justificada|falta_injustificada|atestado|ferias|licenca|folga|abono
  atestado_arquivo  text,
  cid               text,
  dias_afastados    integer,
  observacao        text,
  created_at        timestamptz not null default now(),
  constraint apont_aus_periodo_check check (data_fim >= data_inicio)
);
create index if not exists apont_aus_func_idx on public.apont_ausencias(funcionario_id, data_inicio);

-- ─── Adiantamentos quinzenais ─────────────────────────────────────────────
create table if not exists public.apont_adiantamentos (
  id                uuid        primary key default gen_random_uuid(),
  funcionario_id    uuid        not null references public.apont_funcionarios(id) on delete cascade,
  data              date        not null,
  valor             numeric(12,2) not null check (valor > 0),
  forma_pagamento   text,
  fechamento_id     uuid,
  created_at        timestamptz not null default now()
);
create index if not exists apont_adt_func_idx on public.apont_adiantamentos(funcionario_id, data);

-- ─── Fechamento mensal de folha ───────────────────────────────────────────
create table if not exists public.apont_fechamentos_folha (
  id                  uuid        primary key default gen_random_uuid(),
  funcionario_id      uuid        not null references public.apont_funcionarios(id) on delete cascade,
  mes                 integer     not null check (mes between 1 and 12),
  ano                 integer     not null check (ano between 2000 and 2100),
  horas_normais       numeric(8,2) not null default 0,
  horas_extras_50     numeric(8,2) not null default 0,
  horas_extras_100    numeric(8,2) not null default 0,
  adicional_noturno   numeric(8,2) not null default 0,
  dsr                 numeric(12,2) not null default 0,
  faltas              numeric(12,2) not null default 0,
  adiantamento        numeric(12,2) not null default 0,
  total_proventos     numeric(12,2) not null default 0,
  total_descontos     numeric(12,2) not null default 0,
  liquido             numeric(12,2) not null default 0,
  fechado_por_id      uuid        references auth.users(id) on delete set null,
  fechado_em          timestamptz,
  unique (funcionario_id, mes, ano)
);

alter table public.apont_adiantamentos
  drop constraint if exists apont_adt_fechamento_fk;
alter table public.apont_adiantamentos
  add constraint apont_adt_fechamento_fk
  foreign key (fechamento_id) references public.apont_fechamentos_folha(id) on delete set null;

-- ─── Auditoria ────────────────────────────────────────────────────────────
create table if not exists public.apont_auditoria (
  id              uuid        primary key default gen_random_uuid(),
  usuario_id      uuid        references auth.users(id) on delete set null,
  acao            text        not null,
  entidade        text        not null,
  entidade_id     text        not null,
  valor_anterior  jsonb,
  valor_novo      jsonb,
  ip              text,
  dispositivo     text,
  created_at      timestamptz not null default now()
);
create index if not exists apont_aud_entidade_idx on public.apont_auditoria(entidade, entidade_id);
create index if not exists apont_aud_usuario_idx  on public.apont_auditoria(usuario_id, created_at desc);

-- ─── Permissões granulares por usuário (seção 11.2) ──────────────────────
create table if not exists public.apont_permissoes_usuario (
  usuario_id  uuid not null references auth.users(id) on delete cascade,
  permissao   text not null,
  ativo       boolean not null default true,
  primary key (usuario_id, permissao)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS — modo team tool: qualquer autenticado lê/escreve.
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.apont_centros_custo          enable row level security;
alter table public.apont_obras                  enable row level security;
alter table public.apont_equipes                enable row level security;
alter table public.apont_funcionarios           enable row level security;
alter table public.apont_servicos               enable row level security;
alter table public.apont_registros_ponto        enable row level security;
alter table public.apont_aprovacoes_ponto_dia   enable row level security;
alter table public.apont_apontamentos_servico   enable row level security;
alter table public.apont_ausencias              enable row level security;
alter table public.apont_adiantamentos          enable row level security;
alter table public.apont_fechamentos_folha      enable row level security;
alter table public.apont_auditoria              enable row level security;
alter table public.apont_permissoes_usuario     enable row level security;

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'apont_centros_custo','apont_obras','apont_equipes','apont_funcionarios',
    'apont_servicos','apont_registros_ponto','apont_aprovacoes_ponto_dia',
    'apont_apontamentos_servico','apont_ausencias','apont_adiantamentos',
    'apont_fechamentos_folha','apont_auditoria','apont_permissoes_usuario'
  ])
  loop
    execute format('drop policy if exists "%s_authed" on public.%I', t, t);
    execute format(
      'create policy "%s_authed" on public.%I for all to authenticated using (true) with check (true)',
      t, t
    );
  end loop;
end$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Storage bucket: fotos de funcionário (perfil + referência facial).
-- ═══════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('apontamento-fotos', 'apontamento-fotos', false)
on conflict (id) do nothing;

drop policy if exists "apont_fotos_authed_all" on storage.objects;
create policy "apont_fotos_authed_all"
  on storage.objects for all to authenticated
  using (bucket_id = 'apontamento-fotos')
  with check (bucket_id = 'apontamento-fotos');

-- ═══════════════════════════════════════════════════════════════════════════
-- Trigger genérico de updated_at
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.apont_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'apont_centros_custo','apont_obras','apont_equipes','apont_funcionarios',
    'apont_servicos','apont_registros_ponto','apont_apontamentos_servico'
  ])
  loop
    execute format('drop trigger if exists %I_set_upd on public.%I', t, t);
    execute format(
      'create trigger %I_set_upd before update on public.%I
       for each row execute function public.apont_set_updated_at()',
      t, t
    );
  end loop;
end$$;
