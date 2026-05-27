# Engenharia Onda 4 — Bloco de Nota (Tiptap + lock pessimista)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rota `/engenharia/nota/:id` com editor rich-text (Tiptap) fullscreen + lock pessimista (1 editor por vez via `engenharia_acquire_lock` da Onda 1) + auto-save com versionamento atômico + painel de histórico com diff textual + paste de imagem do clipboard.

**Architecture:** 1 function SECDEF que atomiza "save com nova versão" no DB. Hook `useLockRecurso` genérico (reusado pela Onda 6 em cálculo) faz acquire + heartbeat 60s + release. NotaPage compõe Tiptap + LockBanner + Toolbar + Histórico. Image paste delega ao `arquivosService` da Onda 2 (gera URL inline). Diff usa `diff@9` para 2-pane textual (sem visual diff — refinamento futuro).

**Tech Stack:** Tiptap 3.23 (`@tiptap/react`, `@tiptap/starter-kit`, extensões `Image`, `Link`, `Table`, `TextAlign`, `Highlight`, `TaskList`), `diff@^9`, react-hook-form opcional pro título.

**Spec:** Master plan [`2026-05-26-engenharia-modulo.md`](2026-05-26-engenharia-modulo.md) seção 7 Onda 4 (revisada D-4: lock pessimista).

**Dependências:**
- Onda 1: tabelas `engenharia_notas`/`engenharia_notas_versoes`/`engenharia_locks`, função `engenharia_acquire_lock`/`engenharia_release_lock`, chaves `criar/editar/excluir_engenharia_nota`, `ver_historico_engenharia`, `gerenciar_locks_engenharia`.
- Onda 2: `arquivosService.uploadArquivo` (pra paste de imagem) + `getSignedUrl`.
- Onda 3: rotas `/engenharia/*` lazy-loaded, `useAuth().temAcao`, padrões shadcn + design tokens.

---

## File Structure

**Create:**
- `supabase/migrations/20260528100000_engenharia_salvar_nota_com_versao_fix.sql` — function SECDEF que atomiza save+version.
- `supabase/migrations/20260528100100_engenharia_salvar_nota_com_versao_rollback.sql`.
- `src/modules/engenharia/types/nota.ts` — `EngenhariaNota`, `EngenhariaNotaVersao` + mappers.
- `src/modules/engenharia/hooks/useLockRecurso.ts` — hook genérico (nota OU calculo).
- `src/modules/engenharia/hooks/useLockRecurso.test.ts` — Vitest com mock supabase.
- `src/modules/engenharia/hooks/useEngenhariaNotas.ts` — `useEngenhariaNota`, `useCriarNota`, `useSalvarNota`, `useSoftDeleteNota`.
- `src/modules/engenharia/hooks/useNotaVersoes.ts` — `useNotaVersoes` + `useRestaurarVersao`.
- `src/modules/engenharia/components/LockBanner.tsx` — banner amarelo "Em uso por X".
- `src/modules/engenharia/components/NotaToolbar.tsx` — toolbar fixa Tiptap.
- `src/modules/engenharia/components/NotaEditor.tsx` — Tiptap editor + paste de imagem.
- `src/modules/engenharia/components/HistoricoVersoesDrawer.tsx` — Sheet shadcn + lista + restaurar.
- `src/modules/engenharia/pages/NotaPage.tsx` — `/engenharia/nota/:id`.

**Modify:**
- `src/App.tsx` — lazy route `/engenharia/nota/:id`.
- `src/modules/engenharia/pages/PastaPage.tsx` — botão "Nota" no dropdown "Novo" passa de `disabled` para `criarNota → navigate`.

**Tests:**
- `src/modules/engenharia/hooks/useLockRecurso.test.ts` (Vitest, novo).
- `tests/engenharia-notas.spec.ts` — Playwright E2E (5 cenários).

---

## Task 1: Function SECDEF `engenharia_salvar_nota_com_versao`

**Files:**
- Create: `supabase/migrations/20260528100000_engenharia_salvar_nota_com_versao_fix.sql`
- Create: `supabase/migrations/20260528100100_engenharia_salvar_nota_com_versao_rollback.sql`

**Por quê:** save da nota envolve 2 statements (INSERT versão + UPDATE nota). Sem function transacional, há janela de race: se UPDATE falhar depois do INSERT, fica versão duplicada. Function executa ambos numa BEGIN/COMMIT implícito (function plpgsql sempre é tx única).

Também: validação de optimistic-concurrency via `p_versao_atual`: se cliente envia v=3 mas o DB já está em v=4, função rejeita (alguém salvou no meio).

- [ ] **Step 1: Escrever `_fix.sql`**

```sql
-- Engenharia — Onda 4.1: function SECDEF que salva nota + cria versão (atômico).
-- Spec: docs/superpowers/plans/2026-05-27-engenharia-onda-4-bloco-nota.md.
-- Rollback: 20260528100100_engenharia_salvar_nota_com_versao_rollback.sql.

begin;

create or replace function public.engenharia_salvar_nota_com_versao(
  p_nota_id uuid,
  p_titulo text,
  p_conteudo_json jsonb,
  p_versao_atual int
)
returns table (
  ok boolean,
  nova_versao int,
  motivo text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_versao_db int;
  v_conteudo_db jsonb;
begin
  -- Gate: precisa de permissão pra editar nota
  if not private.current_has_action('editar_engenharia_nota') then
    return query select false, null::int, 'sem_permissao';
    return;
  end if;

  -- Lock optimistic check + leitura do estado atual
  select versao, conteudo_json into v_versao_db, v_conteudo_db
    from public.engenharia_notas
   where id = p_nota_id and deleted_at is null
   for update;

  if not found then
    return query select false, null::int, 'nota_nao_encontrada';
    return;
  end if;

  if v_versao_db <> p_versao_atual then
    -- Conflito: alguém salvou entre o load do cliente e este save
    return query select false, v_versao_db, 'conflito_versao';
    return;
  end if;

  -- Snapshot da versão antiga em engenharia_notas_versoes
  insert into public.engenharia_notas_versoes (nota_id, versao, conteudo_json, autor_id)
  values (p_nota_id, v_versao_db, v_conteudo_db, v_user);

  -- Update nota com novo conteúdo e versão incrementada
  update public.engenharia_notas
     set titulo = p_titulo,
         conteudo_json = p_conteudo_json,
         versao = v_versao_db + 1,
         atualizado_em = now()
   where id = p_nota_id;

  -- Limpa versões antigas além das 50 mais recentes (cap conforme D-9 default)
  delete from public.engenharia_notas_versoes
   where nota_id = p_nota_id
     and id not in (
       select id from public.engenharia_notas_versoes
        where nota_id = p_nota_id
        order by versao desc
        limit 50
     );

  return query select true, v_versao_db + 1, ''::text;
end $$;

grant execute on function public.engenharia_salvar_nota_com_versao(uuid, text, jsonb, int) to authenticated;
revoke execute on function public.engenharia_salvar_nota_com_versao(uuid, text, jsonb, int) from anon, public;

comment on function public.engenharia_salvar_nota_com_versao(uuid, text, jsonb, int)
  is 'Engenharia: salva nota atomicamente (snapshot da versao antiga + update). Optimistic concurrency via p_versao_atual. Cap 50 versoes. SECDEF.';

commit;
```

- [ ] **Step 2: Escrever `_rollback.sql`**

```sql
-- Rollback de 20260528100000_engenharia_salvar_nota_com_versao_fix.sql

begin;

drop function if exists public.engenharia_salvar_nota_com_versao(uuid, text, jsonb, int);

commit;
```

- [ ] **Step 3: User confirma + apply via MCP**

- [ ] **Step 4: Smoke test via `execute_sql`**

```sql
do $$
declare
  v_pasta uuid;
  v_nota uuid;
  v_result record;
begin
  -- Setup: cria pasta + nota
  insert into public.engenharia_pastas (nome, tipo, caminho)
  values ('Test Onda 4', 'avulsa', '/test-onda-4') returning id into v_pasta;

  insert into public.engenharia_notas (pasta_id, titulo, conteudo_json, versao)
  values (v_pasta, 'Nota Teste', '{"type":"doc"}'::jsonb, 1) returning id into v_nota;

  -- 1) Save com versão correta → ok
  select * into v_result from public.engenharia_salvar_nota_com_versao(
    v_nota, 'Nota Renomeada', '{"type":"doc","content":[]}'::jsonb, 1
  );
  if not v_result.ok or v_result.nova_versao <> 2 then
    raise exception 'FAIL save v1: ok=% nova=% motivo=%', v_result.ok, v_result.nova_versao, v_result.motivo;
  end if;
  raise notice 'OK 1: save com versao 1 → nova=2';

  -- 2) Save com versão errada → conflito
  select * into v_result from public.engenharia_salvar_nota_com_versao(
    v_nota, 'Outra', '{"type":"doc"}'::jsonb, 1
  );
  if v_result.ok then raise exception 'FAIL: conflito nao detectado'; end if;
  if v_result.motivo <> 'conflito_versao' then
    raise exception 'FAIL motivo errado: %', v_result.motivo;
  end if;
  raise notice 'OK 2: conflito v1 vs v2 detectado';

  -- 3) Confere que versao 1 foi snapshotada
  if not exists (
    select 1 from public.engenharia_notas_versoes
     where nota_id = v_nota and versao = 1
  ) then raise exception 'FAIL: snapshot da v1 nao gerado'; end if;
  raise notice 'OK 3: snapshot v1 presente';

  -- Cleanup
  delete from public.engenharia_pastas where id = v_pasta;
  raise notice 'OK 4: cleanup OK';
end $$;
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260528100000_* supabase/migrations/20260528100100_*
git commit -m "feat(engenharia): function SECDEF engenharia_salvar_nota_com_versao (atomico)

Resolve race entre INSERT version e UPDATE nota (ambos numa funcao transacional).
Optimistic concurrency via p_versao_atual: rejeita se db ja avancou (conflito_versao).
Cap 50 versoes (D-9): delete versoes antigas alem das 50 mais recentes.

GRANT EXECUTE to authenticated; REVOKE from anon/public.

Smoke test SQL: 3 cenarios passaram."
```

---

## Task 2: Instalar libs Tiptap + diff

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install**

```bash
cd /Users/tiagocameli/projects/Gestao_Obras
npm install \
  @tiptap/react@^3.23.6 \
  @tiptap/starter-kit@^3.23.6 \
  @tiptap/extension-image@^3.23.6 \
  @tiptap/extension-link@^3.23.6 \
  @tiptap/extension-table@^3.23.6 \
  @tiptap/extension-table-row@^3.23.6 \
  @tiptap/extension-table-header@^3.23.6 \
  @tiptap/extension-table-cell@^3.23.6 \
  @tiptap/extension-text-align@^3.23.6 \
  @tiptap/extension-highlight@^3.23.6 \
  @tiptap/extension-task-list@^3.23.6 \
  @tiptap/extension-task-item@^3.23.6 \
  diff@^9.0.0
```

- [ ] **Step 2: Verificar instalação**

```bash
node -e "console.log('tiptap:', require('./node_modules/@tiptap/react/package.json').version)"
node -e "console.log('diff:', require('./node_modules/diff/package.json').version)"
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(engenharia): adiciona Tiptap 3.23 + extensoes + diff@9

12 packages Tiptap (starter-kit + extensoes para image/link/table/text-align/
highlight/task-list/task-item) + diff@9 (histórico textual). Aprovado em bloco D-8."
```

---

## Task 3: Tipos + mapper de Nota

**Files:**
- Create: `src/modules/engenharia/types/nota.ts`

- [ ] **Step 1: Implementar**

```ts
export interface EngenhariaNota {
  id: string;
  pastaId: string;
  titulo: string;
  conteudoJson: unknown;  // Documento Tiptap (JSONContent do ProseMirror)
  versao: number;
  criadoPor: string | null;
  criadoEm: string;
  atualizadoEm: string;
  deletedAt: string | null;
}

export interface EngenhariaNotaRow {
  id: string;
  pasta_id: string;
  titulo: string;
  conteudo_json: unknown;
  versao: number;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
  deleted_at: string | null;
}

export function dbToEngenhariaNota(row: EngenhariaNotaRow): EngenhariaNota {
  return {
    id: row.id,
    pastaId: row.pasta_id,
    titulo: row.titulo,
    conteudoJson: row.conteudo_json,
    versao: row.versao,
    criadoPor: row.criado_por,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
    deletedAt: row.deleted_at,
  };
}

export interface EngenhariaNotaVersao {
  id: string;
  notaId: string;
  versao: number;
  conteudoJson: unknown;
  autorId: string | null;
  criadoEm: string;
}

export interface EngenhariaNotaVersaoRow {
  id: string;
  nota_id: string;
  versao: number;
  conteudo_json: unknown;
  autor_id: string | null;
  criado_em: string;
}

export function dbToEngenhariaNotaVersao(row: EngenhariaNotaVersaoRow): EngenhariaNotaVersao {
  return {
    id: row.id,
    notaId: row.nota_id,
    versao: row.versao,
    conteudoJson: row.conteudo_json,
    autorId: row.autor_id,
    criadoEm: row.criado_em,
  };
}
```

- [ ] **Step 2: Build + commit**

```bash
npx tsc -b
git add src/modules/engenharia/types/nota.ts
git commit -m "feat(engenharia): tipos EngenhariaNota + EngenhariaNotaVersao + mappers"
```

---

## Task 4: Hook `useLockRecurso` (genérico)

**Files:**
- Create: `src/modules/engenharia/hooks/useLockRecurso.ts`
- Create: `src/modules/engenharia/hooks/useLockRecurso.test.ts`

> Será reusado na Onda 6 (cálculo) — por isso é genérico (`tipo: 'nota' | 'calculo'`).

- [ ] **Step 1: Implementar `useLockRecurso.ts`**

```ts
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

const TTL_SEGUNDOS = 300;        // 5 min — alinhado com função SQL
const HEARTBEAT_MS = 60_000;      // renova a cada 1 min
const POLL_QUANDO_BLOQUEADO_MS = 15_000;  // tenta readquirir a cada 15s

export type EstadoLock =
  | { status: 'carregando' }
  | { status: 'meu'; expiraEm: string }
  | { status: 'outro'; donoUsuarioId: string; expiraEm: string }
  | { status: 'erro'; motivo: string };

/**
 * Adquire ou renova lock pessimista em uma nota/cálculo.
 * - Faz acquire ao montar.
 * - Heartbeat a cada 60s enquanto for dono (renova TTL pra 5 min).
 * - Polling 15s quando NÃO é dono (tenta readquirir).
 * - Release ao desmontar + beforeunload (best-effort via sendBeacon? — não, RPC é POST normal).
 */
export function useLockRecurso(
  recursoTipo: 'nota' | 'calculo',
  recursoId: string | null,
): EstadoLock {
  const [estado, setEstado] = useState<EstadoLock>({ status: 'carregando' });
  const heartbeatRef = useRef<number | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!recursoId) return;
    let cancelado = false;

    async function acquire() {
      const { data, error } = await supabase.rpc('engenharia_acquire_lock', {
        p_recurso_tipo: recursoTipo,
        p_recurso_id: recursoId,
        p_ttl_segundos: TTL_SEGUNDOS,
      });
      if (cancelado) return;
      if (error) {
        setEstado({ status: 'erro', motivo: error.message });
        return;
      }
      // RPC retorna setof — pegamos primeiro row
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        setEstado({ status: 'erro', motivo: 'sem retorno' });
        return;
      }

      if (row.adquirido) {
        setEstado({ status: 'meu', expiraEm: row.expira_em });
        // Limpa poll se estava ativo; agenda heartbeat
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = window.setInterval(() => { void acquire(); }, HEARTBEAT_MS);
      } else {
        setEstado({
          status: 'outro',
          donoUsuarioId: row.dono_usuario_id,
          expiraEm: row.expira_em,
        });
        if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
        if (!pollRef.current) {
          pollRef.current = window.setInterval(() => { void acquire(); }, POLL_QUANDO_BLOQUEADO_MS);
        }
      }
    }

    void acquire();

    return () => {
      cancelado = true;
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
      // Release best-effort
      void supabase.rpc('engenharia_release_lock', {
        p_recurso_tipo: recursoTipo,
        p_recurso_id: recursoId,
      });
    };
  }, [recursoTipo, recursoId]);

  return estado;
}
```

- [ ] **Step 2: Testes Vitest**

Criar `src/modules/engenharia/hooks/useLockRecurso.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}));

import { useLockRecurso } from './useLockRecurso';
import { supabase } from '@/lib/supabase';

const mockRpc = supabase.rpc as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useLockRecurso', () => {
  it('status=carregando antes da resposta', () => {
    mockRpc.mockReturnValue(new Promise(() => {}));  // never resolves
    const { result } = renderHook(() => useLockRecurso('nota', 'nota-1'));
    expect(result.current.status).toBe('carregando');
  });

  it('status=meu quando acquire retorna adquirido=true', async () => {
    mockRpc.mockResolvedValue({
      data: [{ adquirido: true, dono_usuario_id: 'user-x', expira_em: '2026-05-27T12:00:00Z' }],
      error: null,
    });
    const { result } = renderHook(() => useLockRecurso('nota', 'nota-1'));
    await waitFor(() => expect(result.current.status).toBe('meu'));
    if (result.current.status === 'meu') {
      expect(result.current.expiraEm).toBe('2026-05-27T12:00:00Z');
    }
  });

  it('status=outro quando outro dono', async () => {
    mockRpc.mockResolvedValue({
      data: [{ adquirido: false, dono_usuario_id: 'outro-user', expira_em: '2026-05-27T12:05:00Z' }],
      error: null,
    });
    const { result } = renderHook(() => useLockRecurso('nota', 'nota-1'));
    await waitFor(() => expect(result.current.status).toBe('outro'));
    if (result.current.status === 'outro') {
      expect(result.current.donoUsuarioId).toBe('outro-user');
    }
  });

  it('chama release_lock no unmount', async () => {
    mockRpc.mockResolvedValue({
      data: [{ adquirido: true, dono_usuario_id: 'me', expira_em: '2026-05-27T12:00:00Z' }],
      error: null,
    });
    const { unmount } = renderHook(() => useLockRecurso('nota', 'nota-1'));
    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('engenharia_acquire_lock', expect.any(Object)));
    unmount();
    expect(mockRpc).toHaveBeenCalledWith('engenharia_release_lock', {
      p_recurso_tipo: 'nota',
      p_recurso_id: 'nota-1',
    });
  });

  it('null recursoId → no-op', () => {
    renderHook(() => useLockRecurso('nota', null));
    expect(mockRpc).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Rodar tests**

```bash
npx vitest run src/modules/engenharia/hooks/useLockRecurso.test.ts
```

Esperado: 5 testes verdes.

- [ ] **Step 4: Commit**

```bash
git add src/modules/engenharia/hooks/useLockRecurso.ts src/modules/engenharia/hooks/useLockRecurso.test.ts
git commit -m "feat(engenharia): hook useLockRecurso (acquire + heartbeat + release)

Generico para nota e calculo. Estados: carregando/meu/outro/erro.
Heartbeat 60s quando dono. Polling 15s quando bloqueado.
Release no unmount (best-effort).

5 testes Vitest verdes."
```

---

## Task 5: Hooks de nota + versões

**Files:**
- Create: `src/modules/engenharia/hooks/useEngenhariaNotas.ts`
- Create: `src/modules/engenharia/hooks/useNotaVersoes.ts`

- [ ] **Step 1: Implementar `useEngenhariaNotas.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  dbToEngenhariaNota,
  type EngenhariaNota,
  type EngenhariaNotaRow,
} from '../types/nota';

const QK_NOTA = (id: string) => ['engenharia', 'notas', 'item', id] as const;
const QK_NOTAS_DA_PASTA = (pastaId: string) =>
  ['engenharia', 'notas', 'pasta', pastaId] as const;

export function useEngenhariaNota(id: string) {
  return useQuery({
    queryKey: QK_NOTA(id),
    queryFn: async (): Promise<EngenhariaNota | null> => {
      const { data, error } = await supabase
        .from('engenharia_notas')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data ? dbToEngenhariaNota(data as EngenhariaNotaRow) : null;
    },
    enabled: !!id,
  });
}

export function useNotasDaPasta(pastaId: string) {
  return useQuery({
    queryKey: QK_NOTAS_DA_PASTA(pastaId),
    queryFn: async (): Promise<EngenhariaNota[]> => {
      const { data, error } = await supabase
        .from('engenharia_notas')
        .select('*')
        .eq('pasta_id', pastaId)
        .order('atualizado_em', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => dbToEngenhariaNota(r as EngenhariaNotaRow));
    },
    enabled: !!pastaId,
  });
}

export function useCriarNota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { pastaId: string; titulo: string }) => {
      const { data, error } = await supabase
        .from('engenharia_notas')
        .insert({
          pasta_id: input.pastaId,
          titulo: input.titulo,
          conteudo_json: { type: 'doc', content: [] },
        })
        .select('*')
        .single();
      if (error) throw error;
      return dbToEngenhariaNota(data as EngenhariaNotaRow);
    },
    onSuccess: (nota) => {
      qc.invalidateQueries({ queryKey: QK_NOTAS_DA_PASTA(nota.pastaId) });
    },
  });
}

export type SalvarNotaResult =
  | { ok: true; novaVersao: number }
  | { ok: false; motivo: 'conflito_versao' | 'sem_permissao' | 'nota_nao_encontrada' | string };

export function useSalvarNota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      titulo: string;
      conteudoJson: unknown;
      versaoAtual: number;
    }): Promise<SalvarNotaResult> => {
      const { data, error } = await supabase.rpc('engenharia_salvar_nota_com_versao', {
        p_nota_id: input.id,
        p_titulo: input.titulo,
        p_conteudo_json: input.conteudoJson,
        p_versao_atual: input.versaoAtual,
      });
      if (error) return { ok: false, motivo: error.message };
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.ok) {
        return { ok: false, motivo: row?.motivo ?? 'desconhecido' };
      }
      return { ok: true, novaVersao: row.nova_versao };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: QK_NOTA(vars.id) });
      qc.invalidateQueries({ queryKey: ['engenharia', 'notas', 'versoes', vars.id] });
    },
  });
}

export function useSoftDeleteNota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('engenharia_notas')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['engenharia', 'notas'] }),
  });
}
```

- [ ] **Step 2: Implementar `useNotaVersoes.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { dbToEngenhariaNotaVersao, type EngenhariaNotaVersao, type EngenhariaNotaVersaoRow } from '../types/nota';

export function useNotaVersoes(notaId: string) {
  return useQuery({
    queryKey: ['engenharia', 'notas', 'versoes', notaId],
    queryFn: async (): Promise<EngenhariaNotaVersao[]> => {
      const { data, error } = await supabase
        .from('engenharia_notas_versoes')
        .select('*')
        .eq('nota_id', notaId)
        .order('versao', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => dbToEngenhariaNotaVersao(r as EngenhariaNotaVersaoRow));
    },
    enabled: !!notaId,
  });
}

/**
 * Restaurar versão antiga = chamar engenharia_salvar_nota_com_versao com o
 * conteúdo da versão escolhida (mantém histórico — gera nova versão).
 */
export function useRestaurarVersao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      notaId: string;
      versaoAlvo: EngenhariaNotaVersao;
      versaoAtual: number;
      tituloAtual: string;
    }) => {
      const { data, error } = await supabase.rpc('engenharia_salvar_nota_com_versao', {
        p_nota_id: input.notaId,
        p_titulo: input.tituloAtual,
        p_conteudo_json: input.versaoAlvo.conteudoJson,
        p_versao_atual: input.versaoAtual,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.ok) throw new Error(row?.motivo ?? 'sem detalhe');
      return row.nova_versao as number;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['engenharia', 'notas', 'item', vars.notaId] });
      qc.invalidateQueries({ queryKey: ['engenharia', 'notas', 'versoes', vars.notaId] });
    },
  });
}
```

- [ ] **Step 3: Build + commit**

```bash
npx tsc -b
git add src/modules/engenharia/hooks/useEngenhariaNotas.ts src/modules/engenharia/hooks/useNotaVersoes.ts
git commit -m "feat(engenharia): hooks de nota + versoes (CRUD + restaurar)

useEngenhariaNota, useNotasDaPasta, useCriarNota, useSalvarNota (via RPC),
useSoftDeleteNota, useNotaVersoes, useRestaurarVersao.

SalvarNotaResult discriminado: ok|conflito_versao|sem_permissao|nota_nao_encontrada."
```

---

## Task 6: Components — LockBanner + NotaToolbar + HistoricoVersoesDrawer

> Specs funcionais (executor implementa seguindo padrões do projeto).

### LockBanner

```tsx
interface LockBannerProps {
  estado: EstadoLock;
  donoNome?: string;  // resolvido via funcionarios join externo
  onForcarLiberacao?: () => Promise<void>;  // só visível se temAcao('gerenciar_locks_engenharia')
}
```

- Renderiza nada se `estado.status === 'meu'`.
- Banner amarelo (`bg-yellow-50 border-yellow-200 text-yellow-900` em dark: `bg-yellow-950/30 border-yellow-900/30 text-yellow-200`) com:
  - Status `'outro'`: "Em uso por **{donoNome}** — expira em **{countdown}**". Countdown atualiza a cada segundo via setInterval.
  - Botão "Tentar agora" → re-trigger acquire (não precisa expor — o polling do hook já faz, mas botão dá feedback imediato).
  - Botão "Forçar liberação" se admin → confirma + delete na tabela `engenharia_locks` direto.
- Status `'erro'`: banner vermelho com mensagem.
- Status `'carregando'`: skeleton thin.

### NotaToolbar

```tsx
interface NotaToolbarProps {
  editor: Editor | null;  // Tiptap Editor instance
  desabilitado: boolean;  // !ehDono OR !temAcao('editar_engenharia_nota')
  onSalvar: () => void;
  onAbrirHistorico: () => void;
  podeVerHistorico: boolean;
  salvando: boolean;
}
```

- Linha de botões (shadcn `Button` size="sm" variant="ghost"):
  - Bold / Italic / Underline / Strike
  - H1 / H2 / H3
  - Lista bullet / Lista numerada / Lista tarefa
  - Link / Imagem / Tabela
  - Align left/center/right
  - Code block / Highlight
  - "Salvar" (Cmd+S indicator) — destacado primary
  - "Histórico" (relógio icon) → onAbrirHistorico
- Toggle ativo: `editor.isActive('bold')` etc.
- Desabilitado: aria-disabled + classe `opacity-50 pointer-events-none`.

### HistoricoVersoesDrawer

```tsx
interface HistoricoVersoesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notaId: string;
  notaAtual: EngenhariaNota;  // pra ter versao atual + titulo
  ehReadOnly: boolean;  // se true, esconde botão "Restaurar"
}
```

- shadcn `<Sheet>` slide-in da direita, w-96.
- Lista de versões (mais recentes primeiro) com:
  - Versão N (badge)
  - Data/hora relativa ("há 3 min")
  - Autor (resolvido via funcionarios — fallback "Sistema" se autor_id null)
  - Preview do conteúdo (primeiras 100 chars do text content extraído do JSON)
  - Botão "Ver" → abre diff textual (split pane atual vs versão escolhida usando `diff.diffWords`)
  - Botão "Restaurar" (se `!ehReadOnly` e `versao !== notaAtual.versao`) → chama `useRestaurarVersao()`
- Loading skeleton 3 linhas.

- [ ] **Step 1: Implementar os 3 componentes**.

- [ ] **Step 2: Build + commit**

```bash
npx tsc -b
git add src/modules/engenharia/components/LockBanner.tsx src/modules/engenharia/components/NotaToolbar.tsx src/modules/engenharia/components/HistoricoVersoesDrawer.tsx
git commit -m "feat(engenharia): LockBanner + NotaToolbar + HistoricoVersoesDrawer"
```

---

## Task 7: Component NotaEditor (Tiptap)

**Files:**
- Create: `src/modules/engenharia/components/NotaEditor.tsx`

- [ ] **Step 1: Implementar**

```tsx
import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Image } from '@tiptap/extension-image';
import { Link } from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { TextAlign } from '@tiptap/extension-text-align';
import { Highlight } from '@tiptap/extension-highlight';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { useEffect } from 'react';
import { uploadArquivo, getSignedUrl } from '../services/arquivosService';

interface NotaEditorProps {
  conteudoInicial: unknown;
  readOnly: boolean;
  pastaId: string;  // pra upload de imagem inline
  onChange: (conteudoJson: unknown) => void;
  onReadyEditor?: (editor: ReturnType<typeof useEditor>) => void;
}

export function NotaEditor({
  conteudoInicial,
  readOnly,
  pastaId,
  onChange,
  onReadyEditor,
}: NotaEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({ openOnClick: false }),
      Table.configure({ resizable: true }),
      TableRow, TableHeader, TableCell,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: conteudoInicial as never,
    editable: !readOnly,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none min-h-[400px] focus:outline-none px-6 py-4',
      },
      handlePaste: (view, event) => {
        // Detecta imagem no clipboard
        const items = Array.from(event.clipboardData?.items ?? []);
        const imageItem = items.find((i) => i.type.startsWith('image/'));
        if (!imageItem) return false;

        const file = imageItem.getAsFile();
        if (!file) return false;

        event.preventDefault();
        void (async () => {
          const result = await uploadArquivo({ pastaId, file });
          if (!result.ok) {
            // eslint-disable-next-line no-console
            console.error('Upload de imagem colada falhou:', result.motivo);
            return;
          }
          const url = await getSignedUrl(result.arquivoId).catch(() => null);
          if (url && editor) {
            editor.chain().focus().setImage({ src: url, alt: file.name }).run();
          }
        })();
        return true;
      },
    },
  });

  useEffect(() => {
    if (editor && onReadyEditor) onReadyEditor(editor);
  }, [editor, onReadyEditor]);

  // Reflete mudança de readOnly externo (ex.: lock foi pra outro user)
  useEffect(() => {
    if (editor) editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  return <EditorContent editor={editor} />;
}
```

- [ ] **Step 2: Build**

```bash
npx tsc -b
```

> ⚠ Tiptap pode requerer CSS de `prose` do Tailwind Typography. Se faltar, instalar `@tailwindcss/typography` e adicionar ao `tailwind.config` (mas Tailwind 4 funciona diferente — pode ser via `@plugin 'typography'` no CSS). Tratar como dep adicional se preciso.

- [ ] **Step 3: Commit**

```bash
git add src/modules/engenharia/components/NotaEditor.tsx
git commit -m "feat(engenharia): NotaEditor (Tiptap + paste de imagem via arquivosService)"
```

---

## Task 8: Page NotaPage + auto-save + integração lock

**Files:**
- Create: `src/modules/engenharia/pages/NotaPage.tsx`

- [ ] **Step 1: Implementar**

```tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, History } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { Skeleton } from '@/components/shadcn/skeleton';
import { Input } from '@/components/shadcn/input';
import { useAuth } from '@/contexts/AuthContext';
import { useLockRecurso } from '../hooks/useLockRecurso';
import { useEngenhariaNota, useSalvarNota } from '../hooks/useEngenhariaNotas';
import { NotaEditor } from '../components/NotaEditor';
import { NotaToolbar } from '../components/NotaToolbar';
import { LockBanner } from '../components/LockBanner';
import { HistoricoVersoesDrawer } from '../components/HistoricoVersoesDrawer';
import type { Editor } from '@tiptap/react';

const AUTO_SAVE_DEBOUNCE_MS = 5_000;  // 5 segundos de inatividade

export default function NotaPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { temAcao } = useAuth();

  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState<unknown>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const debounceRef = useRef<number | null>(null);

  const lock = useLockRecurso('nota', id ?? null);
  const { data: nota, isLoading } = useEngenhariaNota(id ?? '');
  const salvarMutation = useSalvarNota();

  const ehDono = lock.status === 'meu';
  const podeEditar = temAcao('editar_engenharia_nota');
  const readOnly = !podeEditar || !ehDono;

  // Carrega título + conteúdo quando nota chega
  useEffect(() => {
    if (nota) {
      setTitulo(nota.titulo);
      setConteudo(nota.conteudoJson);
    }
  }, [nota?.id]);

  // Função de salvar
  const salvar = useCallback(async () => {
    if (!nota || readOnly || salvando) return;
    setSalvando(true);
    setErroSalvar(null);
    const result = await salvarMutation.mutateAsync({
      id: nota.id,
      titulo,
      conteudoJson: conteudo,
      versaoAtual: nota.versao,
    });
    setSalvando(false);
    if (!result.ok) {
      setErroSalvar(
        result.motivo === 'conflito_versao'
          ? 'Outro usuário salvou no meio. Recarregue para ver as mudanças.'
          : `Falha ao salvar: ${result.motivo}`,
      );
    } else {
      dirtyRef.current = false;
    }
  }, [nota, readOnly, salvando, salvarMutation, titulo, conteudo]);

  // Debounce auto-save
  useEffect(() => {
    if (!dirtyRef.current || readOnly) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void salvar();
    }, AUTO_SAVE_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [titulo, conteudo, readOnly, salvar]);

  // Cmd/Ctrl+S manual
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        void salvar();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [salvar]);

  // Loading
  if (isLoading || !nota || !id) {
    return (
      <div className="p-6 space-y-3 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border px-4 py-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input
          value={titulo}
          onChange={(e) => { setTitulo(e.target.value); dirtyRef.current = true; }}
          disabled={readOnly}
          className="text-lg font-medium border-none shadow-none focus-visible:ring-0 px-2"
          placeholder="Título da nota"
        />
        {salvando && <span className="text-xs text-muted-foreground">Salvando…</span>}
        {!salvando && !dirtyRef.current && (
          <span className="text-xs text-muted-foreground">Salvo</span>
        )}
      </header>

      {/* Lock banner */}
      <LockBanner
        estado={lock}
        onForcarLiberacao={temAcao('gerenciar_locks_engenharia') ? async () => { /* TODO */ } : undefined}
      />

      {/* Erro de save */}
      {erroSalvar && (
        <div className="bg-destructive/10 text-destructive px-4 py-2 text-sm">
          {erroSalvar}
        </div>
      )}

      {/* Toolbar */}
      <NotaToolbar
        editor={editor}
        desabilitado={readOnly}
        onSalvar={() => void salvar()}
        onAbrirHistorico={() => setHistoricoOpen(true)}
        podeVerHistorico={temAcao('ver_historico_engenharia')}
        salvando={salvando}
      />

      {/* Editor */}
      <main className="flex-1 overflow-y-auto max-w-4xl mx-auto w-full">
        <NotaEditor
          conteudoInicial={conteudo}
          readOnly={readOnly}
          pastaId={nota.pastaId}
          onChange={(json) => { setConteudo(json); dirtyRef.current = true; }}
          onReadyEditor={setEditor}
        />
      </main>

      {/* Drawer histórico */}
      {temAcao('ver_historico_engenharia') && (
        <HistoricoVersoesDrawer
          open={historicoOpen}
          onOpenChange={setHistoricoOpen}
          notaId={nota.id}
          notaAtual={nota}
          ehReadOnly={readOnly}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Adicionar rota em `App.tsx`** após `PastaEngenhariaPage` route:

```tsx
const NotaPage = lazy(() => import('./modules/engenharia/pages/NotaPage'));

// ... dentro de Routes
<Route
  path="/engenharia/nota/:id"
  element={
    <Suspense fallback={<div>Carregando…</div>}>
      <ProtectedRoute acao="ver_engenharia"><NotaPage /></ProtectedRoute>
    </Suspense>
  }
/>
```

- [ ] **Step 3: Wire criar+navegar nota** em `PastaPage.tsx` — substituir `disabled` no item "Nota (Onda 4)" do dropdown "Novo":

```tsx
// substituir o item disabled atual por:
<DropdownMenuItem onClick={async () => {
  const nota = await criarNota.mutateAsync({ pastaId: pasta.id, titulo: 'Nova nota' });
  navigate(`/engenharia/nota/${nota.id}`);
}}>
  <FilePlus className="mr-2 h-4 w-4" /> Nota
</DropdownMenuItem>
```

Adicionar `import { useCriarNota } from '../hooks/useEngenhariaNotas'` e `const criarNota = useCriarNota()`.

- [ ] **Step 4: Build + commit**

```bash
npx tsc -b
git add src/modules/engenharia/pages/NotaPage.tsx src/App.tsx src/modules/engenharia/pages/PastaPage.tsx
git commit -m "feat(engenharia): NotaPage (editor Tiptap + lock + auto-save + historico)

NotaPage compose:
- useLockRecurso('nota', id) → readOnly se !ehDono
- useEngenhariaNota → carrega titulo + conteudo
- Auto-save debounce 5s + Cmd/Ctrl+S
- LockBanner se nao for dono
- NotaToolbar com formatacao
- HistoricoVersoesDrawer gated por ver_historico_engenharia

PastaPage 'Nota' do dropdown 'Novo' agora cria + navega."
```

---

## Task 9: Playwright E2E

**Files:**
- Create: `tests/engenharia-notas.spec.ts`

- [ ] **Step 1: Implementar 5 cenários (do plano-mestre)**

```ts
import { test, expect } from '@playwright/test';
import { hasCredentials, login } from './_fixtures';

test.describe('Engenharia — Notas', () => {
  test.skip(!hasCredentials(), 'E2E_TEST_EMAIL / E2E_TEST_PASSWORD não setados');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('cria nota dentro de pasta de obra → abre editor', async ({ page }) => {
    await page.goto('/engenharia');
    const obrasSection = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Obras', level: 2 }),
    });
    await obrasSection.getByRole('button', { name: /Abrir pasta/i }).first().click();
    await page.getByRole('button', { name: /^Novo$/i }).click();
    await page.getByRole('menuitem', { name: /^Nota$/i }).click();
    await expect(page).toHaveURL(/\/engenharia\/nota\//);
    await expect(page.getByPlaceholder('Título da nota')).toBeVisible();
  });

  test('digita, formata negrito, auto-save após 6s', async ({ page }) => {
    await page.goto('/engenharia');
    await page.getByRole('button', { name: /Abrir pasta/i }).first().click();
    await page.getByRole('button', { name: /^Novo$/i }).click();
    await page.getByRole('menuitem', { name: /^Nota$/i }).click();
    await page.getByPlaceholder('Título da nota').fill('E2E Auto-Save Test');
    await page.locator('.prose').click();
    await page.keyboard.type('Texto de teste em negrito');
    // Auto-save dispara
    await expect(page.getByText(/^Salvando…$|^Salvo$/i)).toBeVisible({ timeout: 8_000 });
    await page.waitForTimeout(6_000);
    await expect(page.getByText('Salvo')).toBeVisible();
  });

  test('lock: usuário B vê banner enquanto A edita', async ({ browser }) => {
    test.skip(); // TODO: requires 2 distinct test users — set up in fixtures Onda 8
  });

  test('Cmd+S manual dispara salvar', async ({ page }) => {
    await page.goto('/engenharia');
    await page.getByRole('button', { name: /Abrir pasta/i }).first().click();
    await page.getByRole('button', { name: /^Novo$/i }).click();
    await page.getByRole('menuitem', { name: /^Nota$/i }).click();
    await page.locator('.prose').click();
    await page.keyboard.type('Salvo via Cmd+S');
    await page.keyboard.press('Meta+s');
    await expect(page.getByText('Salvo')).toBeVisible({ timeout: 5_000 });
  });

  test('abre histórico de versões', async ({ page }) => {
    await page.goto('/engenharia');
    await page.getByRole('button', { name: /Abrir pasta/i }).first().click();
    await page.getByRole('button', { name: /^Novo$/i }).click();
    await page.getByRole('menuitem', { name: /^Nota$/i }).click();
    await page.getByRole('button', { name: /Histórico/i }).click();
    await expect(page.getByRole('heading', { name: /Histórico/i })).toBeVisible();
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add tests/engenharia-notas.spec ts
git commit -m "test(engenharia): Playwright E2E notas — 4 cenarios + 1 skipped"
```

---

## Task 10: Verificação + CHANGELOG + plano-mestre

- [ ] **Step 1: Suite completa**

```bash
npx vitest run src/modules/engenharia/
npx tsc -b
```

Esperado: 28+ testes Vitest (5 novos useLockRecurso + 23 antigos) + 0 erros TS em escopo.

- [ ] **Step 2: get_advisors security**

`mcp__plugin_supabase_supabase__get_advisors  type='security'`. Grep por `engenharia_salvar_nota_com_versao`. Esperado: 1 WARN "Signed-In Users Can Execute SECURITY DEFINER" — é ESPERADO (a função É pra ser chamada por authenticated). Documentar.

- [ ] **Step 3: Atualizar CHANGELOG `## Onda 4 — ...`** com:
- 1 migration (function salvar+version atômica)
- 13 packages npm (12 Tiptap + diff)
- 2 types (Nota + NotaVersao)
- 3 hooks files (useLockRecurso, useEngenhariaNotas, useNotaVersoes)
- 5 components (LockBanner, NotaToolbar, NotaEditor, HistoricoVersoesDrawer)
- 1 page (NotaPage)
- 1 route + wire criar+navegar
- 1 Playwright spec (4 ativos + 1 skipped 2-users)

- [ ] **Step 4: Marcar Onda 4 done no plano-mestre.**

- [ ] **Step 5: Commit final.**

---

## Self-Review

**Spec coverage:**
- Tiptap completo + extensões: ✅ Task 7
- Auto-save 5s + Cmd/Ctrl+S: ✅ Task 8
- Lock pessimista com heartbeat: ✅ Task 4 (hook) + Task 8 (integração)
- LockBanner read-only: ✅ Task 6
- Versionamento atômico via function SECDEF: ✅ Task 1
- Histórico de versões + restaurar: ✅ Task 5 (hook) + Task 6 (drawer)
- Paste de imagem: ✅ Task 7
- gerenciar_locks_engenharia (admin force): ⚠ stub `/* TODO */` em NotaPage — implementar como delete direto na engenharia_locks
- Modo leitura sem permissão: ✅ Task 8 (`readOnly` flag)
- Slash menu Tiptap: ❌ não implementado v1 — fica para Onda 8 (~1h trabalho)

**Placeholders:** O `// TODO: 2-users fixture (Onda 8)` no Playwright spec é intencional (gate de teste, não placeholder de código). O `/* TODO */` na force-liberação precisa ser implementado.

**Type consistency:**
- `SalvarNotaResult` discriminada via `ok: boolean`.
- `EstadoLock` discriminada via `status`.
- `engenharia_salvar_nota_com_versao` retorna `{ ok, nova_versao, motivo }` — hook traduz pra `SalvarNotaResult`.

**Granularidade:** 10 tasks, 3–6 steps cada, 1 checkpoint (Task 1 apply migration).

---

## Critério de "Onda 4 pronta"

- [ ] Function SECDEF aplicada + smoke test SQL OK.
- [ ] 13 packages instalados (12 Tiptap + diff).
- [ ] 3 hooks novos com Vitest verde.
- [ ] 5 components + 1 page novos.
- [ ] Rota `/engenharia/nota/:id` ativa.
- [ ] Wire em PastaPage para criar+navegar nota.
- [ ] 4+ Playwright tests verdes (1 skipped por fixture).
- [ ] `npx tsc -b` 0 erros em escopo Engenharia.
- [ ] `get_advisors security` sem novos issues além do esperado.
- [ ] CHANGELOG + plano-mestre atualizados.

---

## Execution Handoff

**Plano salvo em `docs/superpowers/plans/2026-05-27-engenharia-onda-4-bloco-nota.md`.**

Pattern recomendado igual Ondas 1–3: **Tasks 1-5 inline** (migration + libs + types + 2 hooks), **Tasks 6-9 via subagent** (UI components + page + Playwright), **Task 10 inline** (verificação).

Pronto pra executar?
