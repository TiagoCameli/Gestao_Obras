# Engenharia Onda 1 — Schema + RLS + Triggers + Locks (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar as 7 tabelas do módulo Engenharia + 3 triggers SECDEF em `obras` (insert/update_nome/before_delete) + 2 funções de lock pessimista + chaves de permissão moderna, deixando tudo pronto pra Onda 2 (Storage) e Onda 3 (UI de pastas).

**Architecture:** Migrations Postgres pareadas (4 fix + 4 rollback) aplicadas direto no Supabase prod (workflow audit-fix do user). Cada par é uma unidade atômica — se o fix falhar parcial, rollback restaura. Frontend ganha 17 chaves novas em `ACOES_PLATAFORMA` + dependências + templates de cargo. `supabase/schema.sql` (hand-maintained) recebe o reflexo das mudanças. Verificação inclui Supabase advisors (security/performance), security-review skill, e teste manual de fluxo obras→pasta.

**Tech Stack:** Postgres 15 (Supabase), `private.current_has_action()` SECDEF já existente, TypeScript 5.9 (frontend), Vitest 4 (testes unit do `acoesPadraoDoCargo`), MCP Supabase tools (`apply_migration`, `execute_sql`, `get_advisors`).

**Spec:** [`docs/superpowers/plans/2026-05-26-engenharia-modulo.md`](2026-05-26-engenharia-modulo.md) seção 4 (schema) e seção 7 (Onda 1).

**Discovery:** [`docs/superpowers/discovery/engenharia-discovery.md`](../discovery/engenharia-discovery.md).

---

## File Structure

**Create:**
- `supabase/migrations/20260526150000_engenharia_tables_fix.sql` — 7 tabelas, índices, checks.
- `supabase/migrations/20260526150100_engenharia_tables_rollback.sql` — DROP em ordem reversa.
- `supabase/migrations/20260526160000_engenharia_rls_fix.sql` — `ENABLE RLS` + policies per-command nas 7 tabelas.
- `supabase/migrations/20260526160100_engenharia_rls_rollback.sql` — `DISABLE RLS` + DROP POLICIES.
- `supabase/migrations/20260526170000_engenharia_triggers_obras_fix.sql` — 3 funções SECDEF + 3 triggers em `obras`.
- `supabase/migrations/20260526170100_engenharia_triggers_obras_rollback.sql` — DROP TRIGGER + DROP FUNCTION.
- `supabase/migrations/20260526180000_engenharia_locks_functions_fix.sql` — 2 funções SECDEF (`acquire_lock`, `release_lock`).
- `supabase/migrations/20260526180100_engenharia_locks_functions_rollback.sql` — DROP FUNCTION.

**Modify:**
- `src/utils/permissions.ts` — adiciona 17 novas entradas em `ACOES_PLATAFORMA`, 17 deps em `DEPENDENCIAS_ACOES`, atualiza `TEMPLATES_ACOES_POR_CARGO` em 6 cargos.
- `supabase/schema.sql` — adiciona seções Engenharia (7 tabelas + 5 funções + 3 triggers) no final.

**Create (testes):**
- `src/utils/permissions.test.ts` (se não existir, criar) — Vitest com asserts em `acoesPadraoDoCargo('Engenheiro Civil Sênior')` e correlatos.

> **Timestamps das migrations:** valores acima assumem que execução acontece em 2026-05-26 após 15:00. Se a execução for em outro dia, ajustar os timestamps para refletir momento real, mantendo o pattern `_fix` / `_rollback` (offset +100 segundos pro rollback). Última migration aplicada no projeto era `20260526120100`, então qualquer coisa >= `20260526120200` serve.

---

## Task 1: Migration `engenharia_tables_fix.sql` + rollback

**Files:**
- Create: `supabase/migrations/20260526150000_engenharia_tables_fix.sql`
- Create: `supabase/migrations/20260526150100_engenharia_tables_rollback.sql`

- [ ] **Step 1: Escrever o `_fix.sql` completo**

Conteúdo de `supabase/migrations/20260526150000_engenharia_tables_fix.sql`:

```sql
-- Engenharia — Onda 1.1: tabelas, índices, checks.
-- Módulo: workspace de obras (pastas hierárquicas + notas + cálculos + arquivos + locks).
-- Spec: docs/superpowers/plans/2026-05-26-engenharia-modulo.md (seção 4).
-- Rollback: 20260526150100_engenharia_tables_rollback.sql.
--
-- Não habilita RLS aqui — fica na migration 20260526160000.

begin;

-- ============================================================
-- 1) engenharia_pastas — árvore hierárquica
-- obra_id ON DELETE SET NULL (decisão D-3 2026-05-26: pasta vira avulsa
-- quando obra é deletada, via trigger engenharia_before_delete_obra).
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
```

- [ ] **Step 2: Escrever o `_rollback.sql`**

Conteúdo de `supabase/migrations/20260526150100_engenharia_tables_rollback.sql`:

```sql
-- Rollback de 20260526150000_engenharia_tables_fix.sql
-- Ordem reversa para respeitar FKs.

begin;

drop table if exists public.engenharia_locks            cascade;
drop table if exists public.engenharia_arquivos         cascade;
drop table if exists public.engenharia_calculos_versoes cascade;
drop table if exists public.engenharia_calculos         cascade;
drop table if exists public.engenharia_notas_versoes    cascade;
drop table if exists public.engenharia_notas            cascade;
drop table if exists public.engenharia_pastas           cascade;

commit;
```

- [ ] **Step 3: User confirma o conteúdo antes de aplicar**

Mostrar os 2 arquivos ao user. Pedir confirmação explícita: "Aplico `engenharia_tables_fix` no Supabase agora?"

- [ ] **Step 4: Aplicar a migration via MCP**

Usar ferramenta `mcp__plugin_supabase_supabase__apply_migration`:
- name: `engenharia_tables_fix`
- query: o conteúdo de `engenharia_tables_fix.sql` (sem o `begin;`/`commit;` — apply_migration já abre transação)

> ⚠ Atenção: a tool `apply_migration` envolve em transação automática. **Remover `begin;` e `commit;`** ao passar pra ela. O arquivo `.sql` em disco mantém as transações pra referência futura / re-aplicação manual.

- [ ] **Step 5: Verificar com `list_tables`**

Usar `mcp__plugin_supabase_supabase__list_tables` filtrando `schemas: ['public']`. Confirmar presença de:
- `engenharia_pastas`
- `engenharia_notas`
- `engenharia_notas_versoes`
- `engenharia_calculos`
- `engenharia_calculos_versoes`
- `engenharia_arquivos`
- `engenharia_locks`

Esperado: 7 tabelas novas listadas, sem nenhuma RLS habilitada (vamos habilitar na Task 2).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260526150000_engenharia_tables_fix.sql supabase/migrations/20260526150100_engenharia_tables_rollback.sql
git commit -m "feat(engenharia): adiciona 7 tabelas (pastas, notas, calculos, arquivos, locks) + indices

Onda 1.1 do modulo Engenharia. Tabelas sem RLS — RLS vem na proxima migration.
obra_id em engenharia_pastas usa ON DELETE SET NULL (decisao D-3): pasta vira
avulsa quando obra eh deletada, via trigger (Task 3 desta onda).

Spec: docs/superpowers/plans/2026-05-26-engenharia-modulo.md"
```

---

## Task 2: Migration `engenharia_rls_fix.sql` + rollback

**Files:**
- Create: `supabase/migrations/20260526160000_engenharia_rls_fix.sql`
- Create: `supabase/migrations/20260526160100_engenharia_rls_rollback.sql`

- [ ] **Step 1: Escrever o `_fix.sql` completo**

Conteúdo de `supabase/migrations/20260526160000_engenharia_rls_fix.sql`:

```sql
-- Engenharia — Onda 1.2: RLS per-command em todas as 7 tabelas.
-- Padrão: private.current_has_action('chave_de_acao') (já existe).
-- Spec: docs/superpowers/plans/2026-05-26-engenharia-modulo.md (seção 4.RLS).
-- Rollback: 20260526160100_engenharia_rls_rollback.sql.

begin;

-- ============================================================
-- 1) engenharia_pastas
-- ============================================================
alter table public.engenharia_pastas enable row level security;

create policy engenharia_pastas_select on public.engenharia_pastas
  for select to authenticated
  using (private.current_has_action('ver_engenharia') and deleted_at is null);

create policy engenharia_pastas_select_lixeira on public.engenharia_pastas
  for select to authenticated
  using (private.current_has_action('ver_lixeira_engenharia') and deleted_at is not null);

create policy engenharia_pastas_insert on public.engenharia_pastas
  for insert to authenticated
  with check (private.current_has_action('criar_engenharia_pasta'));

create policy engenharia_pastas_update on public.engenharia_pastas
  for update to authenticated
  using (
    private.current_has_action('editar_engenharia_pasta')
    or private.current_has_action('excluir_engenharia_pasta')
    or private.current_has_action('restaurar_lixeira_engenharia')
  )
  with check (
    private.current_has_action('editar_engenharia_pasta')
    or private.current_has_action('excluir_engenharia_pasta')
    or private.current_has_action('restaurar_lixeira_engenharia')
  );

create policy engenharia_pastas_delete on public.engenharia_pastas
  for delete to authenticated
  using (private.current_has_action('excluir_permanente_engenharia'));

-- ============================================================
-- 2) engenharia_notas
-- ============================================================
alter table public.engenharia_notas enable row level security;

create policy engenharia_notas_select on public.engenharia_notas
  for select to authenticated
  using (private.current_has_action('ver_engenharia') and deleted_at is null);

create policy engenharia_notas_select_lixeira on public.engenharia_notas
  for select to authenticated
  using (private.current_has_action('ver_lixeira_engenharia') and deleted_at is not null);

create policy engenharia_notas_insert on public.engenharia_notas
  for insert to authenticated
  with check (private.current_has_action('criar_engenharia_nota'));

create policy engenharia_notas_update on public.engenharia_notas
  for update to authenticated
  using (
    private.current_has_action('editar_engenharia_nota')
    or private.current_has_action('excluir_engenharia_nota')
    or private.current_has_action('restaurar_lixeira_engenharia')
  )
  with check (
    private.current_has_action('editar_engenharia_nota')
    or private.current_has_action('excluir_engenharia_nota')
    or private.current_has_action('restaurar_lixeira_engenharia')
  );

create policy engenharia_notas_delete on public.engenharia_notas
  for delete to authenticated
  using (private.current_has_action('excluir_permanente_engenharia'));

-- ============================================================
-- 3) engenharia_notas_versoes (só leitura + insert pelo dono do conteúdo)
-- ============================================================
alter table public.engenharia_notas_versoes enable row level security;

create policy engenharia_notas_versoes_select on public.engenharia_notas_versoes
  for select to authenticated
  using (private.current_has_action('ver_historico_engenharia'));

create policy engenharia_notas_versoes_insert on public.engenharia_notas_versoes
  for insert to authenticated
  with check (private.current_has_action('editar_engenharia_nota'));

-- delete somente para limpeza por job admin (não policy normal)
create policy engenharia_notas_versoes_delete on public.engenharia_notas_versoes
  for delete to authenticated
  using (private.current_has_action('excluir_permanente_engenharia'));

-- ============================================================
-- 4) engenharia_calculos
-- ============================================================
alter table public.engenharia_calculos enable row level security;

create policy engenharia_calculos_select on public.engenharia_calculos
  for select to authenticated
  using (private.current_has_action('ver_engenharia') and deleted_at is null);

create policy engenharia_calculos_select_lixeira on public.engenharia_calculos
  for select to authenticated
  using (private.current_has_action('ver_lixeira_engenharia') and deleted_at is not null);

create policy engenharia_calculos_insert on public.engenharia_calculos
  for insert to authenticated
  with check (private.current_has_action('criar_engenharia_calculo'));

create policy engenharia_calculos_update on public.engenharia_calculos
  for update to authenticated
  using (
    private.current_has_action('editar_engenharia_calculo')
    or private.current_has_action('excluir_engenharia_calculo')
    or private.current_has_action('restaurar_lixeira_engenharia')
  )
  with check (
    private.current_has_action('editar_engenharia_calculo')
    or private.current_has_action('excluir_engenharia_calculo')
    or private.current_has_action('restaurar_lixeira_engenharia')
  );

create policy engenharia_calculos_delete on public.engenharia_calculos
  for delete to authenticated
  using (private.current_has_action('excluir_permanente_engenharia'));

-- ============================================================
-- 5) engenharia_calculos_versoes
-- ============================================================
alter table public.engenharia_calculos_versoes enable row level security;

create policy engenharia_calculos_versoes_select on public.engenharia_calculos_versoes
  for select to authenticated
  using (private.current_has_action('ver_historico_engenharia'));

create policy engenharia_calculos_versoes_insert on public.engenharia_calculos_versoes
  for insert to authenticated
  with check (private.current_has_action('editar_engenharia_calculo'));

create policy engenharia_calculos_versoes_delete on public.engenharia_calculos_versoes
  for delete to authenticated
  using (private.current_has_action('excluir_permanente_engenharia'));

-- ============================================================
-- 6) engenharia_arquivos
-- ============================================================
alter table public.engenharia_arquivos enable row level security;

create policy engenharia_arquivos_select on public.engenharia_arquivos
  for select to authenticated
  using (private.current_has_action('ver_engenharia') and deleted_at is null);

create policy engenharia_arquivos_select_lixeira on public.engenharia_arquivos
  for select to authenticated
  using (private.current_has_action('ver_lixeira_engenharia') and deleted_at is not null);

create policy engenharia_arquivos_insert on public.engenharia_arquivos
  for insert to authenticated
  with check (private.current_has_action('upload_engenharia_arquivo'));

create policy engenharia_arquivos_update on public.engenharia_arquivos
  for update to authenticated
  using (
    private.current_has_action('excluir_engenharia_arquivo')
    or private.current_has_action('restaurar_lixeira_engenharia')
  )
  with check (
    private.current_has_action('excluir_engenharia_arquivo')
    or private.current_has_action('restaurar_lixeira_engenharia')
  );

create policy engenharia_arquivos_delete on public.engenharia_arquivos
  for delete to authenticated
  using (private.current_has_action('excluir_permanente_engenharia'));

-- ============================================================
-- 7) engenharia_locks — todos com ver_engenharia podem ler; só o dono ou admin escreve
-- ============================================================
alter table public.engenharia_locks enable row level security;

create policy engenharia_locks_select on public.engenharia_locks
  for select to authenticated
  using (private.current_has_action('ver_engenharia'));

-- INSERT/UPDATE só pela função SECDEF engenharia_acquire_lock (Task 4).
-- Por isso negamos INSERT/UPDATE direto via REST. Mantemos delete só pra admin.
create policy engenharia_locks_insert on public.engenharia_locks
  for insert to authenticated
  with check (false);

create policy engenharia_locks_update on public.engenharia_locks
  for update to authenticated
  using (false)
  with check (false);

create policy engenharia_locks_delete on public.engenharia_locks
  for delete to authenticated
  using (
    -- Dono libera o próprio lock OU admin força liberação
    usuario_id = auth.uid()
    or private.current_has_action('gerenciar_locks_engenharia')
  );

commit;
```

- [ ] **Step 2: Escrever o `_rollback.sql`**

Conteúdo de `supabase/migrations/20260526160100_engenharia_rls_rollback.sql`:

```sql
-- Rollback de 20260526160000_engenharia_rls_fix.sql

begin;

alter table public.engenharia_pastas            disable row level security;
alter table public.engenharia_notas             disable row level security;
alter table public.engenharia_notas_versoes     disable row level security;
alter table public.engenharia_calculos          disable row level security;
alter table public.engenharia_calculos_versoes  disable row level security;
alter table public.engenharia_arquivos          disable row level security;
alter table public.engenharia_locks             disable row level security;

drop policy if exists engenharia_pastas_select          on public.engenharia_pastas;
drop policy if exists engenharia_pastas_select_lixeira  on public.engenharia_pastas;
drop policy if exists engenharia_pastas_insert          on public.engenharia_pastas;
drop policy if exists engenharia_pastas_update          on public.engenharia_pastas;
drop policy if exists engenharia_pastas_delete          on public.engenharia_pastas;

drop policy if exists engenharia_notas_select          on public.engenharia_notas;
drop policy if exists engenharia_notas_select_lixeira  on public.engenharia_notas;
drop policy if exists engenharia_notas_insert          on public.engenharia_notas;
drop policy if exists engenharia_notas_update          on public.engenharia_notas;
drop policy if exists engenharia_notas_delete          on public.engenharia_notas;

drop policy if exists engenharia_notas_versoes_select on public.engenharia_notas_versoes;
drop policy if exists engenharia_notas_versoes_insert on public.engenharia_notas_versoes;
drop policy if exists engenharia_notas_versoes_delete on public.engenharia_notas_versoes;

drop policy if exists engenharia_calculos_select          on public.engenharia_calculos;
drop policy if exists engenharia_calculos_select_lixeira  on public.engenharia_calculos;
drop policy if exists engenharia_calculos_insert          on public.engenharia_calculos;
drop policy if exists engenharia_calculos_update          on public.engenharia_calculos;
drop policy if exists engenharia_calculos_delete          on public.engenharia_calculos;

drop policy if exists engenharia_calculos_versoes_select on public.engenharia_calculos_versoes;
drop policy if exists engenharia_calculos_versoes_insert on public.engenharia_calculos_versoes;
drop policy if exists engenharia_calculos_versoes_delete on public.engenharia_calculos_versoes;

drop policy if exists engenharia_arquivos_select          on public.engenharia_arquivos;
drop policy if exists engenharia_arquivos_select_lixeira  on public.engenharia_arquivos;
drop policy if exists engenharia_arquivos_insert          on public.engenharia_arquivos;
drop policy if exists engenharia_arquivos_update          on public.engenharia_arquivos;
drop policy if exists engenharia_arquivos_delete          on public.engenharia_arquivos;

drop policy if exists engenharia_locks_select on public.engenharia_locks;
drop policy if exists engenharia_locks_insert on public.engenharia_locks;
drop policy if exists engenharia_locks_update on public.engenharia_locks;
drop policy if exists engenharia_locks_delete on public.engenharia_locks;

commit;
```

- [ ] **Step 3: User confirma**

Mostrar ambos os arquivos. Pedir aprovação.

- [ ] **Step 4: Apply via MCP** (`apply_migration` sem `begin/commit`)

- [ ] **Step 5: Rodar `get_advisors` tipo `security`**

`mcp__plugin_supabase_supabase__get_advisors` com `type: 'security'`. **Esperado:** nenhum WARN/ERROR novo nas tabelas `engenharia_*`. Se aparecer "policy missing for X command", revisar.

- [ ] **Step 6: Smoke test via `execute_sql` (usuário authenticated qualquer)**

```sql
-- Anonymous (sem auth.uid()): deve falhar
select count(*) from public.engenharia_pastas;
```

Esperado: ou 0 linhas (RLS bloqueou) ou erro de permissão — depende do contexto execute_sql.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260526160000_engenharia_rls_fix.sql supabase/migrations/20260526160100_engenharia_rls_rollback.sql
git commit -m "feat(engenharia): RLS per-command nas 7 tabelas via private.current_has_action

Policies separadas por SELECT/INSERT/UPDATE/DELETE para todas as tabelas
engenharia_*. Locks bloqueiam INSERT/UPDATE direto (so via funcoes acquire_lock
e release_lock criadas na proxima migration).

Spec: docs/superpowers/plans/2026-05-26-engenharia-modulo.md"
```

---

## Task 3: Migration `engenharia_triggers_obras_fix.sql` + rollback

**Files:**
- Create: `supabase/migrations/20260526170000_engenharia_triggers_obras_fix.sql`
- Create: `supabase/migrations/20260526170100_engenharia_triggers_obras_rollback.sql`

- [ ] **Step 1: Escrever o `_fix.sql`**

Conteúdo de `supabase/migrations/20260526170000_engenharia_triggers_obras_fix.sql`:

```sql
-- Engenharia — Onda 1.3: triggers SECDEF em obras
-- (A) AFTER INSERT  → cria pasta raiz automaticamente
-- (B) AFTER UPDATE of nome → sincroniza nome da pasta
-- (C) BEFORE DELETE → converte pasta raiz em avulsa (decisão D-3)
--
-- Spec: docs/superpowers/plans/2026-05-26-engenharia-modulo.md (seção 4.Triggers).
-- Rollback: 20260526170100_engenharia_triggers_obras_rollback.sql.
--
-- Todas as funções são SECURITY DEFINER + search_path = public, pg_temp fixado
-- (decisão D-2 aprovada 2026-05-26).

begin;

-- (A) ============================================================
create or replace function public.engenharia_after_insert_obra()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.engenharia_pastas (obra_id, nome, tipo, caminho, criado_por)
  values (new.id, new.nome, 'obra', '/' || new.id, null)
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists trg_engenharia_after_insert_obra on public.obras;
create trigger trg_engenharia_after_insert_obra
  after insert on public.obras
  for each row execute function public.engenharia_after_insert_obra();

-- (B) ============================================================
create or replace function public.engenharia_after_update_obra_nome()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.nome is distinct from old.nome then
    update public.engenharia_pastas
       set nome = new.nome,
           atualizado_em = now()
     where obra_id = new.id
       and tipo = 'obra'
       and deleted_at is null;
  end if;
  return new;
end $$;

drop trigger if exists trg_engenharia_after_update_obra_nome on public.obras;
create trigger trg_engenharia_after_update_obra_nome
  after update of nome on public.obras
  for each row execute function public.engenharia_after_update_obra_nome();

-- (C) ============================================================
-- BEFORE DELETE (não AFTER): no AFTER, ON DELETE SET NULL do FK já teria
-- zerado obra_id. Em BEFORE temos OLD.nome ainda disponível.
create or replace function public.engenharia_before_delete_obra()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_data_hoje text := to_char(now(), 'YYYY-MM-DD');
begin
  -- Converte a pasta raiz da obra em "avulsa órfã", prefixando nome
  -- com "[Arquivada YYYY-MM-DD]" para o user identificar visualmente.
  update public.engenharia_pastas
     set tipo = 'avulsa',
         nome = '[Arquivada ' || v_data_hoje || '] ' || nome,
         obra_id = null,
         atualizado_em = now()
   where obra_id = old.id
     and tipo = 'obra'
     and deleted_at is null;

  -- Para subpastas (que não eram tipo='obra'), só zera obra_id (FK ON DELETE
  -- SET NULL faria isso, mas explicitar deixa o efeito claro e evita race).
  update public.engenharia_pastas
     set obra_id = null
   where obra_id = old.id
     and tipo <> 'obra';

  return old;
end $$;

drop trigger if exists trg_engenharia_before_delete_obra on public.obras;
create trigger trg_engenharia_before_delete_obra
  before delete on public.obras
  for each row execute function public.engenharia_before_delete_obra();

-- Comentários
comment on function public.engenharia_after_insert_obra()      is 'Engenharia: cria pasta raiz tipo=obra ao inserir em obras. SECDEF.';
comment on function public.engenharia_after_update_obra_nome() is 'Engenharia: sincroniza nome da pasta raiz quando obras.nome muda. SECDEF.';
comment on function public.engenharia_before_delete_obra()     is 'Engenharia: ao deletar obra, converte pasta raiz em avulsa (D-3 2026-05-26). SECDEF.';

commit;
```

- [ ] **Step 2: Escrever o `_rollback.sql`**

Conteúdo de `supabase/migrations/20260526170100_engenharia_triggers_obras_rollback.sql`:

```sql
-- Rollback de 20260526170000_engenharia_triggers_obras_fix.sql

begin;

drop trigger if exists trg_engenharia_after_insert_obra      on public.obras;
drop trigger if exists trg_engenharia_after_update_obra_nome on public.obras;
drop trigger if exists trg_engenharia_before_delete_obra     on public.obras;

drop function if exists public.engenharia_after_insert_obra();
drop function if exists public.engenharia_after_update_obra_nome();
drop function if exists public.engenharia_before_delete_obra();

commit;
```

- [ ] **Step 3: User confirma**

- [ ] **Step 4: Apply via MCP** (`apply_migration` sem `begin/commit`)

- [ ] **Step 5: Teste idempotência — funções devem retornar mesma coisa em duas chamadas seguidas**

Via `execute_sql`:

```sql
-- Cenário 1: inserir obra → ver pasta raiz nascendo
do $$
declare v_id text := 'test-obra-' || gen_random_uuid()::text;
begin
  insert into public.obras (id, nome, criado_por) values (v_id, 'Obra de Teste Engenharia', '');
  -- Verifica que existe 1 pasta raiz com mesmo nome
  perform 1 from public.engenharia_pastas
   where obra_id = v_id and tipo = 'obra' and nome = 'Obra de Teste Engenharia';
  if not found then raise exception 'FAIL: trigger AFTER INSERT nao criou pasta'; end if;

  -- Cenário 2: renomear → ver pasta sincronizando
  update public.obras set nome = 'Obra Renomeada' where id = v_id;
  perform 1 from public.engenharia_pastas
   where obra_id = v_id and tipo = 'obra' and nome = 'Obra Renomeada';
  if not found then raise exception 'FAIL: trigger AFTER UPDATE nao sincronizou nome'; end if;

  -- Cenário 3: deletar obra → ver pasta virando avulsa
  delete from public.obras where id = v_id;
  perform 1 from public.engenharia_pastas
   where obra_id is null
     and tipo = 'avulsa'
     and nome like '[Arquivada %] Obra Renomeada';
  if not found then raise exception 'FAIL: trigger BEFORE DELETE nao converteu para avulsa'; end if;

  -- Cleanup: apaga a pasta avulsa órfã do teste
  delete from public.engenharia_pastas
   where nome like '[Arquivada %] Obra Renomeada';

  raise notice 'OK: todos os 3 triggers funcionaram conforme esperado.';
end $$;
```

Esperado: `OK: todos os 3 triggers funcionaram conforme esperado.`

- [ ] **Step 6: Teste idempotência do AFTER INSERT (dupla inserção não cria 2 pastas)**

Via `execute_sql`:

```sql
do $$
declare v_id text := 'test-idemp-' || gen_random_uuid()::text;
declare v_count int;
begin
  insert into public.obras (id, nome, criado_por) values (v_id, 'Idempotencia Teste', '');
  -- Tentativa de re-inserir manualmente uma pasta raiz pra mesma obra
  -- (simula o cenário de re-rodar trigger)
  insert into public.engenharia_pastas (obra_id, nome, tipo, caminho)
  values (v_id, 'Idempotencia Teste', 'obra', '/' || v_id)
  on conflict do nothing;

  select count(*) into v_count from public.engenharia_pastas
   where obra_id = v_id and tipo = 'obra' and deleted_at is null;

  if v_count <> 1 then
    raise exception 'FAIL: expected 1 pasta raiz, got %', v_count;
  end if;

  -- Cleanup
  delete from public.obras where id = v_id;
  delete from public.engenharia_pastas where nome like '[Arquivada %] Idempotencia Teste';

  raise notice 'OK: unique index garante 1 pasta raiz por obra.';
end $$;
```

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260526170000_engenharia_triggers_obras_fix.sql supabase/migrations/20260526170100_engenharia_triggers_obras_rollback.sql
git commit -m "feat(engenharia): triggers SECDEF em obras (insert/update/before-delete)

3 triggers em obras:
- AFTER INSERT: cria pasta raiz tipo=obra automaticamente.
- AFTER UPDATE of nome: sincroniza nome da pasta raiz.
- BEFORE DELETE: converte pasta raiz em 'avulsa' com prefixo [Arquivada DATA]
  (D-3 2026-05-26 — conteudo de engenharia nao some quando obra eh apagada).

Todas SECDEF + search_path = public, pg_temp (D-2 2026-05-26)."
```

---

## Task 4: Migration `engenharia_locks_functions_fix.sql` + rollback

**Files:**
- Create: `supabase/migrations/20260526180000_engenharia_locks_functions_fix.sql`
- Create: `supabase/migrations/20260526180100_engenharia_locks_functions_rollback.sql`

- [ ] **Step 1: Escrever o `_fix.sql`**

Conteúdo de `supabase/migrations/20260526180000_engenharia_locks_functions_fix.sql`:

```sql
-- Engenharia — Onda 1.4: funções SECDEF para lock pessimista
-- (D-4 revisada 2026-05-26 — sem CRDT, sem Yjs).
--
-- Spec: docs/superpowers/plans/2026-05-26-engenharia-modulo.md (seção 4 — engenharia_locks).
-- Rollback: 20260526180100_engenharia_locks_functions_rollback.sql.

begin;

-- acquire_lock: tenta adquirir ou renovar lock. Retorna estado atual.
create or replace function public.engenharia_acquire_lock(
  p_recurso_tipo text,
  p_recurso_id uuid,
  p_ttl_segundos int default 300
)
returns table (
  adquirido boolean,
  dono_usuario_id uuid,
  expira_em timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  -- Gate: usuário precisa de permissão para editar o tipo de recurso
  if p_recurso_tipo = 'nota' and not private.current_has_action('editar_engenharia_nota') then
    raise exception 'sem permissao para acquire lock em nota';
  end if;
  if p_recurso_tipo = 'calculo' and not private.current_has_action('editar_engenharia_calculo') then
    raise exception 'sem permissao para acquire lock em calculo';
  end if;

  -- Garbage-collect locks expirados desse recurso (não bloqueia ninguém)
  delete from public.engenharia_locks
   where recurso_tipo = p_recurso_tipo
     and recurso_id   = p_recurso_id
     and engenharia_locks.expira_em <= now();

  -- Tenta inserir; se já existe lock ATIVO (constraint unique),
  -- só renova SE for do próprio usuário.
  insert into public.engenharia_locks (recurso_tipo, recurso_id, usuario_id, expira_em)
  values (p_recurso_tipo, p_recurso_id, v_user, now() + make_interval(secs => p_ttl_segundos))
  on conflict (recurso_tipo, recurso_id) do update
    set expira_em = excluded.expira_em
   where engenharia_locks.usuario_id = v_user;

  -- Retorna estado pós-tentativa
  return query
    select (l.usuario_id = v_user) as adquirido,
           l.usuario_id,
           l.expira_em
      from public.engenharia_locks l
     where l.recurso_tipo = p_recurso_tipo
       and l.recurso_id = p_recurso_id;
end $$;

-- release_lock: libera APENAS o lock próprio (ou admin via DELETE direto)
create or replace function public.engenharia_release_lock(
  p_recurso_tipo text,
  p_recurso_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.engenharia_locks
   where recurso_tipo = p_recurso_tipo
     and recurso_id   = p_recurso_id
     and usuario_id   = auth.uid();
end $$;

-- Permissões: ambas precisam ser EXECUTE pelo role authenticated
grant execute on function public.engenharia_acquire_lock(text, uuid, int) to authenticated;
grant execute on function public.engenharia_release_lock(text, uuid)      to authenticated;

comment on function public.engenharia_acquire_lock(text, uuid, int)
  is 'Engenharia: adquire ou renova lock pessimista (TTL default 300s). Retorna (adquirido, dono, expira_em). SECDEF.';
comment on function public.engenharia_release_lock(text, uuid)
  is 'Engenharia: libera o lock do auth.uid() atual. No-op se outro usuário detém. SECDEF.';

commit;
```

- [ ] **Step 2: Escrever o `_rollback.sql`**

Conteúdo de `supabase/migrations/20260526180100_engenharia_locks_functions_rollback.sql`:

```sql
-- Rollback de 20260526180000_engenharia_locks_functions_fix.sql

begin;

drop function if exists public.engenharia_acquire_lock(text, uuid, int);
drop function if exists public.engenharia_release_lock(text, uuid);

commit;
```

- [ ] **Step 3: User confirma**

- [ ] **Step 4: Apply via MCP** (`apply_migration` sem `begin/commit`)

- [ ] **Step 5: Teste — adquirir, renovar, falhar pra outro usuário, liberar**

Esse teste precisa simular 2 usuários. Como o execute_sql do MCP roda com role superuser/postgres (auth.uid() = null), o teste real fica para a Onda 4 (via Playwright com 2 contextos). Aqui só validamos a FUNÇÃO SQL sintática.

Via `execute_sql`:

```sql
-- Não consegue testar com auth.uid() = NULL — só confere que função existe e tipos batem
select proname, pronargs, prorettype::regtype
  from pg_proc
 where proname in ('engenharia_acquire_lock', 'engenharia_release_lock')
   and pronamespace = 'public'::regnamespace
 order by proname;
```

Esperado: 2 linhas.

- [ ] **Step 6: Smoke test funcional via SQL — chamando com auth.uid() forçado**

Via `execute_sql`:

```sql
do $$
declare
  v_fake_user uuid := gen_random_uuid();
  v_fake_recurso uuid := gen_random_uuid();
  v_result record;
begin
  -- Insere lock diretamente (simulando que função inseriu)
  insert into public.engenharia_locks (recurso_tipo, recurso_id, usuario_id, expira_em)
  values ('nota', v_fake_recurso, v_fake_user, now() + interval '5 minutes');

  -- Verifica que unique constraint impede 2º lock pra mesmo recurso
  begin
    insert into public.engenharia_locks (recurso_tipo, recurso_id, usuario_id, expira_em)
    values ('nota', v_fake_recurso, gen_random_uuid(), now() + interval '5 minutes');
    raise exception 'FAIL: unique constraint nao impediu 2º lock';
  exception when unique_violation then
    raise notice 'OK: unique constraint impediu lock duplicado.';
  end;

  -- Cleanup
  delete from public.engenharia_locks where recurso_id = v_fake_recurso;
end $$;
```

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260526180000_engenharia_locks_functions_fix.sql supabase/migrations/20260526180100_engenharia_locks_functions_rollback.sql
git commit -m "feat(engenharia): funcoes engenharia_acquire_lock e engenharia_release_lock

Funcoes SECDEF para lock pessimista (D-4 2026-05-26): 1 editor por vez
em notas e calculos. TTL default 300s, gate por permissao editar_engenharia_*.

Teste com 2 contextos paralelos fica para a Onda 4 (Playwright)."
```

---

## Task 5: Frontend — Adicionar 17 chaves em `ACOES_PLATAFORMA` + dependências

**Files:**
- Modify: `src/utils/permissions.ts` (linha ~570 — final do array `ACOES_PLATAFORMA`; linha ~845 — final do mapa `DEPENDENCIAS_ACOES`)

- [ ] **Step 1: Localizar onde inserir no array `ACOES_PLATAFORMA`**

Buscar a marca de fim do bloco antes de "Sistema" / "Abas":

```bash
grep -n "// Medição (RodoTracker)" src/utils/permissions.ts
grep -n "// Usuários e permissões" src/utils/permissions.ts
```

Inserir o bloco Engenharia entre o último bloco de módulo (`Medição`) e o bloco de `Usuários`. Antes da linha que abre `// Usuários e permissões`.

- [ ] **Step 2: Adicionar 17 entradas no `ACOES_PLATAFORMA`**

Bloco a inserir:

```ts
  // ============================================================
  // Engenharia (workspace de obras: pastas, notas, cálculos, arquivos)
  // ============================================================
  { chave: 'ver_engenharia', label: 'Acessar módulo Engenharia', grupo: 'Engenharia' },
  { chave: 'criar_engenharia_pasta', label: 'Criar pasta no Engenharia', grupo: 'Engenharia' },
  { chave: 'editar_engenharia_pasta', label: 'Renomear/mover pasta', grupo: 'Engenharia' },
  { chave: 'excluir_engenharia_pasta', label: 'Mover pasta para lixeira', grupo: 'Engenharia' },
  { chave: 'criar_engenharia_nota', label: 'Criar bloco de nota', grupo: 'Engenharia' },
  { chave: 'editar_engenharia_nota', label: 'Editar/salvar bloco de nota', grupo: 'Engenharia' },
  { chave: 'excluir_engenharia_nota', label: 'Mover nota para lixeira', grupo: 'Engenharia' },
  { chave: 'criar_engenharia_calculo', label: 'Criar bloco de cálculo', grupo: 'Engenharia' },
  { chave: 'editar_engenharia_calculo', label: 'Editar/salvar bloco de cálculo', grupo: 'Engenharia' },
  { chave: 'excluir_engenharia_calculo', label: 'Mover cálculo para lixeira', grupo: 'Engenharia' },
  { chave: 'upload_engenharia_arquivo', label: 'Subir arquivo', grupo: 'Engenharia' },
  { chave: 'excluir_engenharia_arquivo', label: 'Excluir arquivo', grupo: 'Engenharia' },
  { chave: 'ver_lixeira_engenharia', label: 'Visualizar lixeira da Engenharia', grupo: 'Engenharia' },
  { chave: 'restaurar_lixeira_engenharia', label: 'Restaurar itens da lixeira', grupo: 'Engenharia' },
  { chave: 'excluir_permanente_engenharia', label: 'Excluir permanentemente itens da lixeira', grupo: 'Engenharia' },
  { chave: 'ver_historico_engenharia', label: 'Ver histórico de versões', grupo: 'Engenharia' },
  { chave: 'gerenciar_locks_engenharia', label: 'Forçar liberação de lock de edição', grupo: 'Engenharia' },
```

- [ ] **Step 3: Adicionar 16 entradas em `DEPENDENCIAS_ACOES`**

Localizar o fim do bloco "Medição" no objeto `DEPENDENCIAS_ACOES` (perto da linha 845). Inserir antes do fechamento `};`:

```ts
  // Engenharia
  criar_engenharia_pasta: ['ver_engenharia'],
  editar_engenharia_pasta: ['ver_engenharia'],
  excluir_engenharia_pasta: ['ver_engenharia', 'editar_engenharia_pasta'],
  criar_engenharia_nota: ['ver_engenharia'],
  editar_engenharia_nota: ['ver_engenharia'],
  excluir_engenharia_nota: ['ver_engenharia', 'editar_engenharia_nota'],
  criar_engenharia_calculo: ['ver_engenharia'],
  editar_engenharia_calculo: ['ver_engenharia'],
  excluir_engenharia_calculo: ['ver_engenharia', 'editar_engenharia_calculo'],
  upload_engenharia_arquivo: ['ver_engenharia'],
  excluir_engenharia_arquivo: ['ver_engenharia'],
  ver_lixeira_engenharia: ['ver_engenharia'],
  restaurar_lixeira_engenharia: ['ver_lixeira_engenharia'],
  excluir_permanente_engenharia: ['ver_lixeira_engenharia', 'restaurar_lixeira_engenharia'],
  ver_historico_engenharia: ['ver_engenharia'],
  gerenciar_locks_engenharia: ['ver_engenharia'],
```

- [ ] **Step 4: Garantir que "Engenharia" NÃO está em `GRUPOS_NAO_IMPLEMENTADOS`**

Procurar o set `GRUPOS_NAO_IMPLEMENTADOS`. Esperado: contém apenas `'Sistema'`. Se contiver `'Engenharia'`, removê-lo (não deveria estar — vamos manter o módulo visível no formulário de permissões já desde a Onda 1 para que admins possam configurar). Se alguém já tiver adicionado, remover.

- [ ] **Step 5: Rodar typecheck**

```bash
cd /Users/tiagocameli/projects/Gestao_Obras
npx tsc -b
```

Esperado: sem erros (as 17 chaves novas são `string` literais — não precisam de mudança em tipos `AcaoPermissao` que é o sistema legacy).

- [ ] **Step 6: Commit**

```bash
git add src/utils/permissions.ts
git commit -m "feat(engenharia): adiciona 17 chaves de permissao para o modulo

Novas chaves em ACOES_PLATAFORMA + DEPENDENCIAS_ACOES, grupo 'Engenharia'.
Inclui gerenciar_locks_engenharia para admins forcarem liberacao de lock
pessimista (D-4 2026-05-26).

As chaves aparecem no formulario de permissoes mas ainda nao tem nenhuma
rota gateada — efeito real a partir da Onda 3 (UI de pastas)."
```

---

## Task 6: Frontend — Atualizar `TEMPLATES_ACOES_POR_CARGO` para 6 cargos

**Files:**
- Modify: `src/utils/permissions.ts` (procurar `TEMPLATES_ACOES_POR_CARGO`)

- [ ] **Step 1: Localizar o objeto `TEMPLATES_ACOES_POR_CARGO`**

```bash
grep -n "TEMPLATES_ACOES_POR_CARGO" src/utils/permissions.ts
```

Esperado: 1+ ocorrências. Abrir o arquivo na primeira para entender estrutura (deve ser `const TEMPLATES_ACOES_POR_CARGO: Record<CargoFuncionario, string[]> = { ... }`).

- [ ] **Step 2: Adicionar chaves de Engenharia nos cargos relevantes**

Matriz (do discovery seção 2.5):

| Cargo | Chaves a adicionar |
|---|---|
| `Administrador` | Todas as 17 (mas o auth.tsx já dá bypass via cargo='Administrador' no `current_has_action` — adicionar mesmo assim por consistência do template) |
| `Engenheiro Civil Sênior` | 16 chaves (tudo menos `excluir_permanente_engenharia` — somente admin força delete físico) |
| `Engenheiro Civil` | 11 chaves: `ver_engenharia`, `criar_engenharia_pasta`, `editar_engenharia_pasta`, `criar_engenharia_nota`, `editar_engenharia_nota`, `criar_engenharia_calculo`, `editar_engenharia_calculo`, `upload_engenharia_arquivo`, `ver_lixeira_engenharia`, `ver_historico_engenharia` — sem excluir/restaurar |
| `Gerente`, `Gerente Financeiro`, `Gerente de Compras`, `Supervisor`, `Financeiro` | 2 chaves: `ver_engenharia`, `ver_lixeira_engenharia` (read-only) |
| `Operador`, `Apontador` | nenhuma (sem acesso ao módulo) |

Para cada cargo afetado, **anexar** as chaves ao array existente (sem remover nenhuma das atuais). Exemplo:

```ts
const TEMPLATES_ACOES_POR_CARGO: Record<CargoFuncionario, string[]> = {
  Administrador: [
    // ... chaves existentes ...
    'ver_engenharia', 'criar_engenharia_pasta', 'editar_engenharia_pasta', 'excluir_engenharia_pasta',
    'criar_engenharia_nota', 'editar_engenharia_nota', 'excluir_engenharia_nota',
    'criar_engenharia_calculo', 'editar_engenharia_calculo', 'excluir_engenharia_calculo',
    'upload_engenharia_arquivo', 'excluir_engenharia_arquivo',
    'ver_lixeira_engenharia', 'restaurar_lixeira_engenharia', 'excluir_permanente_engenharia',
    'ver_historico_engenharia', 'gerenciar_locks_engenharia',
  ],
  'Engenheiro Civil Sênior': [
    // ... chaves existentes ...
    'ver_engenharia', 'criar_engenharia_pasta', 'editar_engenharia_pasta', 'excluir_engenharia_pasta',
    'criar_engenharia_nota', 'editar_engenharia_nota', 'excluir_engenharia_nota',
    'criar_engenharia_calculo', 'editar_engenharia_calculo', 'excluir_engenharia_calculo',
    'upload_engenharia_arquivo', 'excluir_engenharia_arquivo',
    'ver_lixeira_engenharia', 'restaurar_lixeira_engenharia',
    'ver_historico_engenharia', 'gerenciar_locks_engenharia',
  ],
  'Engenheiro Civil': [
    // ... chaves existentes ...
    'ver_engenharia', 'criar_engenharia_pasta', 'editar_engenharia_pasta',
    'criar_engenharia_nota', 'editar_engenharia_nota',
    'criar_engenharia_calculo', 'editar_engenharia_calculo',
    'upload_engenharia_arquivo',
    'ver_lixeira_engenharia', 'ver_historico_engenharia',
  ],
  Gerente: [
    // ... chaves existentes ...
    'ver_engenharia', 'ver_lixeira_engenharia',
  ],
  'Gerente Financeiro': [
    // ... chaves existentes ...
    'ver_engenharia', 'ver_lixeira_engenharia',
  ],
  'Gerente de Compras': [
    // ... chaves existentes ...
    'ver_engenharia', 'ver_lixeira_engenharia',
  ],
  Supervisor: [
    // ... chaves existentes ...
    'ver_engenharia', 'ver_lixeira_engenharia',
  ],
  Financeiro: [
    // ... chaves existentes ...
    'ver_engenharia', 'ver_lixeira_engenharia',
  ],
  // Operador, Apontador — sem mudança (zero chaves de Engenharia)
};
```

- [ ] **Step 3: Escrever teste Vitest pra validar templates**

Criar `src/utils/permissions.test.ts` (se já existir, anexar dentro do `describe` correspondente):

```ts
import { describe, it, expect } from 'vitest';
import { acoesPadraoDoCargo } from './permissions';

describe('acoesPadraoDoCargo — Engenharia', () => {
  it('Administrador recebe todas as 17 chaves de Engenharia', () => {
    const acoes = acoesPadraoDoCargo('Administrador');
    expect(acoes).toContain('ver_engenharia');
    expect(acoes).toContain('excluir_permanente_engenharia');
    expect(acoes).toContain('gerenciar_locks_engenharia');
  });

  it('Engenheiro Civil Sênior recebe 16 (tudo menos excluir_permanente)', () => {
    const acoes = acoesPadraoDoCargo('Engenheiro Civil Sênior');
    expect(acoes).toContain('ver_engenharia');
    expect(acoes).toContain('restaurar_lixeira_engenharia');
    expect(acoes).toContain('gerenciar_locks_engenharia');
    expect(acoes).not.toContain('excluir_permanente_engenharia');
  });

  it('Engenheiro Civil recebe somente criar/editar (sem excluir)', () => {
    const acoes = acoesPadraoDoCargo('Engenheiro Civil');
    expect(acoes).toContain('ver_engenharia');
    expect(acoes).toContain('criar_engenharia_nota');
    expect(acoes).toContain('editar_engenharia_calculo');
    expect(acoes).toContain('upload_engenharia_arquivo');
    expect(acoes).not.toContain('excluir_engenharia_pasta');
    expect(acoes).not.toContain('excluir_engenharia_arquivo');
    expect(acoes).not.toContain('gerenciar_locks_engenharia');
  });

  it('Gerente recebe read-only', () => {
    const acoes = acoesPadraoDoCargo('Gerente');
    expect(acoes).toContain('ver_engenharia');
    expect(acoes).toContain('ver_lixeira_engenharia');
    expect(acoes).not.toContain('criar_engenharia_pasta');
    expect(acoes).not.toContain('editar_engenharia_nota');
  });

  it('Operador não tem acesso ao módulo', () => {
    const acoes = acoesPadraoDoCargo('Operador');
    expect(acoes).not.toContain('ver_engenharia');
  });

  it('Apontador não tem acesso ao módulo', () => {
    const acoes = acoesPadraoDoCargo('Apontador');
    expect(acoes).not.toContain('ver_engenharia');
  });
});
```

- [ ] **Step 4: Rodar Vitest**

```bash
cd /Users/tiagocameli/projects/Gestao_Obras
npx vitest run src/utils/permissions.test.ts
```

Esperado: 6 testes verdes.

- [ ] **Step 5: Rodar typecheck final**

```bash
cd /Users/tiagocameli/projects/Gestao_Obras
npx tsc -b
```

Esperado: 0 erros.

- [ ] **Step 6: Commit**

```bash
git add src/utils/permissions.ts src/utils/permissions.test.ts
git commit -m "feat(engenharia): templates de cargo para 6 perfis + testes Vitest

Administrador: tudo (17 chaves).
Engenheiro Civil Senior: tudo exceto excluir_permanente (16).
Engenheiro Civil: criar+editar+upload, sem excluir (11).
Gerente/GFin/GCompras/Supervisor/Financeiro: ver_engenharia + ver_lixeira (2).
Operador/Apontador: nada.

Testes Vitest cobrem cada cargo."
```

---

## Task 7: Atualizar `supabase/schema.sql` com as novas tabelas/funções

**Files:**
- Modify: `supabase/schema.sql` (final do arquivo — linha ~631)

> **Por quê:** `schema.sql` é hand-maintained, serve como referência para devs e como bootstrap em projetos novos. Espelhamos as mudanças das migrations aqui pra manter sincronia.

- [ ] **Step 1: Ler o fim do arquivo `schema.sql`**

```bash
tail -50 /Users/tiagocameli/projects/Gestao_Obras/supabase/schema.sql
```

Decidir onde inserir o bloco Engenharia. Padrão: no FIM, com seção numerada nova.

- [ ] **Step 2: Anexar a seção Engenharia ao `schema.sql`**

Adicionar ao final de `supabase/schema.sql`:

```sql

-- ============================================================
-- ── N. Engenharia (módulo workspace de obras)
--    Espelha migrations 20260526150000–20260526180000 (Onda 1).
--    Spec: docs/superpowers/plans/2026-05-26-engenharia-modulo.md
-- ============================================================

-- Tabelas
CREATE TABLE IF NOT EXISTS engenharia_pastas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id       uuid NULL REFERENCES engenharia_pastas(id) ON DELETE CASCADE,
  obra_id         text NULL REFERENCES obras(id) ON DELETE SET NULL,
  nome            text NOT NULL,
  tipo            text NOT NULL CHECK (tipo IN ('obra','avulsa','subpasta')),
  caminho         text NOT NULL,
  criado_por      uuid REFERENCES auth.users(id),
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz NULL
);

CREATE TABLE IF NOT EXISTS engenharia_notas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pasta_id        uuid NOT NULL REFERENCES engenharia_pastas(id) ON DELETE CASCADE,
  titulo          text NOT NULL,
  conteudo_json   jsonb NOT NULL DEFAULT '{}'::jsonb,
  versao          int NOT NULL DEFAULT 1,
  criado_por      uuid REFERENCES auth.users(id),
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz NULL
);

CREATE TABLE IF NOT EXISTS engenharia_notas_versoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_id         uuid NOT NULL REFERENCES engenharia_notas(id) ON DELETE CASCADE,
  versao          int NOT NULL,
  conteudo_json   jsonb NOT NULL,
  autor_id        uuid REFERENCES auth.users(id),
  criado_em       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS engenharia_calculos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pasta_id        uuid NOT NULL REFERENCES engenharia_pastas(id) ON DELETE CASCADE,
  titulo          text NOT NULL,
  documento_json  jsonb NOT NULL DEFAULT '{}'::jsonb,
  alerta_ativo    boolean NOT NULL DEFAULT true,
  versao          int NOT NULL DEFAULT 1,
  criado_por      uuid REFERENCES auth.users(id),
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz NULL
);

CREATE TABLE IF NOT EXISTS engenharia_calculos_versoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calculo_id      uuid NOT NULL REFERENCES engenharia_calculos(id) ON DELETE CASCADE,
  versao          int NOT NULL,
  documento_json  jsonb NOT NULL,
  autor_id        uuid REFERENCES auth.users(id),
  criado_em       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS engenharia_arquivos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pasta_id        uuid NOT NULL REFERENCES engenharia_pastas(id) ON DELETE CASCADE,
  nome_original   text NOT NULL,
  extensao        text NOT NULL,
  mime_type       text NOT NULL,
  tamanho_bytes   bigint NOT NULL CHECK (tamanho_bytes > 0 AND tamanho_bytes <= 52428800),
  storage_path    text NOT NULL UNIQUE,
  checksum_sha256 text,
  criado_por      uuid REFERENCES auth.users(id),
  criado_em       timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz NULL
);

CREATE TABLE IF NOT EXISTS engenharia_locks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurso_tipo    text NOT NULL CHECK (recurso_tipo IN ('nota','calculo')),
  recurso_id      uuid NOT NULL,
  usuario_id      uuid NOT NULL REFERENCES auth.users(id),
  expira_em       timestamptz NOT NULL,
  criado_em       timestamptz NOT NULL DEFAULT now()
);

-- (Índices, RLS policies, triggers e funções estão nas migrations específicas.
--  Para reaplicar tudo do zero, rodar as 4 migrations Engenharia em ordem.)
```

> Não duplicar índices, policies, triggers e funções aqui — o arquivo `schema.sql` no projeto é uma referência simplificada que NÃO recria 100% do estado. Devs novos rodam isso + as migrations.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "docs(engenharia): refletir 7 tabelas novas no schema.sql

Migrations 20260526150000-20260526180000 (Onda 1) ja aplicadas no projeto
Supabase. Esse arquivo eh hand-maintained — adiciona apenas as tabelas
(indices, RLS, triggers e funcoes ficam nas migrations)."
```

---

## Task 8: Verificação end-to-end

> Confirma que a Onda 1 está sólida antes de fechar.

- [ ] **Step 1: Rodar `get_advisors` security + performance**

Via MCP:
```
mcp__plugin_supabase_supabase__get_advisors  type='security'
mcp__plugin_supabase_supabase__get_advisors  type='performance'
```

Esperado: zero novos issues em tabelas `engenharia_*` nem nas funções novas. Se aparecer "function search_path mutable", revisar (todas as funções já têm `set search_path = public, pg_temp`).

- [ ] **Step 2: Smoke test fluxo obras→pasta (via execute_sql como superuser)**

```sql
-- 1. Quantas pastas tipo='obra' temos antes?
select count(*) as antes from public.engenharia_pastas where tipo = 'obra';

-- 2. Cria obra de teste com nome único
insert into public.obras (id, nome, criado_por)
values ('test-engenharia-onda1-' || gen_random_uuid()::text, 'Teste Onda 1 Engenharia', '');

-- 3. Quantas pastas temos depois?
select count(*) as depois from public.engenharia_pastas where tipo = 'obra';
-- Esperado: depois = antes + 1

-- 4. Olha a pasta criada
select id, obra_id, nome, tipo, caminho
  from public.engenharia_pastas
 where nome = 'Teste Onda 1 Engenharia';

-- 5. Cleanup
delete from public.obras where nome = 'Teste Onda 1 Engenharia';
delete from public.engenharia_pastas where nome like '[Arquivada %] Teste Onda 1 Engenharia';
```

- [ ] **Step 3: Rodar security-review skill**

Invocar a skill `security-review` sobre o diff dessa onda. Ela vai analisar:
- Migrations (RLS, SECDEF, search_path)
- Permissões (gates)
- Risco de SQL injection (não há entrada de user nas migrations — risk baixo)

Esperado: nenhum HIGH/CRITICAL.

- [ ] **Step 4: Verificação manual via UI (sem código UI ainda — verificar via SQL)**

Criar uma obra usando a UI atual de Obras (`/obras` no browser). Confirmar via `execute_sql` que a pasta apareceu em `engenharia_pastas`. Deletar a obra, confirmar que a pasta virou avulsa.

- [ ] **Step 5: Validar typecheck final + Vitest verde**

```bash
cd /Users/tiagocameli/projects/Gestao_Obras
npx tsc -b
npx vitest run
```

Esperado: 0 erros TS, suite Vitest verde (em particular os 6 testes novos de Engenharia).

- [ ] **Step 6: Escrever CHANGELOG e atualizar plano-mestre**

Criar `docs/modulos/engenharia/CHANGELOG.md` se não existir:

```markdown
# Engenharia — CHANGELOG

## Onda 1 — Schema, RLS, triggers, locks (2026-05-26)

- 7 tabelas: `engenharia_pastas`, `engenharia_notas`, `engenharia_notas_versoes`, `engenharia_calculos`, `engenharia_calculos_versoes`, `engenharia_arquivos`, `engenharia_locks`.
- RLS per-command via `private.current_has_action` em todas.
- 3 triggers SECDEF em `obras` (insert/update_nome/before_delete) — pasta automática e conversão para avulsa ao deletar obra.
- 2 funções SECDEF para lock pessimista: `engenharia_acquire_lock` e `engenharia_release_lock`.
- 17 chaves novas em `ACOES_PLATAFORMA` + templates de cargo para 6 perfis.

Decisões aplicadas: D-2, D-3, D-4 (revisada), D-5, D-7, D-8. Detalhes em `docs/superpowers/plans/2026-05-26-engenharia-modulo.md`.
```

Adicionar entrada no plano-mestre (seção 7, Onda 1) marcando "concluída em 2026-05-26".

- [ ] **Step 7: Commit final + tag**

```bash
git add docs/modulos/engenharia/CHANGELOG.md docs/superpowers/plans/2026-05-26-engenharia-modulo.md
git commit -m "docs(engenharia): CHANGELOG Onda 1 + marca Onda 1 concluida no plano mestre"
git tag engenharia-onda-1-done
```

---

## Self-Review

**Spec coverage:**
- 7 tabelas (seção 4 do plano-mestre): ✅ Task 1
- RLS per-command: ✅ Task 2
- 3 triggers SECDEF em obras: ✅ Task 3
- Funções de lock (D-4 revisada): ✅ Task 4
- 17 chaves em ACOES_PLATAFORMA: ✅ Task 5
- Templates de cargo: ✅ Task 6
- schema.sql atualizado: ✅ Task 7
- Verificação end-to-end + security-review: ✅ Task 8

**Placeholders scan:** Nenhum "TODO/TBD/fill in". Todos os arquivos SQL e TS estão completos.

**Type consistency:**
- `obra_id text` consistente em pastas + obras (text, não uuid).
- `criado_por uuid references auth.users(id)` consistente em todas as tabelas novas.
- `recurso_tipo text check (in ('nota','calculo'))` consistente em `engenharia_locks` e funções de lock.
- Função `engenharia_acquire_lock(text, uuid, int)` — assinatura idêntica em fix e rollback.
- Mesmo prefixo `engenharia_` em todas as tabelas, funções e triggers.

**Granularidade:**
- 8 tasks, 6–7 steps cada.
- Steps com 2–5 min de trabalho cada.
- Pause points: 4 confirmações de user (Tasks 1–4) antes de aplicar migration.

---

## Critério de "Onda 1 pronta"

- [ ] 4 migrations + 4 rollbacks no `supabase/migrations/`.
- [ ] 4 `apply_migration` rodadas no Supabase prod, com confirmação user em cada uma.
- [ ] `get_advisors` security+performance sem novos issues.
- [ ] Trigger AFTER INSERT testado: criar obra → pasta nasce.
- [ ] Trigger AFTER UPDATE testado: renomear obra → pasta sincroniza.
- [ ] Trigger BEFORE DELETE testado: deletar obra → pasta vira avulsa com prefixo `[Arquivada YYYY-MM-DD]`.
- [ ] Unique constraint de lock testado: 2º lock pra mesmo recurso bloqueado.
- [ ] 17 chaves visíveis no formulário de permissões (rota `/funcionarios/permissoes`).
- [ ] 6 testes Vitest verdes (`acoesPadraoDoCargo` por cargo).
- [ ] `npx tsc -b` zero erros.
- [ ] security-review skill sem HIGH/CRITICAL.
- [ ] CHANGELOG + plano-mestre atualizados.
- [ ] Commits agrupados por task (uma feature por commit).

---

## Execution Handoff

**Plano salvo em `docs/superpowers/plans/2026-05-26-engenharia-onda-1-schema.md`.**

Duas opções de execução (recomendação por escrito):

1. **Subagent-Driven (recomendado pra essa onda)** — dispatch fresh subagent por task, com review entre tasks. Bom porque cada task é uma migration pareada (fix+rollback) e merece pause/review pra confirmar antes de aplicar. Use `superpowers:subagent-driven-development`.

2. **Inline Execution** — eu executo aqui mesmo, com checkpoints pra você confirmar antes de cada `apply_migration`. Use `superpowers:executing-plans`.

**Qual abordagem?**
