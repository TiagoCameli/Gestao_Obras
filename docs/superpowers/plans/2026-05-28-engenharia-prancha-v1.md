# Engenharia — Prancha (quadro livre) v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um terceiro tipo de bloco "Prancha" no módulo Engenharia: um quadro livre (canvas) onde o usuário posiciona caixas de texto, caixas de cálculo (que validam) e formas básicas onde clicar, com paleta lateral de ferramentas.

**Architecture:** Espelha o bloco de Cálculo (tabelas + RLS + SECDEF de salvar-com-versão + lock pessimista + versionamento). O canvas é DIY: container com `transform` pra pan/zoom, elementos como componentes React posicionados em absoluto, `react-moveable` (MIT) pras alças de mover/redimensionar, e a caixa de cálculo reusa `recalcularDocumento` + o componente `LinhaCalculo`.

**Tech Stack:** React + TypeScript + Vite, Supabase (Postgres/RLS/RPC), @tanstack/react-query, react-moveable, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-05-28-engenharia-prancha-quadro-livre-design.md`

**Convenção de branch:** criar `feat/engenharia-prancha` antes da Task 1 (estamos na `main`). Cada task termina com commit.

---

## Estrutura de arquivos

**Criar:**
- `supabase/migrations/20260528220000_engenharia_pranchas_fix.sql` — tabelas + índices + RLS + SECDEF salvar.
- `supabase/migrations/20260528220100_engenharia_pranchas_rollback.sql`
- `supabase/migrations/20260528230000_engenharia_backfill_prancha_por_cargo_fix.sql` — backfill das chaves por cargo.
- `supabase/migrations/20260528230100_engenharia_backfill_prancha_por_cargo_rollback.sql`
- `src/modules/engenharia/types/prancha.ts` — tipos + mappers.
- `src/modules/engenharia/services/pranchaModel.ts` — helpers puros (novoElemento, documento vazio, transform de coordenadas).
- `src/modules/engenharia/services/pranchaModel.test.ts` — Vitest.
- `src/modules/engenharia/hooks/useEngenhariaPranchas.ts` — CRUD + salvar RPC.
- `src/modules/engenharia/hooks/usePranchaVersoes.ts` — histórico.
- `src/modules/engenharia/components/prancha/PranchaToolbar.tsx` — paleta lateral.
- `src/modules/engenharia/components/prancha/ElementoTexto.tsx`
- `src/modules/engenharia/components/prancha/ElementoForma.tsx`
- `src/modules/engenharia/components/prancha/ElementoCalculo.tsx`
- `src/modules/engenharia/components/prancha/PranchaCanvas.tsx` — o quadro.
- `src/modules/engenharia/pages/PranchaPage.tsx` — compõe lock/autosave/Cmd+S/histórico.
- `tests/engenharia-prancha.spec.ts` — Playwright.

**Modificar:**
- `src/utils/permissions.ts` — 3 chaves novas + deps + templates por cargo.
- `src/utils/permissions.test.ts` — cobrir chaves novas.
- `src/modules/engenharia/hooks/useLockRecurso.ts` — adicionar `'prancha'` ao union.
- `src/App.tsx` — rota `/engenharia/prancha/:id`.
- `src/modules/engenharia/pages/PastaPage.tsx` — item "Novo > Prancha".
- `docs/modulos/engenharia/CHANGELOG.md` — entrada da onda.

---

## Task 1: Permissões — chaves, dependências, templates

**Files:**
- Modify: `src/utils/permissions.ts`
- Test: `src/utils/permissions.test.ts`

- [ ] **Step 1: Escrever o teste falhando**

Em `src/utils/permissions.test.ts`, adicione:

```typescript
import { ACOES_PLATAFORMA, DEPENDENCIAS_ACOES, TEMPLATES_ACOES_POR_CARGO } from './permissions';

describe('Engenharia — chaves de prancha', () => {
  const novas = ['criar_engenharia_prancha', 'editar_engenharia_prancha', 'excluir_engenharia_prancha'];

  it('as 3 chaves de prancha existem no grupo Engenharia', () => {
    for (const chave of novas) {
      const acao = ACOES_PLATAFORMA.find((a) => a.chave === chave);
      expect(acao, chave).toBeTruthy();
      expect(acao!.grupo).toBe('Engenharia');
    }
  });

  it('dependem de ver_engenharia (e excluir depende de editar)', () => {
    expect(DEPENDENCIAS_ACOES['criar_engenharia_prancha']).toContain('ver_engenharia');
    expect(DEPENDENCIAS_ACOES['editar_engenharia_prancha']).toContain('ver_engenharia');
    expect(DEPENDENCIAS_ACOES['excluir_engenharia_prancha']).toEqual(
      expect.arrayContaining(['ver_engenharia', 'editar_engenharia_prancha']),
    );
  });

  it('Administrador tem as 3; Engenheiro Civil tem criar+editar; Operador não tem nenhuma', () => {
    for (const chave of novas) expect(TEMPLATES_ACOES_POR_CARGO.Administrador).toContain(chave);
    expect(TEMPLATES_ACOES_POR_CARGO['Engenheiro Civil']).toEqual(
      expect.arrayContaining(['criar_engenharia_prancha', 'editar_engenharia_prancha']),
    );
    expect(TEMPLATES_ACOES_POR_CARGO.Operador).not.toContain('criar_engenharia_prancha');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/utils/permissions.test.ts`
Expected: FAIL (chaves não existem).

- [ ] **Step 3: Adicionar as chaves em `ACOES_PLATAFORMA`**

Em `src/utils/permissions.ts`, logo após a linha `{ chave: 'excluir_engenharia_calculo', ... }`, insira:

```typescript
  { chave: 'criar_engenharia_prancha', label: 'Criar prancha (quadro livre)', grupo: 'Engenharia' },
  { chave: 'editar_engenharia_prancha', label: 'Editar/salvar prancha', grupo: 'Engenharia' },
  { chave: 'excluir_engenharia_prancha', label: 'Mover prancha para lixeira', grupo: 'Engenharia' },
```

- [ ] **Step 4: Adicionar dependências em `DEPENDENCIAS_ACOES`**

Após `excluir_engenharia_calculo: [...]`, insira:

```typescript
  criar_engenharia_prancha: ['ver_engenharia'],
  editar_engenharia_prancha: ['ver_engenharia'],
  excluir_engenharia_prancha: ['ver_engenharia', 'editar_engenharia_prancha'],
```

- [ ] **Step 5: Adicionar aos templates por cargo**

`TEMPLATES_ACOES_POR_CARGO.Administrador` já inclui tudo via `[...TODAS_ACOES_PLATAFORMA]` — nada a fazer ali. Para os cargos de engenharia, encontre onde `criar_engenharia_calculo`/`editar_engenharia_calculo`/`excluir_engenharia_calculo` aparecem nos arrays de `Engenheiro Civil Sênior` e `Engenheiro Civil` e adicione os equivalentes de prancha lado a lado:
- Em `Engenheiro Civil Sênior`: adicionar `'criar_engenharia_prancha', 'editar_engenharia_prancha', 'excluir_engenharia_prancha'`.
- Em `Engenheiro Civil`: adicionar `'criar_engenharia_prancha', 'editar_engenharia_prancha'`.

(Demais cargos só têm `ver_engenharia` + `ver_lixeira_engenharia`, que já cobre visualizar a prancha — não adicionar criar/editar.)

- [ ] **Step 6: Rodar e ver passar**

Run: `npx vitest run src/utils/permissions.test.ts`
Expected: PASS (todos os testes do arquivo verdes).

- [ ] **Step 7: Commit**

```bash
git add src/utils/permissions.ts src/utils/permissions.test.ts
git commit -m "feat(engenharia): chaves de permissao da Prancha (criar/editar/excluir) + deps + templates"
```

---

## Task 2: Migration — tabelas, RLS e SECDEF de salvar

**Files:**
- Create: `supabase/migrations/20260528220000_engenharia_pranchas_fix.sql`
- Create: `supabase/migrations/20260528220100_engenharia_pranchas_rollback.sql`

- [ ] **Step 1: Escrever a migration fix**

Crie `supabase/migrations/20260528220000_engenharia_pranchas_fix.sql`:

```sql
-- Engenharia — Prancha v1: tabelas, índices, RLS e SECDEF de salvar com versão.
-- Espelha engenharia_calculos. Spec: docs/superpowers/specs/2026-05-28-engenharia-prancha-quadro-livre-design.md
-- Rollback: 20260528220100_engenharia_pranchas_rollback.sql

begin;

-- ── Tabelas ───────────────────────────────────────────────
create table public.engenharia_pranchas (
  id              uuid primary key default gen_random_uuid(),
  pasta_id        uuid not null references public.engenharia_pastas(id) on delete cascade,
  titulo          text not null,
  documento_json  jsonb not null default '{}'::jsonb,
  versao          int not null default 1,
  criado_por      uuid references auth.users(id),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  deleted_at      timestamptz null
);
create index engenharia_pranchas_pasta_idx      on public.engenharia_pranchas (pasta_id);
create index engenharia_pranchas_deleted_at_idx on public.engenharia_pranchas (deleted_at);

create table public.engenharia_pranchas_versoes (
  id              uuid primary key default gen_random_uuid(),
  prancha_id      uuid not null references public.engenharia_pranchas(id) on delete cascade,
  versao          int not null,
  documento_json  jsonb not null,
  autor_id        uuid references auth.users(id),
  criado_em       timestamptz not null default now()
);
create unique index engenharia_pranchas_versoes_unique on public.engenharia_pranchas_versoes (prancha_id, versao);
create index engenharia_pranchas_versoes_prancha_idx on public.engenharia_pranchas_versoes (prancha_id);

-- ── RLS ───────────────────────────────────────────────────
alter table public.engenharia_pranchas enable row level security;

create policy engenharia_pranchas_select on public.engenharia_pranchas
  for select to authenticated
  using (private.current_has_action('ver_engenharia') and deleted_at is null);

create policy engenharia_pranchas_select_lixeira on public.engenharia_pranchas
  for select to authenticated
  using (private.current_has_action('ver_lixeira_engenharia') and deleted_at is not null);

create policy engenharia_pranchas_insert on public.engenharia_pranchas
  for insert to authenticated
  with check (private.current_has_action('criar_engenharia_prancha'));

create policy engenharia_pranchas_update on public.engenharia_pranchas
  for update to authenticated
  using (
    private.current_has_action('editar_engenharia_prancha')
    or private.current_has_action('excluir_engenharia_prancha')
    or private.current_has_action('restaurar_lixeira_engenharia')
  )
  with check (
    private.current_has_action('editar_engenharia_prancha')
    or private.current_has_action('excluir_engenharia_prancha')
    or private.current_has_action('restaurar_lixeira_engenharia')
  );

create policy engenharia_pranchas_delete on public.engenharia_pranchas
  for delete to authenticated
  using (private.current_has_action('excluir_permanente_engenharia'));

alter table public.engenharia_pranchas_versoes enable row level security;

create policy engenharia_pranchas_versoes_select on public.engenharia_pranchas_versoes
  for select to authenticated
  using (private.current_has_action('ver_historico_engenharia'));

create policy engenharia_pranchas_versoes_insert on public.engenharia_pranchas_versoes
  for insert to authenticated
  with check (private.current_has_action('editar_engenharia_prancha'));

create policy engenharia_pranchas_versoes_delete on public.engenharia_pranchas_versoes
  for delete to authenticated
  using (private.current_has_action('excluir_permanente_engenharia'));

-- ── SECDEF: salvar prancha com versão (atômico + optimistic concurrency) ──
create or replace function public.engenharia_salvar_prancha_com_versao(
  p_prancha_id uuid,
  p_titulo text,
  p_documento_json jsonb,
  p_versao_atual int
)
returns table (ok boolean, nova_versao int, motivo text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_versao_db int;
  v_doc_db jsonb;
begin
  if not private.current_has_action('editar_engenharia_prancha') then
    return query select false, null::int, 'sem_permissao';
    return;
  end if;

  select versao, documento_json into v_versao_db, v_doc_db
    from public.engenharia_pranchas
   where id = p_prancha_id and deleted_at is null
   for update;

  if not found then
    return query select false, null::int, 'prancha_nao_encontrada';
    return;
  end if;

  if v_versao_db <> p_versao_atual then
    return query select false, v_versao_db, 'conflito_versao';
    return;
  end if;

  insert into public.engenharia_pranchas_versoes (prancha_id, versao, documento_json, autor_id)
  values (p_prancha_id, v_versao_db, v_doc_db, v_user);

  update public.engenharia_pranchas
     set titulo = p_titulo,
         documento_json = p_documento_json,
         versao = v_versao_db + 1,
         atualizado_em = now()
   where id = p_prancha_id;

  delete from public.engenharia_pranchas_versoes
   where prancha_id = p_prancha_id
     and id not in (
       select id from public.engenharia_pranchas_versoes
        where prancha_id = p_prancha_id
        order by versao desc
        limit 50
     );

  return query select true, v_versao_db + 1, ''::text;
end $$;

grant execute on function public.engenharia_salvar_prancha_com_versao(uuid, text, jsonb, int) to authenticated;
revoke execute on function public.engenharia_salvar_prancha_com_versao(uuid, text, jsonb, int) from anon, public;

comment on function public.engenharia_salvar_prancha_com_versao(uuid, text, jsonb, int)
  is 'Engenharia: salva prancha atomicamente (snapshot + update). Optimistic concurrency via p_versao_atual. Cap 50 versoes. SECDEF.';

commit;
```

- [ ] **Step 2: Escrever o rollback**

Crie `supabase/migrations/20260528220100_engenharia_pranchas_rollback.sql`:

```sql
-- Rollback de 20260528220000_engenharia_pranchas_fix.sql
begin;
drop function if exists public.engenharia_salvar_prancha_com_versao(uuid, text, jsonb, int);
drop table if exists public.engenharia_pranchas_versoes;
drop table if exists public.engenharia_pranchas;
commit;
```

- [ ] **Step 3: Aplicar no banco**

Aplicar via Supabase MCP `execute_sql` (rode o conteúdo do fix). Se MCP indisponível, peça ao usuário rodar `supabase db push` ou aplique o SQL via service-role/psql. NÃO usar `apply_migration` durante iteração local.

- [ ] **Step 4: Verificar**

Rode via `execute_sql`:
```sql
select count(*) from public.engenharia_pranchas;                       -- 0, sem erro
select proname from pg_proc where proname = 'engenharia_salvar_prancha_com_versao';  -- 1 linha
```
Expected: tabela existe (count 0) e função existe.

- [ ] **Step 5: Rodar advisors**

Run (MCP): `get_advisors security`
Expected: no máximo 1 WARN esperado em `engenharia_salvar_prancha_com_versao` ("Signed-In Users Can Execute SECURITY DEFINER") — comportamento esperado. Sem novos tipos de issue.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260528220000_engenharia_pranchas_fix.sql supabase/migrations/20260528220100_engenharia_pranchas_rollback.sql
git commit -m "feat(engenharia): migration de pranchas (tabelas, RLS, SECDEF salvar com versao)"
```

---

## Task 3: Migration de backfill das chaves de prancha por cargo

**Files:**
- Create: `supabase/migrations/20260528230000_engenharia_backfill_prancha_por_cargo_fix.sql`
- Create: `supabase/migrations/20260528230100_engenharia_backfill_prancha_por_cargo_rollback.sql`

- [ ] **Step 1: Escrever o fix (idempotente, por cargo)**

Crie `supabase/migrations/20260528230000_engenharia_backfill_prancha_por_cargo_fix.sql`:

```sql
-- Backfill das chaves de Prancha em acoes_permitidas, por cargo (idempotente).
-- Mesma lógica do backfill de engenharia (lição: chave nova sem backfill = ninguém acessa).
begin;

-- Administrador + Engenheiro Civil Sênior: criar + editar + excluir
update public.funcionarios
set acoes_permitidas = (
  select array_agg(distinct k) from unnest(
    coalesce(acoes_permitidas, '{}'::text[]) ||
    array['criar_engenharia_prancha','editar_engenharia_prancha','excluir_engenharia_prancha']
  ) as k
)
where cargo in ('Administrador','Engenheiro Civil Sênior');

-- Engenheiro Civil: criar + editar
update public.funcionarios
set acoes_permitidas = (
  select array_agg(distinct k) from unnest(
    coalesce(acoes_permitidas, '{}'::text[]) ||
    array['criar_engenharia_prancha','editar_engenharia_prancha']
  ) as k
)
where cargo = 'Engenheiro Civil';

commit;
```

- [ ] **Step 2: Escrever o rollback**

Crie `supabase/migrations/20260528230100_engenharia_backfill_prancha_por_cargo_rollback.sql`:

```sql
-- Rollback: remove as chaves de prancha de todos (seguro: ninguém as tinha antes).
begin;
update public.funcionarios
set acoes_permitidas = (
  select array_agg(k) from unnest(acoes_permitidas) as k
  where k <> all (array['criar_engenharia_prancha','editar_engenharia_prancha','excluir_engenharia_prancha'])
)
where acoes_permitidas && array['criar_engenharia_prancha','editar_engenharia_prancha','excluir_engenharia_prancha'];
commit;
```

- [ ] **Step 3: Aplicar e verificar**

Aplicar o fix via `execute_sql`. Verificar:
```sql
select nome, cargo,
  acoes_permitidas && array['criar_engenharia_prancha','editar_engenharia_prancha'] as tem_prancha
from public.funcionarios where cargo = 'Administrador';
```
Expected: `tem_prancha = true` para o Administrador (Tiago).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260528230000_engenharia_backfill_prancha_por_cargo_fix.sql supabase/migrations/20260528230100_engenharia_backfill_prancha_por_cargo_rollback.sql
git commit -m "feat(engenharia): backfill das chaves de prancha por cargo"
```

---

## Task 4: Lock hook — adicionar tipo 'prancha'

**Files:**
- Modify: `src/modules/engenharia/hooks/useLockRecurso.ts`

- [ ] **Step 1: Atualizar a assinatura**

Em `useLockRecurso.ts`, troque o tipo do parâmetro `recursoTipo`:

```typescript
export function useLockRecurso(
  recursoTipo: 'nota' | 'calculo' | 'prancha',
  recursoId: string | null,
): EstadoLock {
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc -b`
Expected: 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/modules/engenharia/hooks/useLockRecurso.ts
git commit -m "feat(engenharia): useLockRecurso aceita tipo 'prancha'"
```

---

## Task 5: Tipos + modelo puro da prancha (com Vitest)

**Files:**
- Create: `src/modules/engenharia/types/prancha.ts`
- Create: `src/modules/engenharia/services/pranchaModel.ts`
- Test: `src/modules/engenharia/services/pranchaModel.test.ts`

- [ ] **Step 1: Escrever os tipos**

Crie `src/modules/engenharia/types/prancha.ts`:

```typescript
import type { LinhaCalculo } from './calculo';

export type FormaTipo = 'linha' | 'retangulo' | 'quadrado' | 'circulo';
export type ElementoTipo = 'texto' | 'calculo' | 'forma';

export interface PropsTexto { texto: string }
export interface PropsCalculo { linhas: LinhaCalculo[]; alertaAtivo: boolean }
export interface PropsForma { formaTipo: FormaTipo; cor: string; espessura: number }

export type ElementoProps = PropsTexto | PropsCalculo | PropsForma;

export interface ElementoPrancha {
  id: string;
  tipo: ElementoTipo;
  x: number;
  y: number;
  largura: number;
  altura: number;
  rotacao: number;
  z: number;
  props: ElementoProps;
}

export interface Viewport { x: number; y: number; zoom: number }

export interface DocumentoPrancha {
  viewport: Viewport;
  elementos: ElementoPrancha[];
}

export interface EngenhariaPrancha {
  id: string;
  pastaId: string;
  titulo: string;
  documento: DocumentoPrancha;
  versao: number;
  criadoPor: string | null;
  criadoEm: string;
  atualizadoEm: string;
  deletedAt: string | null;
}

export interface EngenhariaPranchaRow {
  id: string;
  pasta_id: string;
  titulo: string;
  documento_json: DocumentoPrancha;
  versao: number;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
  deleted_at: string | null;
}

export const DOCUMENTO_VAZIO: DocumentoPrancha = { viewport: { x: 0, y: 0, zoom: 1 }, elementos: [] };

export function dbToEngenhariaPrancha(row: EngenhariaPranchaRow): EngenhariaPrancha {
  const doc = row.documento_json;
  return {
    id: row.id,
    pastaId: row.pasta_id,
    titulo: row.titulo,
    documento: doc && Array.isArray(doc.elementos) ? doc : { ...DOCUMENTO_VAZIO },
    versao: row.versao,
    criadoPor: row.criado_por,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
    deletedAt: row.deleted_at,
  };
}

export interface EngenhariaPranchaVersao {
  id: string;
  pranchaId: string;
  versao: number;
  documento: DocumentoPrancha;
  autorId: string | null;
  criadoEm: string;
}

export interface EngenhariaPranchaVersaoRow {
  id: string;
  prancha_id: string;
  versao: number;
  documento_json: DocumentoPrancha;
  autor_id: string | null;
  criado_em: string;
}

export function dbToEngenhariaPranchaVersao(row: EngenhariaPranchaVersaoRow): EngenhariaPranchaVersao {
  return {
    id: row.id,
    pranchaId: row.prancha_id,
    versao: row.versao,
    documento: row.documento_json && Array.isArray(row.documento_json.elementos) ? row.documento_json : { ...DOCUMENTO_VAZIO },
    autorId: row.autor_id,
    criadoEm: row.criado_em,
  };
}
```

- [ ] **Step 2: Escrever o teste falhando do modelo**

Crie `src/modules/engenharia/services/pranchaModel.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { novoElemento, telaParaCanvas } from './pranchaModel';
import type { PropsCalculo, PropsForma } from '../types/prancha';

describe('pranchaModel.novoElemento', () => {
  it('cria caixa de texto vazia com tamanho default', () => {
    const el = novoElemento('texto', 100, 50);
    expect(el.tipo).toBe('texto');
    expect(el.x).toBe(100);
    expect(el.y).toBe(50);
    expect(el.largura).toBeGreaterThan(0);
    expect((el.props as { texto: string }).texto).toBe('');
  });

  it('cria caixa de cálculo com uma linha vazia e alerta ativo', () => {
    const el = novoElemento('calculo', 0, 0);
    const props = el.props as PropsCalculo;
    expect(props.linhas).toHaveLength(1);
    expect(props.alertaAtivo).toBe(true);
  });

  it('cria forma com formaTipo passado em opts', () => {
    const el = novoElemento('forma', 0, 0, { formaTipo: 'circulo' });
    expect((el.props as PropsForma).formaTipo).toBe('circulo');
  });

  it('quadrado nasce com largura igual à altura', () => {
    const el = novoElemento('forma', 0, 0, { formaTipo: 'quadrado' });
    expect(el.largura).toBe(el.altura);
  });
});

describe('pranchaModel.telaParaCanvas', () => {
  it('converte coordenada de tela pra espaço do canvas considerando pan e zoom', () => {
    // viewport com pan (50,20) e zoom 2; rect do canvas na origem
    const ponto = telaParaCanvas(150, 120, { left: 0, top: 0 } as DOMRect, { x: 50, y: 20, zoom: 2 });
    // (clientX - rect.left - pan.x) / zoom = (150 - 0 - 50)/2 = 50
    expect(ponto.x).toBe(50);
    expect(ponto.y).toBe(50); // (120 - 0 - 20)/2 = 50
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/modules/engenharia/services/pranchaModel.test.ts`
Expected: FAIL ("novoElemento is not a function" / módulo não existe).

- [ ] **Step 4: Implementar o modelo**

Crie `src/modules/engenharia/services/pranchaModel.ts`:

```typescript
import { novaLinhaVazia } from '../types/calculo';
import type { ElementoPrancha, ElementoTipo, FormaTipo, Viewport } from '../types/prancha';

const DEFAULTS: Record<ElementoTipo, { largura: number; altura: number }> = {
  texto: { largura: 220, altura: 60 },
  calculo: { largura: 260, altura: 80 },
  forma: { largura: 140, altura: 90 },
};

export interface NovoElementoOpts {
  formaTipo?: FormaTipo;
}

export function novoElemento(tipo: ElementoTipo, x: number, y: number, opts: NovoElementoOpts = {}): ElementoPrancha {
  const base = DEFAULTS[tipo];
  let largura = base.largura;
  let altura = base.altura;
  let props: ElementoPrancha['props'];

  if (tipo === 'texto') {
    props = { texto: '' };
  } else if (tipo === 'calculo') {
    props = { linhas: [novaLinhaVazia(0)], alertaAtivo: true };
  } else {
    const formaTipo = opts.formaTipo ?? 'retangulo';
    if (formaTipo === 'quadrado' || formaTipo === 'circulo') {
      altura = largura; // proporção 1:1
    }
    if (formaTipo === 'linha') {
      altura = 0;
    }
    props = { formaTipo, cor: '#5b8def', espessura: 2 };
  }

  return {
    id: crypto.randomUUID(),
    tipo,
    x,
    y,
    largura,
    altura,
    rotacao: 0,
    z: Date.now(),
    props,
  };
}

/** Converte um ponto da tela (clientX/Y) pro espaço do canvas, considerando pan+zoom. */
export function telaParaCanvas(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top'>,
  viewport: Viewport,
): { x: number; y: number } {
  return {
    x: (clientX - rect.left - viewport.x) / viewport.zoom,
    y: (clientY - rect.top - viewport.y) / viewport.zoom,
  };
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/modules/engenharia/services/pranchaModel.test.ts`
Expected: PASS (6 testes verdes).

- [ ] **Step 6: Commit**

```bash
git add src/modules/engenharia/types/prancha.ts src/modules/engenharia/services/pranchaModel.ts src/modules/engenharia/services/pranchaModel.test.ts
git commit -m "feat(engenharia): tipos e modelo puro da prancha (novoElemento, telaParaCanvas) + testes"
```

---

## Task 6: Hooks de dados (CRUD + salvar RPC + versões)

**Files:**
- Create: `src/modules/engenharia/hooks/useEngenhariaPranchas.ts`
- Create: `src/modules/engenharia/hooks/usePranchaVersoes.ts`

- [ ] **Step 1: Escrever `useEngenhariaPranchas.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  dbToEngenhariaPrancha,
  DOCUMENTO_VAZIO,
  type EngenhariaPrancha,
  type EngenhariaPranchaRow,
  type DocumentoPrancha,
} from '../types/prancha';

const QK_PRANCHA = (id: string) => ['engenharia', 'pranchas', 'item', id] as const;
const QK_PRANCHAS_DA_PASTA = (pastaId: string) => ['engenharia', 'pranchas', 'pasta', pastaId] as const;

export function useEngenhariaPrancha(id: string) {
  return useQuery({
    queryKey: QK_PRANCHA(id),
    queryFn: async (): Promise<EngenhariaPrancha | null> => {
      const { data, error } = await supabase.from('engenharia_pranchas').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? dbToEngenhariaPrancha(data as EngenhariaPranchaRow) : null;
    },
    enabled: !!id,
  });
}

export function usePranchasDaPasta(pastaId: string) {
  return useQuery({
    queryKey: QK_PRANCHAS_DA_PASTA(pastaId),
    queryFn: async (): Promise<EngenhariaPrancha[]> => {
      const { data, error } = await supabase
        .from('engenharia_pranchas')
        .select('*')
        .eq('pasta_id', pastaId)
        .order('atualizado_em', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => dbToEngenhariaPrancha(r as EngenhariaPranchaRow));
    },
    enabled: !!pastaId,
  });
}

export function useCriarPrancha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { pastaId: string; titulo: string }) => {
      const { data, error } = await supabase
        .from('engenharia_pranchas')
        .insert({ pasta_id: input.pastaId, titulo: input.titulo, documento_json: DOCUMENTO_VAZIO })
        .select('*')
        .single();
      if (error) throw error;
      return dbToEngenhariaPrancha(data as EngenhariaPranchaRow);
    },
    onSuccess: (p) => qc.invalidateQueries({ queryKey: QK_PRANCHAS_DA_PASTA(p.pastaId) }),
  });
}

export type SalvarPranchaResult =
  | { ok: true; novaVersao: number }
  | { ok: false; motivo: 'conflito_versao' | 'sem_permissao' | 'prancha_nao_encontrada' | string };

export function useSalvarPrancha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      titulo: string;
      documento: DocumentoPrancha;
      versaoAtual: number;
    }): Promise<SalvarPranchaResult> => {
      const { data, error } = await supabase.rpc('engenharia_salvar_prancha_com_versao', {
        p_prancha_id: input.id,
        p_titulo: input.titulo,
        p_documento_json: input.documento,
        p_versao_atual: input.versaoAtual,
      });
      if (error) return { ok: false, motivo: error.message };
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.ok) return { ok: false, motivo: row?.motivo ?? 'desconhecido' };
      return { ok: true, novaVersao: row.nova_versao };
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: QK_PRANCHA(vars.id) });
      qc.invalidateQueries({ queryKey: ['engenharia', 'pranchas', 'versoes', vars.id] });
    },
  });
}

export function useSoftDeletePrancha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('engenharia_pranchas')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['engenharia', 'pranchas'] }),
  });
}
```

- [ ] **Step 2: Escrever `usePranchaVersoes.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  dbToEngenhariaPranchaVersao,
  type EngenhariaPranchaVersao,
  type EngenhariaPranchaVersaoRow,
} from '../types/prancha';

export function usePranchaVersoes(pranchaId: string) {
  return useQuery({
    queryKey: ['engenharia', 'pranchas', 'versoes', pranchaId],
    queryFn: async (): Promise<EngenhariaPranchaVersao[]> => {
      const { data, error } = await supabase
        .from('engenharia_pranchas_versoes')
        .select('*')
        .eq('prancha_id', pranchaId)
        .order('versao', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => dbToEngenhariaPranchaVersao(r as EngenhariaPranchaVersaoRow));
    },
    enabled: !!pranchaId,
  });
}
```

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc -b`
Expected: 0 erros.

- [ ] **Step 4: Commit**

```bash
git add src/modules/engenharia/hooks/useEngenhariaPranchas.ts src/modules/engenharia/hooks/usePranchaVersoes.ts
git commit -m "feat(engenharia): hooks de dados da prancha (CRUD, salvar RPC, versoes)"
```

---

## Task 7: Componentes de elemento (texto, forma, cálculo)

**Files:**
- Create: `src/modules/engenharia/components/prancha/ElementoTexto.tsx`
- Create: `src/modules/engenharia/components/prancha/ElementoForma.tsx`
- Create: `src/modules/engenharia/components/prancha/ElementoCalculo.tsx`

- [ ] **Step 1: `ElementoTexto.tsx`**

```typescript
import type { PropsTexto } from '../../types/prancha';

interface Props {
  props: PropsTexto;
  readOnly: boolean;
  onChange: (props: PropsTexto) => void;
}

export function ElementoTexto({ props, readOnly, onChange }: Props) {
  return (
    <textarea
      value={props.texto}
      readOnly={readOnly}
      onChange={(e) => onChange({ texto: e.target.value })}
      placeholder="Texto…"
      className="w-full h-full resize-none bg-transparent text-sm text-foreground outline-none p-1"
      data-testid="prancha-texto"
      // impede o react-moveable de roubar o foco/drag ao editar
      onPointerDown={(e) => { if (!readOnly) e.stopPropagation(); }}
    />
  );
}
```

- [ ] **Step 2: `ElementoForma.tsx`**

```typescript
import type { PropsForma } from '../../types/prancha';

interface Props {
  props: PropsForma;
  largura: number;
  altura: number;
}

export function ElementoForma({ props, largura, altura }: Props) {
  const { formaTipo, cor, espessura } = props;
  if (formaTipo === 'linha') {
    return (
      <svg width={largura} height={Math.max(espessura, 4)} style={{ overflow: 'visible' }} data-testid="prancha-forma">
        <line x1={0} y1={espessura} x2={largura} y2={espessura} stroke={cor} strokeWidth={espessura} />
      </svg>
    );
  }
  const raio = formaTipo === 'circulo' ? '50%' : formaTipo === 'retangulo' ? '2px' : '2px';
  return (
    <div
      data-testid="prancha-forma"
      style={{
        width: largura,
        height: altura,
        border: `${espessura}px solid ${cor}`,
        borderRadius: raio,
        boxSizing: 'border-box',
      }}
    />
  );
}
```

- [ ] **Step 3: `ElementoCalculo.tsx` (reusa o motor e o componente LinhaCalculo)**

```typescript
import { useMemo } from 'react';
import { LinhaCalculo as LinhaCalculoComp } from '../LinhaCalculo';
import { recalcularDocumento } from '../../services/calcDocumento';
import { novaLinhaVazia, type LinhaCalculo } from '../../types/calculo';
import type { PropsCalculo } from '../../types/prancha';

interface Props {
  props: PropsCalculo;
  readOnly: boolean;
  onChange: (props: PropsCalculo) => void;
}

export function ElementoCalculo({ props, readOnly, onChange }: Props) {
  const avaliadas = useMemo(() => recalcularDocumento(props.linhas), [props.linhas]);
  const avaliadaPorId = useMemo(() => new Map(avaliadas.map((a) => [a.id, a])), [avaliadas]);

  function handleLinhaChange(atualizada: LinhaCalculo) {
    onChange({ ...props, linhas: props.linhas.map((l) => (l.id === atualizada.id ? atualizada : l)) });
  }
  function handleRevisado(linhaId: string) {
    onChange({ ...props, linhas: props.linhas.map((l) => (l.id === linhaId ? { ...l, alerta: 'revisado' } : l)) });
  }
  function adicionarLinha() {
    onChange({ ...props, linhas: [...props.linhas, novaLinhaVazia(props.linhas.length)] });
  }

  return (
    <div
      className="w-full h-full overflow-auto rounded-md border border-border bg-card p-1 space-y-1"
      data-testid="prancha-calculo"
      onPointerDown={(e) => { if (!readOnly) e.stopPropagation(); }}
    >
      {props.linhas.map((l) => (
        <LinhaCalculoComp
          key={l.id}
          linha={l}
          avaliada={avaliadaPorId.get(l.id)!}
          alertaAtivo={props.alertaAtivo}
          readOnly={readOnly}
          onChange={handleLinhaChange}
          onRevisado={handleRevisado}
          marcadaRevisada={l.alerta === 'revisado'}
        />
      ))}
      {!readOnly && (
        <button onClick={adicionarLinha} className="text-xs text-muted-foreground hover:text-foreground px-1">
          + linha
        </button>
      )}
    </div>
  );
}
```

> Nota: confirme a prop API do componente existente `LinhaCalculo` em `src/modules/engenharia/components/LinhaCalculo.tsx` antes de implementar (props: `linha`, `avaliada`, `alertaAtivo`, `readOnly`, `onChange`, `onRevisado`, `marcadaRevisada`). Ajuste nomes se divergir.

- [ ] **Step 4: Verificar typecheck**

Run: `npx tsc -b`
Expected: 0 erros.

- [ ] **Step 5: Commit**

```bash
git add src/modules/engenharia/components/prancha/
git commit -m "feat(engenharia): componentes de elemento da prancha (texto, forma, calculo reusando motor)"
```

---

## Task 8: Paleta de ferramentas (PranchaToolbar)

**Files:**
- Create: `src/modules/engenharia/components/prancha/PranchaToolbar.tsx`

- [ ] **Step 1: Instalar react-moveable**

Run: `npm install react-moveable`
Expected: adiciona dependência sem erro.

- [ ] **Step 2: Escrever a toolbar**

```typescript
import { MousePointer2, Hand, Type, Calculator, Minus, Square, Circle, Trash2 } from 'lucide-react';

export type Ferramenta =
  | 'selecionar' | 'mao' | 'texto' | 'calculo'
  | 'linha' | 'retangulo' | 'quadrado' | 'circulo';

const TOOLS: { id: Ferramenta; label: string; Icon: typeof Type }[] = [
  { id: 'selecionar', label: 'Selecionar', Icon: MousePointer2 },
  { id: 'mao', label: 'Mão', Icon: Hand },
  { id: 'texto', label: 'Texto', Icon: Type },
  { id: 'calculo', label: 'Cálculo', Icon: Calculator },
  { id: 'linha', label: 'Linha', Icon: Minus },
  { id: 'retangulo', label: 'Retângulo', Icon: Square },
  { id: 'quadrado', label: 'Quadrado', Icon: Square },
  { id: 'circulo', label: 'Círculo', Icon: Circle },
];

interface Props {
  ativa: Ferramenta;
  onSelecionar: (f: Ferramenta) => void;
  onApagar: () => void;
  podeApagar: boolean;
  disabled: boolean;
}

export function PranchaToolbar({ ativa, onSelecionar, onApagar, podeApagar, disabled }: Props) {
  return (
    <div className="w-[88px] shrink-0 border-r border-border bg-card flex flex-col gap-1 p-2">
      <span className="text-[10px] uppercase text-muted-foreground text-center mb-1">Ferramentas</span>
      {TOOLS.map(({ id, label, Icon }) => (
        <button
          key={id}
          disabled={disabled}
          data-testid={`tool-${id}`}
          onClick={() => onSelecionar(id)}
          className={`flex flex-col items-center gap-1 rounded-md py-2 text-[11px] ${
            ativa === id ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent'
          } disabled:opacity-40`}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
      <div className="mt-auto pt-2 border-t border-border">
        <button
          disabled={disabled || !podeApagar}
          data-testid="tool-apagar"
          onClick={onApagar}
          className="w-full flex flex-col items-center gap-1 rounded-md py-2 text-[11px] text-destructive hover:bg-destructive/10 disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" />
          Apagar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc -b`
Expected: 0 erros.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/modules/engenharia/components/prancha/PranchaToolbar.tsx
git commit -m "feat(engenharia): paleta de ferramentas da prancha + react-moveable"
```

---

## Task 9: O quadro (PranchaCanvas)

**Files:**
- Create: `src/modules/engenharia/components/prancha/PranchaCanvas.tsx`

- [ ] **Step 1: Escrever o canvas**

```typescript
import { useRef, useState, useCallback } from 'react';
import Moveable from 'react-moveable';
import { PranchaToolbar, type Ferramenta } from './PranchaToolbar';
import { ElementoTexto } from './ElementoTexto';
import { ElementoForma } from './ElementoForma';
import { ElementoCalculo } from './ElementoCalculo';
import { novoElemento, telaParaCanvas } from '../../services/pranchaModel';
import type {
  DocumentoPrancha, ElementoPrancha, FormaTipo,
  PropsTexto, PropsCalculo, PropsForma,
} from '../../types/prancha';

const FORMAS: Record<string, FormaTipo> = {
  linha: 'linha', retangulo: 'retangulo', quadrado: 'quadrado', circulo: 'circulo',
};

interface Props {
  documento: DocumentoPrancha;
  readOnly: boolean;
  onChange: (doc: DocumentoPrancha) => void;
}

export function PranchaCanvas({ documento, readOnly, onChange }: Props) {
  const [ferramenta, setFerramenta] = useState<Ferramenta>('selecionar');
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const elementoRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const { viewport, elementos } = documento;

  const setElementos = useCallback((novos: ElementoPrancha[]) => {
    onChange({ ...documento, elementos: novos });
  }, [documento, onChange]);

  const atualizarElemento = useCallback((id: string, patch: Partial<ElementoPrancha>) => {
    setElementos(elementos.map((el) => (el.id === id ? { ...el, ...patch } : el)));
  }, [elementos, setElementos]);

  function handleCanvasClick(e: React.MouseEvent) {
    if (readOnly) return;
    if (ferramenta === 'selecionar' || ferramenta === 'mao') {
      if (e.target === canvasRef.current) setSelecionadoId(null);
      return;
    }
    const rect = canvasRef.current!.getBoundingClientRect();
    const { x, y } = telaParaCanvas(e.clientX, e.clientY, rect, viewport);
    let el: ElementoPrancha;
    if (ferramenta === 'texto') el = novoElemento('texto', x, y);
    else if (ferramenta === 'calculo') el = novoElemento('calculo', x, y);
    else el = novoElemento('forma', x, y, { formaTipo: FORMAS[ferramenta] });
    setElementos([...elementos, el]);
    setSelecionadoId(el.id);
    setFerramenta('selecionar'); // volta pro modo seleção após criar
  }

  function apagarSelecionado() {
    if (!selecionadoId) return;
    setElementos(elementos.filter((el) => el.id !== selecionadoId));
    setSelecionadoId(null);
  }

  function renderProps(el: ElementoPrancha) {
    const onPropsChange = (props: ElementoPrancha['props']) => atualizarElemento(el.id, { props });
    if (el.tipo === 'texto') return <ElementoTexto props={el.props as PropsTexto} readOnly={readOnly} onChange={onPropsChange} />;
    if (el.tipo === 'calculo') return <ElementoCalculo props={el.props as PropsCalculo} readOnly={readOnly} onChange={onPropsChange} />;
    return <ElementoForma props={el.props as PropsForma} largura={el.largura} altura={el.altura} />;
  }

  const selecionado = elementos.find((el) => el.id === selecionadoId) ?? null;

  return (
    <div className="flex flex-1 min-h-0">
      <PranchaToolbar
        ativa={ferramenta}
        onSelecionar={setFerramenta}
        onApagar={apagarSelecionado}
        podeApagar={!!selecionadoId}
        disabled={readOnly}
      />
      <div
        ref={canvasRef}
        onClick={handleCanvasClick}
        data-testid="prancha-canvas"
        className="relative flex-1 overflow-hidden bg-background"
        style={{
          cursor: ferramenta === 'selecionar' ? 'default' : ferramenta === 'mao' ? 'grab' : 'crosshair',
          backgroundImage: 'radial-gradient(var(--color-border) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      >
        <div style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`, transformOrigin: '0 0' }}>
          {elementos.map((el) => (
            <div
              key={el.id}
              ref={(node) => { if (node) elementoRefs.current.set(el.id, node); else elementoRefs.current.delete(el.id); }}
              onClick={(e) => { e.stopPropagation(); if (ferramenta === 'selecionar') setSelecionadoId(el.id); }}
              style={{
                position: 'absolute',
                left: el.x, top: el.y, width: el.largura, height: el.altura,
                transform: `rotate(${el.rotacao}deg)`,
                outline: el.id === selecionadoId ? '1px solid var(--color-primary, #2563eb)' : 'none',
              }}
            >
              {renderProps(el)}
            </div>
          ))}
        </div>

        {!readOnly && selecionado && (
          <Moveable
            target={elementoRefs.current.get(selecionado.id) ?? null}
            draggable
            resizable
            rotatable
            throttleDrag={0}
            onDrag={({ left, top }) => atualizarElemento(selecionado.id, { x: left / viewport.zoom, y: top / viewport.zoom })}
            onResize={({ width, height, drag }) => atualizarElemento(selecionado.id, {
              largura: width / viewport.zoom,
              altura: height / viewport.zoom,
              x: drag.left / viewport.zoom,
              y: drag.top / viewport.zoom,
            })}
            onRotate={({ beforeRotation }) => atualizarElemento(selecionado.id, { rotacao: beforeRotation })}
          />
        )}
      </div>
    </div>
  );
}
```

> Nota de implementação: o `Moveable` usa coordenadas relativas ao elemento alvo no DOM. Como o canvas tem zoom via `transform: scale`, divida `left/top/width/height` pelo `zoom` ao gravar no estado (feito acima). Na v1 mantenha `zoom` em 1 (sem UI de zoom ainda); a divisão deixa pronto para quando o zoom entrar. Pan/zoom interativos entram como refinamento — a v1 pode deixar `viewport` fixo.

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc -b`
Expected: 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/modules/engenharia/components/prancha/PranchaCanvas.tsx
git commit -m "feat(engenharia): PranchaCanvas (pega-ferramenta, criar/selecionar/mover/redimensionar via react-moveable)"
```

---

## Task 10: Página da Prancha (lock + autosave + Cmd+S + conflito)

**Files:**
- Create: `src/modules/engenharia/pages/PranchaPage.tsx`

- [ ] **Step 1: Escrever a página**

```typescript
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { Skeleton } from '@/components/shadcn/skeleton';
import { Input } from '@/components/shadcn/input';
import { useAuth } from '@/contexts/AuthContext';
import { useLockRecurso } from '../hooks/useLockRecurso';
import { useEngenhariaPrancha, useSalvarPrancha } from '../hooks/useEngenhariaPranchas';
import { LockBanner } from '../components/LockBanner';
import { PranchaCanvas } from '../components/prancha/PranchaCanvas';
import { DOCUMENTO_VAZIO, type DocumentoPrancha, type EngenhariaPrancha } from '../types/prancha';

const AUTO_SAVE_DEBOUNCE_MS = 5_000;

export default function PranchaPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { temAcao } = useAuth();
  const qc = useQueryClient();

  const [titulo, setTitulo] = useState('');
  const [documento, setDocumento] = useState<DocumentoPrancha>(DOCUMENTO_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [erroEhConflito, setErroEhConflito] = useState(false);
  const dirtyRef = useRef(false);
  const debounceRef = useRef<number | null>(null);

  const lock = useLockRecurso('prancha', id ?? null);
  const { data: prancha, isLoading } = useEngenhariaPrancha(id ?? '');
  const salvarMutation = useSalvarPrancha();

  const ehDono = lock.status === 'meu';
  const readOnly = !temAcao('editar_engenharia_prancha') || !ehDono;

  useEffect(() => {
    if (prancha) {
      setTitulo(prancha.titulo);
      setDocumento(prancha.documento);
      dirtyRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prancha?.id]);

  const salvar = useCallback(async () => {
    if (!prancha || readOnly || salvando) return;
    setSalvando(true);
    setErroSalvar(null);
    setErroEhConflito(false);
    try {
      const result = await salvarMutation.mutateAsync({
        id: prancha.id, titulo, documento, versaoAtual: prancha.versao,
      });
      if (!result.ok) {
        const conflito = result.motivo === 'conflito_versao';
        setErroEhConflito(conflito);
        setErroSalvar(conflito
          ? 'Outro usuário salvou no meio. Recarregue para ver as mudanças.'
          : `Falha ao salvar: ${result.motivo}`);
      } else {
        dirtyRef.current = false;
      }
    } catch (e) {
      setErroSalvar(`Falha ao salvar: ${e instanceof Error ? e.message : 'erro desconhecido'}`);
    } finally {
      setSalvando(false);
    }
  }, [prancha, readOnly, salvando, salvarMutation, titulo, documento]);

  useEffect(() => {
    if (!dirtyRef.current || readOnly) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => { void salvar(); }, AUTO_SAVE_DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [titulo, documento, readOnly, salvar]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        if (readOnly) return;
        e.preventDefault();
        void salvar();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [salvar, readOnly]);

  function handleDocChange(doc: DocumentoPrancha) {
    setDocumento(doc);
    dirtyRef.current = true;
  }

  async function handleRecarregar() {
    if (!id) return;
    await qc.refetchQueries({ queryKey: ['engenharia', 'pranchas', 'item', id] });
    const fresh = qc.getQueryData<EngenhariaPrancha>(['engenharia', 'pranchas', 'item', id]);
    if (fresh) { setTitulo(fresh.titulo); setDocumento(fresh.documento); dirtyRef.current = false; }
    setErroSalvar(null);
    setErroEhConflito(false);
  }

  if (isLoading || !prancha || !id) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[70vh] w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center gap-3 border-b border-border px-4 py-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input
          value={titulo}
          onChange={(e) => { setTitulo(e.target.value); dirtyRef.current = true; }}
          disabled={readOnly}
          className="text-lg font-medium border-none shadow-none focus-visible:ring-0 px-2"
          placeholder="Título da prancha"
        />
        <Button size="sm" variant="outline" disabled={readOnly || salvando} onClick={() => void salvar()}>
          <Save className="h-4 w-4 mr-1" /> Salvar
        </Button>
        <span aria-live="polite" className="text-xs text-muted-foreground min-w-[60px] text-right">
          {salvando ? 'Salvando…' : (!dirtyRef.current ? 'Salvo' : '')}
        </span>
      </header>

      <LockBanner estado={lock} />

      {erroSalvar && (
        <div className="flex items-center gap-3 bg-destructive/10 text-destructive px-4 py-2 text-sm">
          <span className="flex-1">{erroSalvar}</span>
          {erroEhConflito && <Button size="xs" variant="outline" onClick={handleRecarregar}>Recarregar</Button>}
        </div>
      )}

      <PranchaCanvas documento={documento} readOnly={readOnly} onChange={handleDocChange} />
    </div>
  );
}
```

> Nota: `LockBanner` aceita `onForcarLiberacao` opcional (ver `CalculoPage`). Na v1 a prancha omite o botão de forçar liberação (refinamento). Se o `LockBanner` exigir a prop, passe `undefined`.

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc -b`
Expected: 0 erros.

- [ ] **Step 3: Commit**

```bash
git add src/modules/engenharia/pages/PranchaPage.tsx
git commit -m "feat(engenharia): PranchaPage (lock, autosave, Cmd+S, conflito de versao)"
```

---

## Task 11: Rota + item "Novo > Prancha" na pasta

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/modules/engenharia/pages/PastaPage.tsx`

- [ ] **Step 1: Registrar a rota lazy no App.tsx**

Junto dos outros lazy imports de engenharia:
```typescript
const PranchaEngenhariaPage = lazy(() => import('./modules/engenharia/pages/PranchaPage'));
```
Junto da rota `/engenharia/calculo/:id`, adicione:
```typescript
<Route
  path="/engenharia/prancha/:id"
  element={
    <ProtectedRoute acao="ver_engenharia">
      <Suspense fallback={<div className="p-8 text-center text-[var(--color-fg-muted)]">Carregando…</div>}>
        <PranchaEngenhariaPage />
      </Suspense>
    </ProtectedRoute>
  }
/>
```

- [ ] **Step 2: Adicionar item no dropdown "Novo" da PastaPage**

Importe o hook e um ícone:
```typescript
import { useCriarPrancha } from '../hooks/useEngenhariaPranchas';
import { LayoutDashboard } from 'lucide-react';
```
Declare a mutation perto das outras (`const criarPrancha = useCriarPrancha();`). Adicione o item logo após o de Cálculo:
```typescript
{temAcao('criar_engenharia_prancha') && (
  <DropdownMenuItem
    disabled={criarPrancha.isPending}
    onClick={async () => {
      try {
        const p = await criarPrancha.mutateAsync({ pastaId: pasta.id, titulo: 'Nova prancha' });
        navigate(`/engenharia/prancha/${p.id}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'erro desconhecido';
        showToast({ kind: 'error', message: `Falha ao criar prancha: ${msg}` });
      }
    }}
  >
    <LayoutDashboard className="mr-2 h-4 w-4" /> Prancha
  </DropdownMenuItem>
)}
```

- [ ] **Step 3: Verificar typecheck + build**

Run: `npx tsc -b && npm run build`
Expected: 0 erros; chunk lazy de PranchaPage gerado.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/modules/engenharia/pages/PastaPage.tsx
git commit -m "feat(engenharia): rota /engenharia/prancha/:id + item Novo>Prancha na pasta"
```

---

## Task 12: Teste E2E (Playwright)

**Files:**
- Create: `tests/engenharia-prancha.spec.ts`

- [ ] **Step 1: Escrever o spec**

Espelhe a estrutura de `tests/engenharia-calculos.spec.ts` (login/helpers). Cenários:

```typescript
import { test, expect } from '@playwright/test';
// reutilize os helpers de login/navegação do tests/engenharia-calculos.spec.ts

test.describe('Engenharia — Prancha', () => {
  test('cria prancha, solta caixa de texto e cálculo, desenha retângulo, salva e reabre', async ({ page }) => {
    // 1. login + navegar até uma pasta de engenharia (copiar do spec de cálculos)
    // 2. abrir dropdown "Novo" e clicar em "Prancha" -> espera rota /engenharia/prancha/
    await expect(page).toHaveURL(/\/engenharia\/prancha\//);

    // 3. ferramenta Texto -> clicar no canvas -> aparece caixa de texto
    await page.getByTestId('tool-texto').click();
    await page.getByTestId('prancha-canvas').click({ position: { x: 120, y: 100 } });
    await expect(page.getByTestId('prancha-texto')).toBeVisible();
    await page.getByTestId('prancha-texto').fill('Viga V1');

    // 4. ferramenta Cálculo -> clicar -> digitar 2*5=11 -> alerta de erro
    await page.getByTestId('tool-calculo').click();
    await page.getByTestId('prancha-canvas').click({ position: { x: 120, y: 240 } });
    const inputCalc = page.getByTestId('prancha-calculo').getByRole('textbox').first();
    await inputCalc.fill('2*5=11');
    await inputCalc.blur();
    await expect(page.getByTestId('prancha-calculo')).toContainText(/10|erro|⚠/i);

    // 5. ferramenta Retângulo -> clicar -> aparece forma
    await page.getByTestId('tool-retangulo').click();
    await page.getByTestId('prancha-canvas').click({ position: { x: 380, y: 120 } });
    await expect(page.getByTestId('prancha-forma').first()).toBeVisible();

    // 6. salvar (Cmd+S ou botão Salvar) -> status "Salvo"
    await page.getByRole('button', { name: /salvar/i }).click();
    await expect(page.getByText('Salvo')).toBeVisible();

    // 7. recarregar a página -> os 3 elementos persistem
    await page.reload();
    await expect(page.getByTestId('prancha-texto')).toBeVisible();
    await expect(page.getByTestId('prancha-calculo')).toBeVisible();
    await expect(page.getByTestId('prancha-forma').first()).toBeVisible();
  });
});
```

> Ao implementar, copie o bloco de setup/login/seleção-de-pasta verbatim de `tests/engenharia-calculos.spec.ts` para garantir o mesmo fluxo de autenticação e criação de pasta de teste.

- [ ] **Step 2: Rodar o E2E**

Run: `npx playwright test tests/engenharia-prancha.spec.ts`
Expected: 1 cenário verde (dev server rodando ou conforme `playwright.config.ts`).

- [ ] **Step 3: Commit**

```bash
git add tests/engenharia-prancha.spec.ts
git commit -m "test(engenharia): E2E da prancha (criar, texto, calculo com alerta, forma, salvar, reabrir)"
```

---

## Task 13: Verificação final + CHANGELOG

**Files:**
- Modify: `docs/modulos/engenharia/CHANGELOG.md`

- [ ] **Step 1: Rodar a verificação completa**

Run:
```bash
npx tsc -b
npx vitest run src/modules/engenharia/ src/utils/permissions.test.ts
npm run build
```
Expected: tsc 0 erros; Vitest do módulo + permissões todos verdes; build gera o chunk lazy da Prancha.

- [ ] **Step 2: Escrever a entrada no CHANGELOG**

Adicione no topo de `docs/modulos/engenharia/CHANGELOG.md` uma seção "## Onda Prancha v1 (2026-XX-XX)" resumindo: tabelas `engenharia_pranchas` (+versões), SECDEF salvar, 3 chaves de permissão + backfill, canvas DIY (react-moveable), elementos texto/cálculo/forma, rota e item Novo>Prancha, testes (Vitest do modelo + Playwright). Liste libs novas (`react-moveable`) e a verificação.

- [ ] **Step 3: Commit**

```bash
git add docs/modulos/engenharia/CHANGELOG.md
git commit -m "docs(engenharia): CHANGELOG da Prancha v1"
```

---

## Notas finais

- **Fora da v1 (refinamento/próximas ondas):** pan/zoom interativo, undo/redo, snap à grade, histórico de versões na UI (drawer), variável compartilhada da prancha, e tudo das fases P2-P5 da spec (mini-planilha, conversor, templates de cálculo, cota com escala, seção de pavimento, régua de km).
- **Padrões reusados:** lock (`useLockRecurso`), versionamento SECDEF, RLS per-command, soft-delete, motor de cálculo (`recalcularDocumento` + `LinhaCalculo`).
- **Sempre que adicionar chave de ação nova: migration de backfill por cargo** (Task 3 é o modelo).
