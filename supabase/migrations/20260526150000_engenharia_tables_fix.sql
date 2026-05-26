-- Engenharia — Onda 1.1: tabelas, índices, checks.
-- Módulo: workspace de obras (pastas hierárquicas + notas + cálculos + arquivos + locks).
-- Spec: docs/superpowers/plans/2026-05-26-engenharia-modulo.md (seção 4).
-- Rollback: 20260526150100_engenharia_tables_rollback.sql.
--
-- Não habilita RLS aqui — fica na migration 20260526160000.

begin;

-- ============================================================
-- 1) engenharia_pastas — árvore hierárquica
-- obra_id ON DELETE SET NULL (decisão D-3 2026-05-26): pasta vira avulsa
-- quando obra é deletada, via trigger engenharia_before_delete_obra.
-- ============================================================
create table public.engenharia_pastas (
  id              uuid primary key default gen_random_uuid(),
  parent_id       uuid null references public.engenharia_pastas(id) on delete cascade,
  obra_id         text null references public.obras(id) on delete set null,
  nome            text not null,
  tipo            text not null check (tipo in ('obra','avulsa','subpasta')),
  caminho         text not null,
  criado_por      uuid references auth.users(id),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  deleted_at      timestamptz null
);

create index engenharia_pastas_parent_idx     on public.engenharia_pastas (parent_id);
create index engenharia_pastas_obra_idx       on public.engenharia_pastas (obra_id);
create index engenharia_pastas_caminho_idx    on public.engenharia_pastas (caminho);
create index engenharia_pastas_deleted_at_idx on public.engenharia_pastas (deleted_at);

-- Não pode ter 2 filhos com mesmo nome sob o mesmo parent (case-insensitive).
-- Aplica apenas em parent_id IS NOT NULL — pastas raiz podem repetir nome
-- porque trigger de delete prefixa com "[Arquivada YYYY-MM-DD]".
create unique index engenharia_pastas_unique_nome_por_parent
  on public.engenharia_pastas (parent_id, lower(nome))
  where deleted_at is null and parent_id is not null;

-- Cada obra tem exatamente 1 pasta raiz ativa do tipo 'obra'.
create unique index engenharia_pastas_uma_raiz_por_obra
  on public.engenharia_pastas (obra_id)
  where tipo = 'obra' and obra_id is not null and deleted_at is null;

-- ============================================================
-- 2) engenharia_notas — documentos Tiptap
-- ============================================================
create table public.engenharia_notas (
  id              uuid primary key default gen_random_uuid(),
  pasta_id        uuid not null references public.engenharia_pastas(id) on delete cascade,
  titulo          text not null,
  conteudo_json   jsonb not null default '{}'::jsonb,
  versao          int not null default 1,
  criado_por      uuid references auth.users(id),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  deleted_at      timestamptz null
);
create index engenharia_notas_pasta_idx      on public.engenharia_notas (pasta_id);
create index engenharia_notas_deleted_at_idx on public.engenharia_notas (deleted_at);

-- ============================================================
-- 3) engenharia_notas_versoes — histórico
-- ============================================================
create table public.engenharia_notas_versoes (
  id              uuid primary key default gen_random_uuid(),
  nota_id         uuid not null references public.engenharia_notas(id) on delete cascade,
  versao          int not null,
  conteudo_json   jsonb not null,
  autor_id        uuid references auth.users(id),
  criado_em       timestamptz not null default now()
);
create unique index engenharia_notas_versoes_unique
  on public.engenharia_notas_versoes (nota_id, versao);
create index engenharia_notas_versoes_nota_idx
  on public.engenharia_notas_versoes (nota_id);

-- ============================================================
-- 4) engenharia_calculos — quadros de cálculo
-- ============================================================
create table public.engenharia_calculos (
  id              uuid primary key default gen_random_uuid(),
  pasta_id        uuid not null references public.engenharia_pastas(id) on delete cascade,
  titulo          text not null,
  documento_json  jsonb not null default '{}'::jsonb,
  alerta_ativo    boolean not null default true,
  versao          int not null default 1,
  criado_por      uuid references auth.users(id),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  deleted_at      timestamptz null
);
create index engenharia_calculos_pasta_idx      on public.engenharia_calculos (pasta_id);
create index engenharia_calculos_deleted_at_idx on public.engenharia_calculos (deleted_at);

-- ============================================================
-- 5) engenharia_calculos_versoes — histórico
-- ============================================================
create table public.engenharia_calculos_versoes (
  id              uuid primary key default gen_random_uuid(),
  calculo_id      uuid not null references public.engenharia_calculos(id) on delete cascade,
  versao          int not null,
  documento_json  jsonb not null,
  autor_id        uuid references auth.users(id),
  criado_em       timestamptz not null default now()
);
create unique index engenharia_calculos_versoes_unique
  on public.engenharia_calculos_versoes (calculo_id, versao);
create index engenharia_calculos_versoes_calc_idx
  on public.engenharia_calculos_versoes (calculo_id);

-- ============================================================
-- 6) engenharia_arquivos — metadados de uploads
-- ============================================================
create table public.engenharia_arquivos (
  id              uuid primary key default gen_random_uuid(),
  pasta_id        uuid not null references public.engenharia_pastas(id) on delete cascade,
  nome_original   text not null,
  extensao        text not null,
  mime_type       text not null,
  tamanho_bytes   bigint not null check (tamanho_bytes > 0 and tamanho_bytes <= 52428800),  -- 50 MB
  storage_path    text not null unique,
  checksum_sha256 text,
  criado_por      uuid references auth.users(id),
  criado_em       timestamptz not null default now(),
  deleted_at      timestamptz null
);
create index engenharia_arquivos_pasta_idx      on public.engenharia_arquivos (pasta_id);
create index engenharia_arquivos_deleted_at_idx on public.engenharia_arquivos (deleted_at);

-- ============================================================
-- 7) engenharia_locks — locks pessimistas de edição (D-4 revisada)
-- ============================================================
create table public.engenharia_locks (
  id              uuid primary key default gen_random_uuid(),
  recurso_tipo    text not null check (recurso_tipo in ('nota','calculo')),
  recurso_id      uuid not null,
  usuario_id      uuid not null references auth.users(id),
  expira_em       timestamptz not null,
  criado_em       timestamptz not null default now()
);
create unique index engenharia_locks_unique_recurso
  on public.engenharia_locks (recurso_tipo, recurso_id);
create index engenharia_locks_expira_idx
  on public.engenharia_locks (expira_em);

-- Comentários explicativos
comment on table public.engenharia_pastas    is 'Engenharia: pastas hierárquicas. Pasta raiz tipo=obra criada por trigger ao inserir em obras.';
comment on table public.engenharia_notas     is 'Engenharia: blocos de nota (editor Tiptap, conteudo_json é o documento ProseMirror).';
comment on table public.engenharia_calculos  is 'Engenharia: blocos de cálculo (parser math.js, documento_json com linhas/grids/textos).';
comment on table public.engenharia_arquivos  is 'Engenharia: metadados de upload. Bytes ficam no bucket engenharia-arquivos.';
comment on table public.engenharia_locks     is 'Engenharia: locks pessimistas — 1 editor por vez (decisão D-4 2026-05-26). Não usa CRDT.';

commit;
