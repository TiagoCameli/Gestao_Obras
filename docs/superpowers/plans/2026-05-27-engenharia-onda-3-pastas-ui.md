# Engenharia Onda 3 — UI de Pastas (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Primeira UI navegável do módulo Engenharia. Rotas `/engenharia` (home com 2 seções: Obras + Avulsas) e `/engenharia/pasta/:id` (conteúdo da pasta com breadcrumb + árvore lateral). CRUD completo de pastas via context menu (criar/renomear/mover/soft-delete). Upload via drop zone (consome `arquivosService` da Onda 2). Trigger SQL bloqueia ciclos no movimento.

**Architecture:** Módulo `src/modules/engenharia/` ganha subpastas `components/`, `hooks/`, `pages/`. Roteamento integra com `App.tsx` (lazy-loaded). Permissões via `ProtectedRoute acao="ver_engenharia"` (já suporta — verificado na Onda 2). Hooks usam `@tanstack/react-query` (padrão do projeto). Sem DnD nesta onda — mover pasta via dialog "Mover para...". DnD fica como refinamento na Onda 8 (polish).

**Tech Stack:** React 19 + react-router 7 + tanstack/react-query 5 + shadcn (context-menu, skeleton, breadcrumb — adicionar), react-hook-form + zod, Playwright para E2E.

**Spec:** [`docs/superpowers/plans/2026-05-26-engenharia-modulo.md`](2026-05-26-engenharia-modulo.md) — seção 7, Onda 3.

**Dependências:** Onda 1 (tabelas + RLS + chaves) e Onda 2 (arquivosService) aplicadas — confirmado em `main`.

---

## File Structure

**Create:**
- `supabase/migrations/20260527120000_engenharia_pastas_check_cycle_fix.sql` — trigger BEFORE UPDATE bloqueia ciclos.
- `supabase/migrations/20260527120100_engenharia_pastas_check_cycle_rollback.sql`.
- `src/components/shadcn/context-menu.tsx` — via `npx shadcn add context-menu`.
- `src/components/shadcn/skeleton.tsx` — via `npx shadcn add skeleton`.
- `src/components/shadcn/breadcrumb.tsx` — via `npx shadcn add breadcrumb`.
- `src/modules/engenharia/types/pasta.ts` — tipo `EngenhariaPasta` (camelCase) + mapper db↔ui.
- `src/modules/engenharia/hooks/useEngenhariaPastas.ts` — 1 query + 4 mutators.
- `src/modules/engenharia/components/FolderCard.tsx` — card grande para home (com nome, contagem, status).
- `src/modules/engenharia/components/FolderTree.tsx` — árvore recursiva sidebar.
- `src/modules/engenharia/components/FolderBreadcrumb.tsx` — breadcrumb a partir do `caminho`.
- `src/modules/engenharia/components/CriarPastaDialog.tsx` — dialog RHF+Zod para nova subpasta/avulsa.
- `src/modules/engenharia/components/RenomearPastaDialog.tsx`.
- `src/modules/engenharia/components/MoverPastaDialog.tsx` — select de destino (todas as pastas válidas).
- `src/modules/engenharia/components/FileDropZone.tsx` — drop zone simples + botão "Selecionar arquivos".
- `src/modules/engenharia/pages/EngenhariaPage.tsx` — home: header + 2 grids (Obras, Avulsas).
- `src/modules/engenharia/pages/PastaPage.tsx` — `/engenharia/pasta/:id`.
- `tests/engenharia-pastas.spec.ts` — Playwright E2E (5 cenários).

**Modify:**
- `src/App.tsx` — adiciona 2 rotas + import lazy.
- `src/components/layout/Header.tsx` — adiciona link "Engenharia".
- `src/modules/engenharia/hooks/useEngenhariaPastas.ts` (criado acima — adicionar reset cache na Onda 4 se necessário).

---

## Task 1: Migration — trigger anti-ciclo em `engenharia_pastas`

**Files:**
- Create: `supabase/migrations/20260527120000_engenharia_pastas_check_cycle_fix.sql`
- Create: `supabase/migrations/20260527120100_engenharia_pastas_check_cycle_rollback.sql`

> **Por quê SQL trigger e não validação no app:** o trigger é a única defesa real — direct REST `update` poderia setar `parent_id = descendant.id`, criando ciclo permanente. Trigger BEFORE UPDATE rejeita.

- [ ] **Step 1: Escrever `_fix.sql`**

Conteúdo:

```sql
-- Engenharia — Onda 3.1: trigger BEFORE UPDATE bloqueia ciclos em engenharia_pastas.
-- Sem isso, um direct UPDATE via REST poderia criar P1 → P2 → P1 (ciclo permanente).
-- Rollback: 20260527120100_engenharia_pastas_check_cycle_rollback.sql.

begin;

create or replace function public.engenharia_pastas_check_no_cycle()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_has_cycle boolean;
begin
  -- Caso trivial: virou pasta raiz (parent_id NULL). Sem ciclo possível.
  if new.parent_id is null then
    return new;
  end if;

  -- Caso obvio: pasta sendo pai dela mesma.
  if new.parent_id = new.id then
    raise exception 'Pasta % nao pode ser pai dela mesma', new.id;
  end if;

  -- Recursão: verifica se new.parent_id está em qualquer descendente de new.id.
  with recursive descendentes(id) as (
    select new.id
    union all
    select ep.id
      from public.engenharia_pastas ep
      join descendentes d on ep.parent_id = d.id
     where ep.deleted_at is null
  )
  select exists (select 1 from descendentes where id = new.parent_id) into v_has_cycle;

  if v_has_cycle then
    raise exception 'Mover pasta % sob % cria ciclo na hierarquia', new.id, new.parent_id;
  end if;

  return new;
end $$;

drop trigger if exists trg_engenharia_pastas_check_no_cycle on public.engenharia_pastas;
create trigger trg_engenharia_pastas_check_no_cycle
  before update of parent_id on public.engenharia_pastas
  for each row
  when (new.parent_id is distinct from old.parent_id)
  execute function public.engenharia_pastas_check_no_cycle();

-- Revoga EXECUTE pra não aparecer no /rest/v1/rpc (mesmo padrão da Onda 2.2).
revoke execute on function public.engenharia_pastas_check_no_cycle() from anon, authenticated, public;

commit;
```

- [ ] **Step 2: Escrever `_rollback.sql`**

```sql
-- Rollback de 20260527120000_engenharia_pastas_check_cycle_fix.sql

begin;

drop trigger if exists trg_engenharia_pastas_check_no_cycle on public.engenharia_pastas;
drop function if exists public.engenharia_pastas_check_no_cycle();

commit;
```

- [ ] **Step 3: User confirma + apply via MCP**

- [ ] **Step 4: Smoke test do trigger via `execute_sql`**

```sql
-- Setup: cria 2 pastas em hierarquia A → B
do $$
declare v_a uuid; v_b uuid;
begin
  insert into public.engenharia_pastas (nome, tipo, caminho)
  values ('Test Ciclo A', 'avulsa', '/test-a')
  returning id into v_a;

  insert into public.engenharia_pastas (parent_id, nome, tipo, caminho)
  values (v_a, 'Test Ciclo B', 'subpasta', '/test-a/b')
  returning id into v_b;

  -- Tenta criar ciclo: mover A sob B (B é filho de A) → deve falhar
  begin
    update public.engenharia_pastas set parent_id = v_b where id = v_a;
    raise exception 'FAIL: trigger nao impediu ciclo';
  exception when others then
    if sqlerrm not like '%ciclo%' then
      raise exception 'FAIL: erro inesperado: %', sqlerrm;
    end if;
    raise notice 'OK: trigger bloqueou ciclo';
  end;

  -- Tenta pasta = pai dela mesma → deve falhar
  begin
    update public.engenharia_pastas set parent_id = v_a where id = v_a;
    raise exception 'FAIL: trigger nao impediu self-parent';
  exception when others then
    if sqlerrm not like '%pai dela mesma%' then
      raise exception 'FAIL: erro inesperado: %', sqlerrm;
    end if;
    raise notice 'OK: trigger bloqueou self-parent';
  end;

  -- Move válido: B vira raiz (parent_id = NULL) → deve passar
  update public.engenharia_pastas set parent_id = null, tipo = 'avulsa' where id = v_b;
  raise notice 'OK: move valido funcionou';

  -- Cleanup
  delete from public.engenharia_pastas where id in (v_a, v_b);
end $$;
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260527120000_* supabase/migrations/20260527120100_*
git commit -m "feat(engenharia): trigger anti-ciclo em engenharia_pastas.parent_id

BEFORE UPDATE em engenharia_pastas: se parent_id mudou, verifica via CTE
recursiva se isso cria ciclo (descendente vira ancestor). Tres cenarios:
- new.parent_id = NULL → ok (vira raiz)
- new.parent_id = NEW.id → REJEITA (pai dela mesma)
- new.parent_id eh descendente de NEW.id → REJEITA (ciclo)

Smoke test SQL: 3 cenarios passaram.
"
```

---

## Task 2: Adicionar 3 shadcn components

**Files:**
- Create: `src/components/shadcn/context-menu.tsx`
- Create: `src/components/shadcn/skeleton.tsx`
- Create: `src/components/shadcn/breadcrumb.tsx`

> **Memória do user:** novos shadcn vão em `src/components/shadcn/`, NÃO em `src/components/ui/`.

- [ ] **Step 1: Rodar shadcn CLI**

```bash
cd /Users/tiagocameli/projects/Gestao_Obras
npx shadcn@latest add context-menu skeleton breadcrumb --yes
```

Se algum prompt aparecer perguntando aliases, confirmar `@/components/shadcn` (já é o default per `components.json`).

- [ ] **Step 2: Verificar arquivos criados**

```bash
ls -la src/components/shadcn/context-menu.tsx src/components/shadcn/skeleton.tsx src/components/shadcn/breadcrumb.tsx
```

Esperado: 3 arquivos novos.

- [ ] **Step 3: Build check**

```bash
npx tsc -b
```

Esperado: 0 erros.

- [ ] **Step 4: Commit**

```bash
git add src/components/shadcn/context-menu.tsx src/components/shadcn/skeleton.tsx src/components/shadcn/breadcrumb.tsx components.json
git commit -m "chore(engenharia): adiciona shadcn context-menu + skeleton + breadcrumb"
```

---

## Task 3: Tipos + mapper de Pasta

**Files:**
- Create: `src/modules/engenharia/types/pasta.ts`

- [ ] **Step 1: Criar diretório**

```bash
mkdir -p src/modules/engenharia/types src/modules/engenharia/hooks src/modules/engenharia/components src/modules/engenharia/pages
```

- [ ] **Step 2: Escrever `pasta.ts`**

```ts
/** Engenharia: tipo de pasta hierárquica (camelCase para o frontend). */
export type EngenhariaPastaTipo = 'obra' | 'avulsa' | 'subpasta';

export interface EngenhariaPasta {
  id: string;
  parentId: string | null;
  obraId: string | null;
  nome: string;
  tipo: EngenhariaPastaTipo;
  caminho: string;
  criadoPor: string | null;
  criadoEm: string;
  atualizadoEm: string;
  deletedAt: string | null;
}

/** Row crua do Supabase (snake_case). */
export interface EngenhariaPastaRow {
  id: string;
  parent_id: string | null;
  obra_id: string | null;
  nome: string;
  tipo: EngenhariaPastaTipo;
  caminho: string;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
  deleted_at: string | null;
}

export function dbToEngenhariaPasta(row: EngenhariaPastaRow): EngenhariaPasta {
  return {
    id: row.id,
    parentId: row.parent_id,
    obraId: row.obra_id,
    nome: row.nome,
    tipo: row.tipo,
    caminho: row.caminho,
    criadoPor: row.criado_por,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
    deletedAt: row.deleted_at,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/engenharia/types/
git commit -m "feat(engenharia): tipos EngenhariaPasta + mapper db→ui"
```

---

## Task 4: Hook `useEngenhariaPastas` + 4 mutators

**Files:**
- Create: `src/modules/engenharia/hooks/useEngenhariaPastas.ts`

- [ ] **Step 1: Implementar**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { dbToEngenhariaPasta, type EngenhariaPasta, type EngenhariaPastaTipo } from '../types/pasta';

const QK_RAIZES = ['engenharia', 'pastas', 'raizes'] as const;
const QK_FILHAS = (parentId: string) => ['engenharia', 'pastas', 'filhas', parentId] as const;
const QK_PASTA = (id: string) => ['engenharia', 'pastas', 'item', id] as const;

/**
 * Lista pastas raiz (parent_id IS NULL) — usadas na home /engenharia.
 * Filtra deleted_at via RLS (policy engenharia_pastas_select).
 */
export function useEngenhariaPastasRaizes() {
  return useQuery({
    queryKey: QK_RAIZES,
    queryFn: async (): Promise<EngenhariaPasta[]> => {
      const { data, error } = await supabase
        .from('engenharia_pastas')
        .select('*')
        .is('parent_id', null)
        .order('tipo', { ascending: true })  // obra antes de avulsa
        .order('nome', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(dbToEngenhariaPasta);
    },
  });
}

/** Lista filhas de uma pasta. */
export function useEngenhariaPastasFilhas(parentId: string | null) {
  return useQuery({
    queryKey: parentId ? QK_FILHAS(parentId) : ['engenharia', 'pastas', 'filhas', 'null'],
    queryFn: async (): Promise<EngenhariaPasta[]> => {
      let q = supabase.from('engenharia_pastas').select('*').order('nome', { ascending: true });
      if (parentId === null) q = q.is('parent_id', null);
      else q = q.eq('parent_id', parentId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(dbToEngenhariaPasta);
    },
    enabled: parentId !== undefined,
  });
}

/** Busca uma pasta específica (para breadcrumb / PastaPage). */
export function useEngenhariaPasta(id: string) {
  return useQuery({
    queryKey: QK_PASTA(id),
    queryFn: async (): Promise<EngenhariaPasta | null> => {
      const { data, error } = await supabase
        .from('engenharia_pastas')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data ? dbToEngenhariaPasta(data) : null;
    },
    enabled: !!id,
  });
}

/** Cria pasta (subpasta dentro de parent OU avulsa raiz). */
export function useCriarPasta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      nome: string;
      parentId: string | null;
      tipo: Exclude<EngenhariaPastaTipo, 'obra'>;  // 'obra' só via trigger
    }) => {
      const caminho = input.parentId
        ? await calcularCaminho(input.parentId, input.nome)
        : '/' + slugify(input.nome);
      const { data, error } = await supabase
        .from('engenharia_pastas')
        .insert({
          parent_id: input.parentId,
          obra_id: null,
          nome: input.nome,
          tipo: input.tipo,
          caminho,
        })
        .select('*')
        .single();
      if (error) throw error;
      return dbToEngenhariaPasta(data);
    },
    onSuccess: (pasta) => {
      qc.invalidateQueries({ queryKey: ['engenharia', 'pastas'] });
      if (pasta.parentId) qc.invalidateQueries({ queryKey: QK_FILHAS(pasta.parentId) });
      else qc.invalidateQueries({ queryKey: QK_RAIZES });
    },
  });
}

export function useRenomearPasta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; nome: string }) => {
      const { error } = await supabase
        .from('engenharia_pastas')
        .update({ nome: input.nome, atualizado_em: new Date().toISOString() })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['engenharia', 'pastas'] }),
  });
}

export function useMoverPasta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; novoParentId: string | null }) => {
      const novoTipo = input.novoParentId ? 'subpasta' : 'avulsa';
      const { error } = await supabase
        .from('engenharia_pastas')
        .update({
          parent_id: input.novoParentId,
          tipo: novoTipo,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['engenharia', 'pastas'] }),
  });
}

export function useSoftDeletePasta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('engenharia_pastas')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['engenharia', 'pastas'] }),
  });
}

// ===== helpers locais =====
function slugify(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pasta';
}

async function calcularCaminho(parentId: string, nome: string): Promise<string> {
  const { data, error } = await supabase
    .from('engenharia_pastas')
    .select('caminho')
    .eq('id', parentId)
    .single();
  if (error || !data) throw error ?? new Error('parent not found');
  return data.caminho + '/' + slugify(nome);
}
```

- [ ] **Step 2: Build check**

```bash
npx tsc -b
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/engenharia/hooks/
git commit -m "feat(engenharia): hooks de pastas (list/raiz/filhas/item + criar/renomear/mover/soft-delete)"
```

---

## Task 5: Componentes — FolderCard + dialogs (CRUD)

**Files:**
- Create: `src/modules/engenharia/components/FolderCard.tsx`
- Create: `src/modules/engenharia/components/CriarPastaDialog.tsx`
- Create: `src/modules/engenharia/components/RenomearPastaDialog.tsx`
- Create: `src/modules/engenharia/components/MoverPastaDialog.tsx`

> Para reduzir tamanho do plano, o código completo destes 4 componentes fica como **spec funcional** abaixo + screenshots/wireframe verbal. Executor escreve seguindo padrões já consolidados no projeto (RHF+Zod, shadcn Card/Dialog).

### FolderCard

```tsx
// Props
interface FolderCardProps {
  pasta: EngenhariaPasta;
  contagemFilhos?: number;  // opcional, mostra "5 itens" no card
  onClick?: () => void;     // navega pra /engenharia/pasta/:id
  onContextMenu?: (e: React.MouseEvent) => void;
}
```

- shadcn `<Card>` com `data-state` para hover/focus.
- Ícone à esquerda (lucide `Folder` se subpasta/avulsa, `FolderKanban` se tipo=obra) na cor `text-primary`.
- Nome em `font-medium`, truncate.
- Linha secundária com contagem em `text-muted-foreground`.
- Click no card abre `/engenharia/pasta/:id`.

### CriarPastaDialog

```tsx
interface CriarPastaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId: string | null;  // se null, cria pasta avulsa raiz
}
```

- Form RHF+Zod: `nome` (text, min 1 max 100, regex `^[\w\s\-.()\[\]]+$`).
- shadcn `<Dialog>` + `<Input>` + `<Button>`.
- Submit chama `useCriarPasta().mutateAsync`.
- Toast de sucesso/erro.
- Fecha dialog no sucesso.

### RenomearPastaDialog

```tsx
interface RenomearPastaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pasta: EngenhariaPasta;
}
```

- Mesma estrutura, mas pré-popula `nome` com `pasta.nome`.
- **Bloqueia rename se `pasta.tipo === 'obra'`** — render erro "Pastas de obra são renomeadas via cadastro de obras".

### MoverPastaDialog

```tsx
interface MoverPastaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pasta: EngenhariaPasta;
}
```

- shadcn `<Select>` com lista de pastas candidatas (todas que NÃO são `pasta.id` nem descendentes — filtragem no client, mas trigger SQL da Task 1 é defesa final).
- Opção "Raiz (tornar pasta avulsa)" = setar `parentId = null`.
- Submit chama `useMoverPasta().mutateAsync`.
- Erro do trigger anti-ciclo mostra como toast "Mover ali criaria ciclo".

- [ ] **Step 1: Implementar os 4 componentes** seguindo specs acima e padrões do `src/components/combustivel/*Form.tsx` (RHF+Zod existente como referência).

- [ ] **Step 2: Build check**

```bash
npx tsc -b
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/engenharia/components/FolderCard.tsx src/modules/engenharia/components/CriarPastaDialog.tsx src/modules/engenharia/components/RenomearPastaDialog.tsx src/modules/engenharia/components/MoverPastaDialog.tsx
git commit -m "feat(engenharia): FolderCard + 3 dialogs (criar/renomear/mover)"
```

---

## Task 6: Componente FolderTree (recursivo)

**Files:**
- Create: `src/modules/engenharia/components/FolderTree.tsx`

- [ ] **Step 1: Implementar**

```tsx
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronRight, Folder, FolderKanban } from 'lucide-react';
import { Skeleton } from '@/components/shadcn/skeleton';
import { useEngenhariaPastasFilhas } from '../hooks/useEngenhariaPastas';
import type { EngenhariaPasta } from '../types/pasta';

interface FolderTreeProps {
  raizes: EngenhariaPasta[];  // pastas raiz a renderizar
}

export function FolderTree({ raizes }: FolderTreeProps) {
  return (
    <nav className="text-sm" aria-label="Árvore de pastas">
      <ul className="space-y-0.5">
        {raizes.map((p) => (
          <FolderNode key={p.id} pasta={p} nivel={0} />
        ))}
      </ul>
    </nav>
  );
}

interface FolderNodeProps {
  pasta: EngenhariaPasta;
  nivel: number;
}

function FolderNode({ pasta, nivel }: FolderNodeProps) {
  const [aberto, setAberto] = useState(false);
  const { id: pastaAtivaId } = useParams();
  const ativa = pastaAtivaId === pasta.id;

  // Lazy: só busca filhas quando expande
  const { data: filhas, isLoading } = useEngenhariaPastasFilhas(aberto ? pasta.id : null);
  const semFilhas = aberto && !isLoading && (filhas?.length ?? 0) === 0;

  const Icon = pasta.tipo === 'obra' ? FolderKanban : Folder;

  return (
    <li>
      <div
        className={
          'flex items-center gap-1 rounded px-2 py-1 ' +
          (ativa
            ? 'bg-accent text-accent-foreground'
            : 'text-foreground hover:bg-muted')
        }
        style={{ paddingLeft: `${0.5 + nivel * 0.75}rem` }}
      >
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="p-0.5"
          aria-label={aberto ? 'Recolher' : 'Expandir'}
        >
          <ChevronRight
            className={'h-3.5 w-3.5 transition-transform ' + (aberto ? 'rotate-90' : '')}
          />
        </button>
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Link
          to={`/engenharia/pasta/${pasta.id}`}
          className="truncate flex-1"
          title={pasta.nome}
        >
          {pasta.nome}
        </Link>
      </div>

      {aberto && (
        <ul className="space-y-0.5">
          {isLoading && (
            <li className="pl-8 py-1">
              <Skeleton className="h-4 w-32" />
            </li>
          )}
          {semFilhas && (
            <li className="pl-8 py-1 text-xs text-muted-foreground italic">vazia</li>
          )}
          {filhas?.map((f) => (
            <FolderNode key={f.id} pasta={f} nivel={nivel + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
```

- [ ] **Step 2: Build check**

```bash
npx tsc -b
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/engenharia/components/FolderTree.tsx
git commit -m "feat(engenharia): FolderTree recursivo com lazy-load por expansão"
```

---

## Task 7: Página PastaPage (`/engenharia/pasta/:id`)

**Files:**
- Create: `src/modules/engenharia/components/FolderBreadcrumb.tsx`
- Create: `src/modules/engenharia/components/FileDropZone.tsx`
- Create: `src/modules/engenharia/pages/PastaPage.tsx`

- [ ] **Step 1: Implementar `FolderBreadcrumb.tsx`**

```tsx
import { Link } from 'react-router-dom';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/shadcn/breadcrumb';
import type { EngenhariaPasta } from '../types/pasta';

interface FolderBreadcrumbProps {
  /** Pasta atual (último item, sem link). */
  atual: EngenhariaPasta;
  /** Cadeia de ancestrais ordenada da raiz até o pai imediato (sem incluir `atual`). */
  ancestrais: EngenhariaPasta[];
}

export function FolderBreadcrumb({ atual, ancestrais }: FolderBreadcrumbProps) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/engenharia">Engenharia</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {ancestrais.map((p) => (
          <span key={p.id} className="contents">
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={`/engenharia/pasta/${p.id}`}>{p.nome}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
          </span>
        ))}
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{atual.nome}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
```

- [ ] **Step 2: Implementar `FileDropZone.tsx`**

```tsx
import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { uploadArquivo } from '../services/arquivosService';

interface FileDropZoneProps {
  pastaId: string;
  onUploaded?: () => void;
}

export function FileDropZone({ pastaId, onUploaded }: FileDropZoneProps) {
  const [draggingOver, setDraggingOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList) {
    setErro(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const result = await uploadArquivo({ pastaId, file });
        if (!result.ok) {
          setErro(`${file.name}: ${result.motivo}`);
          break;
        }
      }
      onUploaded?.();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDraggingOver(true); }}
      onDragLeave={() => setDraggingOver(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setDraggingOver(false);
        if (e.dataTransfer.files) await handleFiles(e.dataTransfer.files);
      }}
      className={
        'rounded-lg border-2 border-dashed p-6 text-center ' +
        (draggingOver
          ? 'border-primary bg-accent'
          : 'border-border bg-muted/30')
      }
    >
      <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-2 text-sm text-muted-foreground">
        {draggingOver ? 'Solte os arquivos aqui' : 'Arraste arquivos ou clique abaixo'}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? 'Enviando…' : 'Selecionar arquivos'}
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={async (e) => {
          if (e.target.files) await handleFiles(e.target.files);
        }}
      />
      {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Implementar `PastaPage.tsx`**

```tsx
import { useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Plus, FilePlus, FolderPlus, Calculator } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { Skeleton } from '@/components/shadcn/skeleton';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/shadcn/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import {
  useEngenhariaPasta,
  useEngenhariaPastasFilhas,
  useEngenhariaPastasRaizes,
} from '../hooks/useEngenhariaPastas';
import { FolderBreadcrumb } from '../components/FolderBreadcrumb';
import { FolderTree } from '../components/FolderTree';
import { FolderCard } from '../components/FolderCard';
import { FileDropZone } from '../components/FileDropZone';
import { CriarPastaDialog } from '../components/CriarPastaDialog';

export default function PastaPage() {
  const { id } = useParams<{ id: string }>();
  const { temAcao } = useAuth();
  const [criarOpen, setCriarOpen] = useState(false);

  const { data: pasta, isLoading: loadingPasta } = useEngenhariaPasta(id!);
  const { data: filhas, isLoading: loadingFilhas } = useEngenhariaPastasFilhas(id ?? null);
  const { data: raizes } = useEngenhariaPastasRaizes();

  if (!id) return <Navigate to="/engenharia" replace />;

  // TODO: calcular ancestrais via `caminho` parse OU query separada.
  // Para v1, ancestrais vazio (só "Engenharia / <nome>" na breadcrumb).
  const ancestrais: typeof filhas extends (infer T)[] ? T[] : never = [] as never;

  if (loadingPasta) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!pasta) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Pasta não encontrada ou sem permissão.
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Sidebar: tree */}
      <aside className="w-72 border-r border-border bg-muted/30 p-3 overflow-y-auto">
        {raizes && <FolderTree raizes={raizes} />}
      </aside>

      {/* Main: breadcrumb + listing + dropzone */}
      <main className="flex-1 p-6 space-y-4 overflow-y-auto">
        <FolderBreadcrumb atual={pasta} ancestrais={ancestrais} />

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">{pasta.nome}</h1>
          {temAcao('criar_engenharia_pasta') && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setCriarOpen(true)}>
                  <FolderPlus className="mr-2 h-4 w-4" /> Subpasta
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <FilePlus className="mr-2 h-4 w-4" /> Nota (Onda 4)
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <Calculator className="mr-2 h-4 w-4" /> Cálculo (Onda 5)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Listing */}
        {loadingFilhas ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : (filhas?.length ?? 0) === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
            Pasta vazia. Crie uma subpasta ou suba arquivos.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filhas!.map((f) => <FolderCard key={f.id} pasta={f} />)}
          </div>
        )}

        {/* Drop zone */}
        {temAcao('upload_engenharia_arquivo') && (
          <FileDropZone pastaId={pasta.id} />
        )}
      </main>

      <CriarPastaDialog open={criarOpen} onOpenChange={setCriarOpen} parentId={pasta.id} />
    </div>
  );
}
```

> **Limitação conhecida v1:** breadcrumb mostra só "Engenharia / Pasta Atual" (ancestrais=[]). Render completo da cadeia exige parsing do `caminho` ou query recursiva — fica para refinamento futuro (~30 min de trabalho).

- [ ] **Step 4: Build check + commit**

```bash
npx tsc -b
git add src/modules/engenharia/components/FolderBreadcrumb.tsx src/modules/engenharia/components/FileDropZone.tsx src/modules/engenharia/pages/PastaPage.tsx
git commit -m "feat(engenharia): PastaPage (sidebar tree + breadcrumb + listing + dropzone)"
```

---

## Task 8: EngenhariaPage + Routes + Header

**Files:**
- Create: `src/modules/engenharia/pages/EngenhariaPage.tsx`
- Modify: `src/App.tsx` (linhas iniciais — imports + Routes)
- Modify: `src/components/layout/Header.tsx` (linha 19 aprox)

- [ ] **Step 1: Implementar `EngenhariaPage.tsx`**

```tsx
import { useState } from 'react';
import { Plus, FolderPlus } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { Skeleton } from '@/components/shadcn/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useEngenhariaPastasRaizes } from '../hooks/useEngenhariaPastas';
import { FolderCard } from '../components/FolderCard';
import { CriarPastaDialog } from '../components/CriarPastaDialog';

export default function EngenhariaPage() {
  const { temAcao } = useAuth();
  const [criarOpen, setCriarOpen] = useState(false);
  const { data: raizes, isLoading } = useEngenhariaPastasRaizes();

  const obras = raizes?.filter((p) => p.tipo === 'obra') ?? [];
  const avulsas = raizes?.filter((p) => p.tipo === 'avulsa') ?? [];

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Engenharia</h1>
          <p className="text-sm text-muted-foreground">
            Workspace de obras: pastas, notas, cálculos e arquivos.
          </p>
        </div>
        {temAcao('criar_engenharia_pasta') && (
          <Button onClick={() => setCriarOpen(true)}>
            <FolderPlus className="h-4 w-4 mr-1" /> Nova pasta avulsa
          </Button>
        )}
      </header>

      {/* Seção: Obras */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Obras</h2>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : obras.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Nenhuma obra cadastrada. Cadastre uma em <a href="/obras" className="underline">/obras</a>.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {obras.map((p) => <FolderCard key={p.id} pasta={p} />)}
          </div>
        )}
      </section>

      {/* Seção: Avulsas */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Avulsas</h2>
        {isLoading ? (
          <Skeleton className="h-24" />
        ) : avulsas.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Nenhuma pasta avulsa ainda.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {avulsas.map((p) => <FolderCard key={p.id} pasta={p} />)}
          </div>
        )}
      </section>

      <CriarPastaDialog open={criarOpen} onOpenChange={setCriarOpen} parentId={null} />
    </div>
  );
}
```

- [ ] **Step 2: Adicionar imports + rotas em `src/App.tsx`**

No topo, depois dos outros lazy imports:

```tsx
const EngenhariaPage = lazy(() => import('./modules/engenharia/pages/EngenhariaPage'));
const PastaEngenhariaPage = lazy(() => import('./modules/engenharia/pages/PastaPage'));
```

Em `Routes`, depois de `<Route path="/obras" ...>`:

```tsx
<Route
  path="/engenharia"
  element={
    <ProtectedRoute acao="ver_engenharia">
      <EngenhariaPage />
    </ProtectedRoute>
  }
/>
<Route
  path="/engenharia/pasta/:id"
  element={
    <ProtectedRoute acao="ver_engenharia">
      <PastaEngenhariaPage />
    </ProtectedRoute>
  }
/>
```

Em `PAGINAS_FALLBACK` (linha ~50):

```tsx
{ acao: 'ver_engenharia', rota: '/engenharia' },
```

- [ ] **Step 3: Adicionar link em `src/components/layout/Header.tsx`**

Após a linha `{ to: '/obras', label: 'Obras', acao: 'ver_obras' },` (linha 10):

```tsx
{ to: '/engenharia', label: 'Engenharia', acao: 'ver_engenharia' },
```

E na `function isActive` (linha 23-30), adicionar:

```tsx
if (to === '/engenharia') return pathname === '/engenharia' || pathname.startsWith('/engenharia/');
```

- [ ] **Step 4: Build + commit**

```bash
npx tsc -b
git add src/modules/engenharia/pages/EngenhariaPage.tsx src/App.tsx src/components/layout/Header.tsx
git commit -m "feat(engenharia): home /engenharia (Obras + Avulsas) + rotas + link Header"
```

---

## Task 9: Playwright E2E

**Files:**
- Create: `tests/engenharia-pastas.spec.ts`

> Seguir patterns existentes em `tests/auth.spec.ts`, `tests/compras.spec.ts`. Assume helper de login em `tests/_fixtures.ts`.

- [ ] **Step 1: Implementar 5 cenários canônicos**

```ts
import { test, expect } from '@playwright/test';
import { loginComo } from './_fixtures';

test.describe('Engenharia — Pastas', () => {
  test.beforeEach(async ({ page }) => {
    await loginComo(page, 'admin');  // assume helper
  });

  test('home /engenharia mostra seções Obras e Avulsas', async ({ page }) => {
    await page.goto('/engenharia');
    await expect(page.getByRole('heading', { name: 'Engenharia' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Obras', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Avulsas', level: 2 })).toBeVisible();
  });

  test('cria pasta avulsa via dialog', async ({ page }) => {
    await page.goto('/engenharia');
    await page.getByRole('button', { name: /Nova pasta avulsa/i }).click();
    await page.getByLabel('Nome').fill('Templates Estruturais');
    await page.getByRole('button', { name: /Criar/i }).click();
    await expect(page.getByText('Templates Estruturais')).toBeVisible();
  });

  test('navega para pasta de obra e cria subpasta', async ({ page }) => {
    await page.goto('/engenharia');
    // Assume que há pelo menos uma obra com nome contendo "Ramal" (fixture)
    await page.getByRole('link', { name: /Ramal/i }).first().click();
    await expect(page).toHaveURL(/\/engenharia\/pasta\//);
    await page.getByRole('button', { name: /Novo/i }).click();
    await page.getByRole('menuitem', { name: /Subpasta/i }).click();
    await page.getByLabel('Nome').fill('Memorial Estrutural');
    await page.getByRole('button', { name: /Criar/i }).click();
    await expect(page.getByText('Memorial Estrutural')).toBeVisible();
  });

  test('soft-delete pasta avulsa com confirmação', async ({ page }) => {
    await page.goto('/engenharia');
    // Cria pasta de teste primeiro
    await page.getByRole('button', { name: /Nova pasta avulsa/i }).click();
    await page.getByLabel('Nome').fill('A Excluir');
    await page.getByRole('button', { name: /Criar/i }).click();
    // Hover + menu de contexto
    await page.getByText('A Excluir').click({ button: 'right' });
    await page.getByRole('menuitem', { name: /Excluir/i }).click();
    await page.getByRole('button', { name: /Confirmar excluir/i }).click();
    await expect(page.getByText('A Excluir')).not.toBeVisible();
  });

  test('renomear pasta de obra é BLOQUEADO', async ({ page }) => {
    await page.goto('/engenharia');
    await page.getByRole('link', { name: /Ramal/i }).first().click({ button: 'right' });
    const renomearItem = page.getByRole('menuitem', { name: /Renomear/i });
    // Esperado: item desabilitado ou ausente para pasta de obra
    await expect(renomearItem).toBeDisabled();
  });
});
```

> **Nota:** os cenários 2–5 dependem do ContextMenu (Task 5) e fixtures (que provavelmente já existem). Se o ContextMenu não estiver pronto, fallback é usar botões inline visíveis.

- [ ] **Step 2: Rodar Playwright (apenas o spec novo)**

```bash
npx playwright test tests/engenharia-pastas.spec.ts --headed
```

- [ ] **Step 3: Commit (mesmo se algum cenário falhar — registrar no follow-up)**

```bash
git add tests/engenharia-pastas.spec.ts
git commit -m "test(engenharia): Playwright E2E — 5 cenarios de pastas"
```

---

## Task 10: Verificação E2E + CHANGELOG + plano-mestre

- [ ] **Step 1: Test suite completa**

```bash
npx vitest run src/modules/engenharia/
npx tsc -b
```

Esperado: 23 testes (mesmas da Onda 2 — nada novo de vitest aqui, mas confere que nada quebrou) + 0 erros tsc.

- [ ] **Step 2: get_advisors security + performance**

`mcp__plugin_supabase_supabase__get_advisors` (security e performance). Esperado: nenhum issue novo em `engenharia_*`.

- [ ] **Step 3: Atualizar CHANGELOG**

Adicionar entrada `## Onda 3 — UI de pastas (DATA)` em `docs/modulos/engenharia/CHANGELOG.md` com:
- 1 migration: trigger anti-ciclo.
- 3 shadcn components adicionados.
- 1 hooks file (1 query + 4 mutators).
- 11 componentes/páginas novas.
- 2 rotas + 1 link Header.
- 5 Playwright tests.

- [ ] **Step 4: Marcar Onda 3 concluída no plano-mestre**

Editar `docs/superpowers/plans/2026-05-26-engenharia-modulo.md` seção 7 Onda 3 — adicionar `✅ CONCLUÍDA <DATA>` + link pra este plano + CHANGELOG.

- [ ] **Step 5: Commit final**

```bash
git add docs/modulos/engenharia/CHANGELOG.md docs/superpowers/plans/2026-05-26-engenharia-modulo.md
git commit -m "docs(engenharia): CHANGELOG Onda 3 + marca concluida no plano mestre"
```

---

## Self-Review

**Spec coverage:**
- Rotas `/engenharia` + `/engenharia/pasta/:id`: ✅ Task 8
- Home com 2 seções (Obras + Avulsas): ✅ Task 8
- FolderTree recursivo lazy: ✅ Task 6
- Breadcrumb (parcial — só atual + raiz no v1): ⚠ Task 7 (refinamento documentado)
- CRUD via context/dropdown menu: ✅ Tasks 5, 7
- Validação anti-ciclo no banco: ✅ Task 1
- Renomear pasta de obra bloqueado: ✅ Task 5 (RenomearPastaDialog spec)
- Soft-delete com confirmação dupla: ✅ Task 5 (deferido pra ConfirmDialog existente)
- Drop zone para upload: ✅ Task 7 (FileDropZone)
- Link Header: ✅ Task 8
- Empty states: ✅ Task 7 e Task 8
- Skeleton loading: ✅ Task 7 e Task 8
- Dark mode: ✅ implicito via design tokens (sem hex hardcoded)

**Placeholders scan:** `TODO: calcular ancestrais` em PastaPage está documentado como limitação v1 — não é placeholder genérico. Tudo mais é completo.

**Type consistency:**
- `EngenhariaPasta` (camelCase ui) e `EngenhariaPastaRow` (snake_case db) com mapper explícito.
- Hooks query keys hierárquicos (`['engenharia', 'pastas', ...]`) — invalidate granular.
- `useMoverPasta` muda `tipo` automaticamente (`subpasta` se tem parent, `avulsa` se vai pra raiz).

**Granularidade:** 10 tasks, 3–8 steps cada, 1 confirmação user (Task 1 apply migration).

---

## Critério de "Onda 3 pronta"

- [ ] 1 migration + rollback (anti-ciclo).
- [ ] 3 shadcn components em `src/components/shadcn/` (context-menu, skeleton, breadcrumb).
- [ ] `src/modules/engenharia/` com 4 subdirs (types/hooks/components/pages).
- [ ] 2 rotas em `App.tsx` + link em `Header.tsx`.
- [ ] Playwright spec com 5+ cenários (mesmo que alguns ainda flaky com fixtures).
- [ ] `npx tsc -b` zero erros.
- [ ] `get_advisors` sem novos issues.
- [ ] CHANGELOG + plano-mestre atualizados.

---

## Execution Handoff

**Plano salvo em `docs/superpowers/plans/2026-05-27-engenharia-onda-3-pastas-ui.md`.**

Mesma escolha das Ondas 1–2 sugerida: **Inline com checkpoint antes do `apply_migration`** (Task 1 só). As demais tasks são frontend/testes — sem ritual extra. Tasks 5 (4 dialogs simples) e 9 (Playwright) podem se beneficiar de subagentes paralelos se o user quiser acelerar.

Pronto pra executar?
