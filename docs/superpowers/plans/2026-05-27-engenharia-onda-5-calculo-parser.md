# Engenharia Onda 5 — Bloco de Cálculo, parte 1: parser, linhas, alerta

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rota `/engenharia/calculo/:id` com canvas de linhas (Soulver-style): usuário digita `1+1=` e o app resolve automático; resposta errada (`2*5=11`) acende vermelho + ⚠ + botão "Alerta revisado"; switch global liga/desliga só a comparação (parser continua resolvendo `=` vazio). Lock pessimista + auto-save + versionamento atômicos iguais à Onda 4. Variáveis nomeadas, spinner numérico, grid Excel e palavras-reservadas ficam pra Onda 6.

**Architecture:** `calcEngine.ts` envelopa **math.js** com `import({...}, override:true)` desabilitando `import/createUnit/reviver/simplify/derivative/resolve/parse` (sandbox apertado). `parseLinha(expressao)` separa `lhs=rhs` por `=`, avalia `lhs` via `evalSafe`, compara com `rhs` quando presente, devolve `{ resultado, alerta }`. `CalculoPage` lista `LinhaCalculo` (input controlado) com reavaliação local on-change + auto-save debounce 5s. `engenharia_salvar_calculo_com_versao` (SECDEF, copy do `salvar_nota_com_versao`) garante atomicidade snapshot+update. `useLockRecurso('calculo', id)` (da Onda 4) reusado. Lazy chunk só carrega quando `/engenharia/calculo/:id` abre. **⛔ Hard stop ao fim da onda — Onda 6 (variáveis + spinner + grid) precisa aprovação manual depois.**

**Tech Stack:** `mathjs@^14.x` (sandboxed), shadcn (button/input/switch/skeleton/sheet/badge/alert-dialog), @tanstack/react-query 5, react-hook-form opcional, `diff@9` (já instalado), Tailwind v4 + typography (já instalado).

**Spec:** Master plan [`2026-05-26-engenharia-modulo.md`](2026-05-26-engenharia-modulo.md) seção 7 Onda 5 + critérios de aceitação 5.5 (5 Playwright + 2 Vitest).

**Dependências:**
- Onda 1: tabelas `engenharia_calculos` (id, pasta_id, titulo, documento_json jsonb, alerta_ativo bool, versao, ...), `engenharia_calculos_versoes`, chaves `criar/editar/excluir_engenharia_calculo`, `ver_historico_engenharia`, `gerenciar_locks_engenharia`, funções de lock SECDEF.
- Onda 4: hook `useLockRecurso` (genérico), pattern de SECDEF `engenharia_salvar_nota_com_versao` (copia tudo trocando nota→calculo), `extrairTextoPlain` NÃO se aplica aqui (histórico de cálculo mostra preview de linhas em texto puro).
- Onda 3: rotas `/engenharia/*` lazy-loaded, `useAuth().temAcao`, padrões shadcn + design tokens, dropdown "Novo" da PastaPage.

---

## File Structure

**Create:**
- `supabase/migrations/20260528200000_engenharia_salvar_calculo_com_versao_fix.sql` — function SECDEF atômica save+version.
- `supabase/migrations/20260528200100_engenharia_salvar_calculo_com_versao_rollback.sql`.
- `src/modules/engenharia/types/calculo.ts` — `EngenhariaCalculo`, `EngenhariaCalculoVersao`, `LinhaCalculo`, `DocumentoCalculo`, mappers.
- `src/modules/engenharia/services/calcEngine.ts` — `evalSafe`, `parseLinha`, `recalcularDocumento`.
- `src/modules/engenharia/services/calcEngine.test.ts` — Vitest (sandbox + parser + cenários do prompt 5.5).
- `src/modules/engenharia/hooks/useEngenhariaCalculos.ts` — `useEngenhariaCalculo`, `useCriarCalculo`, `useSalvarCalculo`, `useToggleAlertaAtivo`, `useSoftDeleteCalculo`.
- `src/modules/engenharia/hooks/useCalculoVersoes.ts` — `useCalculoVersoes` + `useRestaurarVersaoCalculo`.
- `src/modules/engenharia/components/LinhaCalculo.tsx` — input + resultado + alerta + botão "Alerta revisado".
- `src/modules/engenharia/components/CalculoToolbar.tsx` — título + switch verificação + Salvar + Histórico.
- `src/modules/engenharia/components/HistoricoCalculoDrawer.tsx` — Sheet com lista de versões + diff textual + Restaurar.
- `src/modules/engenharia/pages/CalculoPage.tsx` — `/engenharia/calculo/:id`.
- `tests/engenharia-calculos.spec.ts` — Playwright E2E (5 cenários da seção 5.5 + 1 lock skipped pra Onda 8).

**Modify:**
- `src/App.tsx` — lazy route `/engenharia/calculo/:id`.
- `src/modules/engenharia/pages/PastaPage.tsx` — dropdown "Cálculo (Onda 5)" deixa de ser `disabled`, agora cria+navega.

---

## Task 1: Function SECDEF `engenharia_salvar_calculo_com_versao`

**Files:**
- Create: `supabase/migrations/20260528200000_engenharia_salvar_calculo_com_versao_fix.sql`
- Create: `supabase/migrations/20260528200100_engenharia_salvar_calculo_com_versao_rollback.sql`

**Por quê:** Mesmo raciocínio da Onda 4 Task 1 — save envolve 2 statements (INSERT versão + UPDATE cálculo). Plpgsql function = 1 transação. Optimistic concurrency via `p_versao_atual`. Cap 50 versões (D-9).

- [ ] **Step 1: Escrever `_fix.sql`**

```sql
-- Engenharia — Onda 5.1: function SECDEF que salva cálculo + cria versão (atômico).
-- Spec: docs/superpowers/plans/2026-05-27-engenharia-onda-5-calculo-parser.md.
-- Rollback: 20260528200100_engenharia_salvar_calculo_com_versao_rollback.sql.

begin;

create or replace function public.engenharia_salvar_calculo_com_versao(
  p_calculo_id uuid,
  p_titulo text,
  p_documento_json jsonb,
  p_alerta_ativo boolean,
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
  v_doc_db jsonb;
begin
  if not private.current_has_action('editar_engenharia_calculo') then
    return query select false, null::int, 'sem_permissao';
    return;
  end if;

  select versao, documento_json into v_versao_db, v_doc_db
    from public.engenharia_calculos
   where id = p_calculo_id and deleted_at is null
   for update;

  if not found then
    return query select false, null::int, 'calculo_nao_encontrado';
    return;
  end if;

  if v_versao_db <> p_versao_atual then
    return query select false, v_versao_db, 'conflito_versao';
    return;
  end if;

  insert into public.engenharia_calculos_versoes (calculo_id, versao, documento_json, autor_id)
  values (p_calculo_id, v_versao_db, v_doc_db, v_user);

  update public.engenharia_calculos
     set titulo = p_titulo,
         documento_json = p_documento_json,
         alerta_ativo = p_alerta_ativo,
         versao = v_versao_db + 1,
         atualizado_em = now()
   where id = p_calculo_id;

  -- Cap 50 versões (D-9)
  delete from public.engenharia_calculos_versoes
   where calculo_id = p_calculo_id
     and id not in (
       select id from public.engenharia_calculos_versoes
        where calculo_id = p_calculo_id
        order by versao desc
        limit 50
     );

  return query select true, v_versao_db + 1, ''::text;
end $$;

grant execute on function public.engenharia_salvar_calculo_com_versao(uuid, text, jsonb, boolean, int) to authenticated;
revoke execute on function public.engenharia_salvar_calculo_com_versao(uuid, text, jsonb, boolean, int) from anon, public;

comment on function public.engenharia_salvar_calculo_com_versao(uuid, text, jsonb, boolean, int)
  is 'Engenharia: salva calculo atomicamente (snapshot da versao antiga + update). Optimistic concurrency via p_versao_atual. Cap 50 versoes. SECDEF.';

commit;
```

- [ ] **Step 2: Escrever `_rollback.sql`**

```sql
-- Rollback de 20260528200000_engenharia_salvar_calculo_com_versao_fix.sql

begin;

drop function if exists public.engenharia_salvar_calculo_com_versao(uuid, text, jsonb, boolean, int);

commit;
```

- [ ] **Step 3: Apply via MCP**

Use `mcp__plugin_supabase_supabase__apply_migration` with name `engenharia_salvar_calculo_com_versao_fix` e SQL acima. Pedir confirmação ao user antes.

- [ ] **Step 4: Smoke test via `execute_sql`**

```sql
do $$
declare
  v_pasta uuid;
  v_calc uuid;
  v_result record;
begin
  insert into public.engenharia_pastas (nome, tipo, caminho)
  values ('Test Onda 5', 'avulsa', '/test-onda-5') returning id into v_pasta;

  insert into public.engenharia_calculos (pasta_id, titulo, documento_json, alerta_ativo, versao)
  values (v_pasta, 'Cálculo Teste', '{"linhas":[]}'::jsonb, true, 1) returning id into v_calc;

  -- 1) Save com versão correta → ok
  select * into v_result from public.engenharia_salvar_calculo_com_versao(
    v_calc, 'Renomeado', '{"linhas":[{"id":"l1","expressao":"1+1=","resultado":"2","alerta":"ok","ordem":0}]}'::jsonb, true, 1
  );
  if not v_result.ok or v_result.nova_versao <> 2 then
    raise exception 'FAIL save v1: ok=% nova=% motivo=%', v_result.ok, v_result.nova_versao, v_result.motivo;
  end if;
  raise notice 'OK 1: save com versao 1 -> nova=2';

  -- 2) Save com versão errada → conflito
  select * into v_result from public.engenharia_salvar_calculo_com_versao(
    v_calc, 'Outra', '{"linhas":[]}'::jsonb, true, 1
  );
  if v_result.ok then raise exception 'FAIL: conflito nao detectado'; end if;
  if v_result.motivo <> 'conflito_versao' then
    raise exception 'FAIL motivo errado: %', v_result.motivo;
  end if;
  raise notice 'OK 2: conflito v1 vs v2 detectado';

  -- 3) Confere snapshot da v1
  if not exists (
    select 1 from public.engenharia_calculos_versoes
     where calculo_id = v_calc and versao = 1
  ) then raise exception 'FAIL: snapshot v1 ausente'; end if;
  raise notice 'OK 3: snapshot v1 presente';

  delete from public.engenharia_pastas where id = v_pasta;
  raise notice 'OK 4: cleanup OK';
end $$;
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260528200000_* supabase/migrations/20260528200100_*
git commit -m "feat(engenharia): function SECDEF engenharia_salvar_calculo_com_versao (atomico)

Mesma forma da salvar_nota_com_versao: snapshot da versao antiga em
engenharia_calculos_versoes + UPDATE da row + cap 50 versoes. Optimistic
concurrency via p_versao_atual. Inclui p_alerta_ativo (coluna do row,
nao do JSON).

GRANT EXECUTE to authenticated; REVOKE from anon/public.

Smoke test SQL: 3 cenarios passaram."
```

---

## Task 2: Instalar mathjs

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install**

```bash
cd /Users/tiagocameli/Projects/Gestao_Obras
npm install mathjs@^14.0.0
```

- [ ] **Step 2: Verificar instalação**

```bash
node -e "console.log('mathjs:', require('./node_modules/mathjs/package.json').version)"
```

Esperado: `mathjs: 14.x.x`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(engenharia): adiciona mathjs@14 (sandbox via calcEngine na Onda 5)

~150 KB gzip. Cai apenas no lazy chunk /engenharia/calculo/:id.
Aprovado pelo user em 2026-05-27."
```

---

## Task 3: Service `calcEngine` (sandbox + parser) com Vitest

**Files:**
- Create: `src/modules/engenharia/services/calcEngine.ts`
- Create: `src/modules/engenharia/services/calcEngine.test.ts`

**Por quê:** centraliza a interface insegura→segura do math.js e fornece `parseLinha` (sintaxe `lhs=rhs`). Testes cobrem a sandbox + os 5 cenários funcionais da seção 5.5 do prompt original.

- [ ] **Step 1: Escrever `calcEngine.ts`**

```ts
import { create, all } from 'mathjs';

// Sandbox: desabilita import/createUnit/etc. de DENTRO de expressões.
// Outros símbolos perigosos do math.js continuam disponíveis no escopo global
// do nosso `mathInstance`, mas como usamos `evaluate(expr, scope)`, o `scope`
// limita o universo de identificadores. Combinacao: instancia priv + override.
const mathInstance = create(all);
mathInstance.import(
  {
    import: () => { throw new Error('disabled'); },
    createUnit: () => { throw new Error('disabled'); },
    reviver: () => { throw new Error('disabled'); },
    simplify: () => { throw new Error('disabled'); },
    derivative: () => { throw new Error('disabled'); },
    resolve: () => { throw new Error('disabled'); },
    parse: () => { throw new Error('disabled'); },
  },
  { override: true },
);

export type AlertaLinha = 'ok' | 'erro' | 'revisado' | 'vazio';

export interface ResultadoParse {
  /** Texto à esquerda do "=" — a expressão que será avaliada. Pode ser '' se sem `=`. */
  lhs: string;
  /** Texto à direita do "=" digitado pelo usuário. `null` se sem `=`. */
  rhsUsuario: string | null;
  /** Valor calculado pela engine (stringificado). `null` se LHS vazio ou erro. */
  resultado: string | null;
  /** Estado da linha. `vazio` quando sem `=`; outras combinações conforme regras. */
  alerta: AlertaLinha;
  /** Mensagem curta de erro de parse (se houver). */
  erroEngine?: string;
}

/**
 * Avalia uma expressão usando a instância sandboxed do math.js.
 * Throws em qualquer erro do parser/evaluator.
 */
export function evalSafe(expr: string, scope: Record<string, unknown> = {}): unknown {
  return mathInstance.evaluate(expr, scope);
}

/**
 * Parseia uma linha do bloco de cálculo no formato `lhs=rhs` (rhs opcional).
 *
 * Regras (prompt original, fase 5):
 * - linha sem `=`: alerta='vazio' (apenas exibe texto).
 * - linha com `=` e LHS vazio (`=10`): alerta='vazio' (UX neutra).
 * - linha com `=` e RHS vazio (`1+1=`): app preenche resultado, alerta='ok'.
 * - LHS válido + RHS bate: alerta='ok'.
 * - LHS válido + RHS não-bate: alerta='erro'.
 * - LHS erro de parse: alerta='erro' + erroEngine populado.
 *
 * Comparação RHS vs resultado é numérica quando ambos forem números (tolera
 * 1e-9 de epsilon). Caso contrário, comparação textual normalizada (trim).
 */
export function parseLinha(expressaoCompleta: string): ResultadoParse {
  const txt = expressaoCompleta;
  const igualIdx = txt.indexOf('=');

  if (igualIdx < 0) {
    return { lhs: txt, rhsUsuario: null, resultado: null, alerta: 'vazio' };
  }

  const lhs = txt.slice(0, igualIdx).trim();
  const rhsRaw = txt.slice(igualIdx + 1);
  const rhsUsuario = rhsRaw.trim() === '' ? null : rhsRaw.trim();

  if (lhs === '') {
    return { lhs: '', rhsUsuario, resultado: null, alerta: 'vazio' };
  }

  let resultado: string | null = null;
  try {
    const valor = evalSafe(lhs);
    resultado = stringifyResultado(valor);
  } catch (e) {
    return {
      lhs,
      rhsUsuario,
      resultado: null,
      alerta: 'erro',
      erroEngine: e instanceof Error ? e.message : 'erro de cálculo',
    };
  }

  if (rhsUsuario === null) {
    // Linha tipo `1+1=` → preencher
    return { lhs, rhsUsuario: null, resultado, alerta: 'ok' };
  }

  if (resultado !== null && resultadosBatem(resultado, rhsUsuario)) {
    return { lhs, rhsUsuario, resultado, alerta: 'ok' };
  }

  return { lhs, rhsUsuario, resultado, alerta: 'erro' };
}

function stringifyResultado(v: unknown): string {
  if (typeof v === 'number') {
    // Trunca casas pequenas pra evitar `0.30000000000000004`.
    return Number.isInteger(v) ? v.toString() : Number(v.toFixed(10)).toString();
  }
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

function resultadosBatem(calc: string, user: string): boolean {
  const a = Number(calc);
  const b = Number(user);
  if (!Number.isNaN(a) && !Number.isNaN(b)) {
    return Math.abs(a - b) < 1e-9;
  }
  return calc.trim() === user.trim();
}
```

- [ ] **Step 2: Escrever `calcEngine.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { evalSafe, parseLinha } from './calcEngine';

describe('calcEngine.evalSafe sandbox', () => {
  it('avalia aritmética simples', () => {
    expect(evalSafe('1+1')).toBe(2);
    expect(evalSafe('2*5')).toBe(10);
    expect(evalSafe('sqrt(16)')).toBe(4);
  });

  it('throws em import("foo") — sandbox', () => {
    expect(() => evalSafe('import("foo")')).toThrow();
  });

  it('throws em createUnit', () => {
    expect(() => evalSafe('createUnit("xyz")')).toThrow();
  });

  it('throws em parse() de dentro da expressão', () => {
    expect(() => evalSafe('parse("1+1")')).toThrow();
  });

  it('respeita scope passado', () => {
    expect(evalSafe('x * 2', { x: 21 })).toBe(42);
  });
});

describe('parseLinha — cenários 5.5 do prompt original', () => {
  it('linha vazia → alerta=vazio', () => {
    const r = parseLinha('');
    expect(r.alerta).toBe('vazio');
    expect(r.resultado).toBeNull();
  });

  it('sem `=` → alerta=vazio (mostra só texto)', () => {
    const r = parseLinha('memória de cálculo');
    expect(r.alerta).toBe('vazio');
  });

  it('`1+1=` → preenche 2, alerta=ok', () => {
    const r = parseLinha('1+1=');
    expect(r.resultado).toBe('2');
    expect(r.alerta).toBe('ok');
    expect(r.rhsUsuario).toBeNull();
  });

  it('`2*5=20` → ok, sem alerta', () => {
    const r = parseLinha('2*5=20');
    expect(r.resultado).toBe('10');  // engine calcula 10
    // espera, 2*5=20 deveria ser erro? Não — 2*5 = 10, RHS=20, mismatch → erro
    // O prompt diz `2*5=20 → ok` mas isso é inconsistente matematicamente.
    // Provavelmente o prompt quis dizer `2*10=20`. Vamos seguir a matemática:
    // RHS bate quando resultado == RHS. Aqui não bate.
    expect(r.alerta).toBe('erro');
  });

  it('`2*10=20` → ok (numericamente bate)', () => {
    const r = parseLinha('2*10=20');
    expect(r.alerta).toBe('ok');
    expect(r.resultado).toBe('20');
  });

  it('`2*5=11` → alerta=erro', () => {
    const r = parseLinha('2*5=11');
    expect(r.resultado).toBe('10');
    expect(r.alerta).toBe('erro');
    expect(r.rhsUsuario).toBe('11');
  });

  it('expressão inválida → alerta=erro + erroEngine', () => {
    const r = parseLinha('1+=2');
    expect(r.alerta).toBe('erro');
    expect(r.erroEngine).toBeTruthy();
  });

  it('tolera epsilon: 0.1+0.2=0.3', () => {
    const r = parseLinha('0.1+0.2=0.3');
    expect(r.alerta).toBe('ok');
  });

  it('LHS vazio (`=10`) → alerta=vazio (UX neutra)', () => {
    const r = parseLinha('=10');
    expect(r.alerta).toBe('vazio');
  });

  it('strings: comparação textual', () => {
    const r = parseLinha('"abc"="abc"');
    expect(r.alerta).toBe('ok');
  });
});
```

> ⚠ Observação: o prompt original lista `2*5=20 → ok` no critério de aceitação. Isso é um erro do prompt (2*5=10, não 20). O implementador deve seguir a matemática real (RHS deve bater com LHS calculado). Documentar em comentário de teste e no CHANGELOG.

- [ ] **Step 3: Rodar tests**

```bash
npx vitest run src/modules/engenharia/services/calcEngine.test.ts
```

Esperado: 13 testes verdes.

- [ ] **Step 4: Commit**

```bash
git add src/modules/engenharia/services/calcEngine.ts src/modules/engenharia/services/calcEngine.test.ts
git commit -m "feat(engenharia): calcEngine (math.js sandboxed + parseLinha)

evalSafe usa instancia privada do math.js com override desabilitando
import/createUnit/reviver/simplify/derivative/resolve/parse. parseLinha
separa lhs=rhs por '=', avalia LHS, compara com RHS (numericamente com
epsilon 1e-9 ou textualmente normalizado), retorna alerta ok|erro|vazio.

13 testes Vitest verdes (sandbox: 5; parser: 8). O prompt original tinha
'2*5=20 -> ok' como exemplo, o que e matematicamente errado — seguimos
a regra correta (resultado == RHS) e adicionamos teste explicativo."
```

---

## Task 4: Tipos + mappers de cálculo

**Files:**
- Create: `src/modules/engenharia/types/calculo.ts`

- [ ] **Step 1: Implementar**

```ts
import type { AlertaLinha } from '../services/calcEngine';

export interface LinhaCalculo {
  id: string;
  /** Expressão completa digitada pelo usuário, ex: "1+1=2" ou "memória de cálculo". */
  expressao: string;
  /** Resultado calculado pela engine (stringificado). Null se LHS vazio/erro/sem `=`. */
  resultado: string | null;
  /** Estado atual da linha (recalculado on-render por parseLinha; persistido pra reabrir histórico). */
  alerta: AlertaLinha;
  /** Posição na lista. Inteiro 0-based; reordenar regenera. */
  ordem: number;
}

export interface DocumentoCalculo {
  linhas: LinhaCalculo[];
}

export interface EngenhariaCalculo {
  id: string;
  pastaId: string;
  titulo: string;
  documento: DocumentoCalculo;
  alertaAtivo: boolean;
  versao: number;
  criadoPor: string | null;
  criadoEm: string;
  atualizadoEm: string;
  deletedAt: string | null;
}

export interface EngenhariaCalculoRow {
  id: string;
  pasta_id: string;
  titulo: string;
  documento_json: DocumentoCalculo;
  alerta_ativo: boolean;
  versao: number;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
  deleted_at: string | null;
}

export function dbToEngenhariaCalculo(row: EngenhariaCalculoRow): EngenhariaCalculo {
  return {
    id: row.id,
    pastaId: row.pasta_id,
    titulo: row.titulo,
    documento: row.documento_json ?? { linhas: [] },
    alertaAtivo: row.alerta_ativo,
    versao: row.versao,
    criadoPor: row.criado_por,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
    deletedAt: row.deleted_at,
  };
}

export interface EngenhariaCalculoVersao {
  id: string;
  calculoId: string;
  versao: number;
  documento: DocumentoCalculo;
  autorId: string | null;
  criadoEm: string;
}

export interface EngenhariaCalculoVersaoRow {
  id: string;
  calculo_id: string;
  versao: number;
  documento_json: DocumentoCalculo;
  autor_id: string | null;
  criado_em: string;
}

export function dbToEngenhariaCalculoVersao(row: EngenhariaCalculoVersaoRow): EngenhariaCalculoVersao {
  return {
    id: row.id,
    calculoId: row.calculo_id,
    versao: row.versao,
    documento: row.documento_json ?? { linhas: [] },
    autorId: row.autor_id,
    criadoEm: row.criado_em,
  };
}

/** Linha vazia recém-criada (usado ao adicionar nova linha no canvas). */
export function novaLinhaVazia(ordem: number): LinhaCalculo {
  return {
    id: crypto.randomUUID(),
    expressao: '',
    resultado: null,
    alerta: 'vazio',
    ordem,
  };
}
```

- [ ] **Step 2: Build + commit**

```bash
npx tsc -b
git add src/modules/engenharia/types/calculo.ts
git commit -m "feat(engenharia): tipos EngenhariaCalculo + LinhaCalculo + DocumentoCalculo + mappers

LinhaCalculo eh a unidade do canvas (id + expressao + resultado +
alerta + ordem). DocumentoCalculo eh apenas { linhas } na Onda 5;
Onda 6 estendera com variaveis_definidas, aliases, config.
alertaAtivo eh coluna do row (nao do JSON) — coerente com o schema
da Onda 1."
```

---

## Task 5: Hooks de cálculo + versões

**Files:**
- Create: `src/modules/engenharia/hooks/useEngenhariaCalculos.ts`
- Create: `src/modules/engenharia/hooks/useCalculoVersoes.ts`

- [ ] **Step 1: Implementar `useEngenhariaCalculos.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  dbToEngenhariaCalculo,
  type EngenhariaCalculo,
  type EngenhariaCalculoRow,
  type DocumentoCalculo,
} from '../types/calculo';

const QK_CALC = (id: string) => ['engenharia', 'calculos', 'item', id] as const;
const QK_CALCS_DA_PASTA = (pastaId: string) =>
  ['engenharia', 'calculos', 'pasta', pastaId] as const;

export function useEngenhariaCalculo(id: string) {
  return useQuery({
    queryKey: QK_CALC(id),
    queryFn: async (): Promise<EngenhariaCalculo | null> => {
      const { data, error } = await supabase
        .from('engenharia_calculos')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data ? dbToEngenhariaCalculo(data as EngenhariaCalculoRow) : null;
    },
    enabled: !!id,
  });
}

export function useCalculosDaPasta(pastaId: string) {
  return useQuery({
    queryKey: QK_CALCS_DA_PASTA(pastaId),
    queryFn: async (): Promise<EngenhariaCalculo[]> => {
      const { data, error } = await supabase
        .from('engenharia_calculos')
        .select('*')
        .eq('pasta_id', pastaId)
        .order('atualizado_em', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => dbToEngenhariaCalculo(r as EngenhariaCalculoRow));
    },
    enabled: !!pastaId,
  });
}

export function useCriarCalculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { pastaId: string; titulo: string }) => {
      const { data, error } = await supabase
        .from('engenharia_calculos')
        .insert({
          pasta_id: input.pastaId,
          titulo: input.titulo,
          documento_json: { linhas: [] },
          alerta_ativo: true,
        })
        .select('*')
        .single();
      if (error) throw error;
      return dbToEngenhariaCalculo(data as EngenhariaCalculoRow);
    },
    onSuccess: (calc) => {
      qc.invalidateQueries({ queryKey: QK_CALCS_DA_PASTA(calc.pastaId) });
    },
  });
}

export type SalvarCalculoResult =
  | { ok: true; novaVersao: number }
  | { ok: false; motivo: 'conflito_versao' | 'sem_permissao' | 'calculo_nao_encontrado' | string };

export function useSalvarCalculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      titulo: string;
      documento: DocumentoCalculo;
      alertaAtivo: boolean;
      versaoAtual: number;
    }): Promise<SalvarCalculoResult> => {
      const { data, error } = await supabase.rpc('engenharia_salvar_calculo_com_versao', {
        p_calculo_id: input.id,
        p_titulo: input.titulo,
        p_documento_json: input.documento,
        p_alerta_ativo: input.alertaAtivo,
        p_versao_atual: input.versaoAtual,
      });
      if (error) return { ok: false, motivo: error.message };
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.ok) return { ok: false, motivo: row?.motivo ?? 'desconhecido' };
      return { ok: true, novaVersao: row.nova_versao };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: QK_CALC(vars.id) });
      qc.invalidateQueries({ queryKey: ['engenharia', 'calculos', 'versoes', vars.id] });
    },
  });
}

export function useSoftDeleteCalculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('engenharia_calculos')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['engenharia', 'calculos'] }),
  });
}
```

- [ ] **Step 2: Implementar `useCalculoVersoes.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  dbToEngenhariaCalculoVersao,
  type EngenhariaCalculoVersao,
  type EngenhariaCalculoVersaoRow,
} from '../types/calculo';

export function useCalculoVersoes(calculoId: string) {
  return useQuery({
    queryKey: ['engenharia', 'calculos', 'versoes', calculoId],
    queryFn: async (): Promise<EngenhariaCalculoVersao[]> => {
      const { data, error } = await supabase
        .from('engenharia_calculos_versoes')
        .select('*')
        .eq('calculo_id', calculoId)
        .order('versao', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => dbToEngenhariaCalculoVersao(r as EngenhariaCalculoVersaoRow));
    },
    enabled: !!calculoId,
  });
}

export function useRestaurarVersaoCalculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      calculoId: string;
      versaoAlvo: EngenhariaCalculoVersao;
      versaoAtual: number;
      tituloAtual: string;
      alertaAtivoAtual: boolean;
    }) => {
      const { data, error } = await supabase.rpc('engenharia_salvar_calculo_com_versao', {
        p_calculo_id: input.calculoId,
        p_titulo: input.tituloAtual,
        p_documento_json: input.versaoAlvo.documento,
        p_alerta_ativo: input.alertaAtivoAtual,
        p_versao_atual: input.versaoAtual,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.ok) throw new Error(row?.motivo ?? 'sem detalhe');
      return row.nova_versao as number;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['engenharia', 'calculos', 'item', vars.calculoId] });
      qc.invalidateQueries({ queryKey: ['engenharia', 'calculos', 'versoes', vars.calculoId] });
    },
  });
}
```

- [ ] **Step 3: Build + commit**

```bash
npx tsc -b
git add src/modules/engenharia/hooks/useEngenhariaCalculos.ts src/modules/engenharia/hooks/useCalculoVersoes.ts
git commit -m "feat(engenharia): hooks de calculo + versoes (CRUD + restaurar via RPC)

useEngenhariaCalculo, useCalculosDaPasta, useCriarCalculo, useSalvarCalculo
(via RPC engenharia_salvar_calculo_com_versao), useSoftDeleteCalculo,
useCalculoVersoes, useRestaurarVersaoCalculo.

SalvarCalculoResult discriminado igual SalvarNotaResult da Onda 4."
```

---

## Task 6: Component `LinhaCalculo`

**Files:**
- Create: `src/modules/engenharia/components/LinhaCalculo.tsx`

**Por quê:** unidade central do canvas. Recebe `linha` + flags, mostra input controlado, exibe resultado computado, mostra alerta visual (vermelho + ⚠) quando `alerta='erro' && alertaAtivo`, oferece botão "Alerta revisado".

- [ ] **Step 1: Implementar**

```tsx
import { useMemo } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { Input } from '@/components/shadcn/input';
import { parseLinha } from '../services/calcEngine';
import type { LinhaCalculo as TLinha } from '../types/calculo';

interface LinhaCalculoProps {
  linha: TLinha;
  alertaAtivo: boolean;
  readOnly: boolean;
  onChange: (atualizada: TLinha) => void;
  onRevisado: (linhaId: string) => void;
  /** Quando true (após o user clicar Alerta revisado) sobrescreve `alerta` desta linha como `revisado`. */
  marcadaRevisada: boolean;
}

export function LinhaCalculo({
  linha,
  alertaAtivo,
  readOnly,
  onChange,
  onRevisado,
  marcadaRevisada,
}: LinhaCalculoProps) {
  // Reavalia a linha on-render (parser puro, sem efeitos colaterais)
  const parsed = useMemo(() => parseLinha(linha.expressao), [linha.expressao]);
  const alertaEfetivo = marcadaRevisada ? 'revisado' : parsed.alerta;

  // Texto exibido no input: se houver `=` mas RHS vazio, MOSTRA o resultado calculado
  // (UX Soulver). O documento persiste a expressao original — preenchemos no onChange.
  const exibirTexto = (() => {
    if (parsed.alerta === 'ok' && parsed.rhsUsuario === null && parsed.resultado !== null) {
      return `${parsed.lhs}=${parsed.resultado}`;
    }
    return linha.expressao;
  })();

  const mostrarErro = alertaAtivo && alertaEfetivo === 'erro';

  function handleChange(novoTexto: string) {
    const novoParsed = parseLinha(novoTexto);
    onChange({
      ...linha,
      expressao: novoTexto,
      resultado: novoParsed.resultado,
      alerta: novoParsed.alerta,
    });
  }

  function handleBlurAutoFill() {
    // Quando user sai do input e a linha tipo `1+1=`, persiste o resultado preenchido
    if (parsed.alerta === 'ok' && parsed.rhsUsuario === null && parsed.resultado !== null) {
      const completo = `${parsed.lhs}=${parsed.resultado}`;
      if (linha.expressao !== completo) {
        onChange({ ...linha, expressao: completo, resultado: parsed.resultado, alerta: 'ok' });
      }
    }
  }

  return (
    <div
      data-alerta={alertaEfetivo}
      className={[
        'flex items-center gap-2 px-3 py-1.5 rounded-md border',
        mostrarErro
          ? 'border-destructive/50 bg-destructive/5'
          : 'border-transparent hover:bg-muted/40',
      ].join(' ')}
    >
      <Input
        value={exibirTexto}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlurAutoFill}
        disabled={readOnly}
        className="font-mono text-sm border-none shadow-none focus-visible:ring-0 px-0 bg-transparent"
        placeholder="Digite uma expressão (ex: 1+1=)"
        aria-invalid={mostrarErro || undefined}
      />
      {mostrarErro && (
        <>
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" aria-hidden />
          <span className="text-xs text-destructive whitespace-nowrap">
            {parsed.resultado !== null ? `calculado: ${parsed.resultado}` : 'expressão inválida'}
          </span>
          {!readOnly && (
            <Button
              size="xs"
              variant="outline"
              onClick={() => onRevisado(linha.id)}
              className="border-destructive/30"
            >
              Alerta revisado
            </Button>
          )}
        </>
      )}
      {alertaAtivo && alertaEfetivo === 'revisado' && (
        <Check className="h-4 w-4 text-muted-foreground shrink-0" aria-label="Revisado" />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build + commit**

```bash
npx tsc -b
git add src/modules/engenharia/components/LinhaCalculo.tsx
git commit -m "feat(engenharia): LinhaCalculo (input + alerta visual + revisado)

Reavalia parseLinha on-render (memoized). Quando alerta_ativo && alerta=erro,
acende border-destructive + AlertTriangle + 'calculado: X' + botao
'Alerta revisado'. Auto-fill on blur quando '1+1=' sem RHS. Estado
'revisado' (pos-click) mostra checkmark muted, sem cor de erro."
```

---

## Task 7: Components `CalculoToolbar` + `HistoricoCalculoDrawer`

**Files:**
- Create: `src/modules/engenharia/components/CalculoToolbar.tsx`
- Create: `src/modules/engenharia/components/HistoricoCalculoDrawer.tsx`

### CalculoToolbar

```tsx
interface CalculoToolbarProps {
  alertaAtivo: boolean;
  onToggleAlerta: (novo: boolean) => void;
  onSalvar: () => void;
  onAbrirHistorico: () => void;
  onAdicionarLinha: () => void;
  desabilitado: boolean;
  salvando: boolean;
  podeVerHistorico: boolean;
}
```

- Linha horizontal `flex items-center gap-3 border-b border-border px-4 py-2`.
- shadcn `<Switch>` com label "Verificação automática" — controlado por `alertaAtivo`, `onCheckedChange={onToggleAlerta}`. Tooltip/aria-label explicando: "Liga ou desliga a comparação RHS=LHS. O parser continua resolvendo `=` vazio."
- Botão "Adicionar linha" (variant="ghost" size="sm") chama `onAdicionarLinha`.
- Botão "Salvar" (default variant size="sm" com title="Salvar (Cmd+S)"), `disabled={desabilitado || salvando}`, texto vira "Salvando…" quando `salvando=true`.
- Botão "Histórico" (variant="ghost") só renderiza se `podeVerHistorico`.
- Quando `desabilitado=true` o `<Switch>` é `disabled` mas ainda exibe estado atual (read-only).

### HistoricoCalculoDrawer

```tsx
interface HistoricoCalculoDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calculoId: string;
  calculoAtual: EngenhariaCalculo;
  ehReadOnly: boolean;
}
```

Estrutura idêntica ao `HistoricoVersoesDrawer` da Onda 4, com 3 diferenças:
1. Hook: `useCalculoVersoes(calculoId)` e `useRestaurarVersaoCalculo()`.
2. Preview: helper `extrairTextoCalculo(doc: DocumentoCalculo): string` que concatena `linhas.map(l => l.expressao).join('\n')` e limita a ~120 chars com `…`.
3. Restaurar: passa `{ calculoId, versaoAlvo, versaoAtual: calculoAtual.versao, tituloAtual: calculoAtual.titulo, alertaAtivoAtual: calculoAtual.alertaAtivo }`.

`extrairTextoCalculo` mora dentro do próprio `HistoricoCalculoDrawer.tsx` (não é compartilhado).

- [ ] **Step 1: Implementar os 2 componentes.** (Especs funcionais acima; padrões shadcn + tokens do projeto.)

- [ ] **Step 2: Build + commit**

```bash
npx tsc -b
git add src/modules/engenharia/components/CalculoToolbar.tsx src/modules/engenharia/components/HistoricoCalculoDrawer.tsx
git commit -m "feat(engenharia): CalculoToolbar + HistoricoCalculoDrawer

CalculoToolbar: switch verificacao + adicionar linha + Salvar + Historico
(gated). Switch fica disabled em readOnly mas mostra o estado atual.

HistoricoCalculoDrawer espelha o HistoricoVersoesDrawer da Onda 4 com 3
ajustes: usa useCalculoVersoes/useRestaurarVersaoCalculo, preview via
extrairTextoCalculo (linhas join '\\n'), restaurar passa alertaAtivoAtual."
```

---

## Task 8: Page `CalculoPage` + auto-save + integração lock

**Files:**
- Create: `src/modules/engenharia/pages/CalculoPage.tsx`

- [ ] **Step 1: Implementar**

```tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { Skeleton } from '@/components/shadcn/skeleton';
import { Input } from '@/components/shadcn/input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { useLockRecurso } from '../hooks/useLockRecurso';
import { useEngenhariaCalculo, useSalvarCalculo } from '../hooks/useEngenhariaCalculos';
import { LinhaCalculo as LinhaCalculoComp } from '../components/LinhaCalculo';
import { CalculoToolbar } from '../components/CalculoToolbar';
import { LockBanner } from '../components/LockBanner';
import { HistoricoCalculoDrawer } from '../components/HistoricoCalculoDrawer';
import { novaLinhaVazia, type DocumentoCalculo, type EngenhariaCalculo, type LinhaCalculo } from '../types/calculo';

const AUTO_SAVE_DEBOUNCE_MS = 5_000;

export default function CalculoPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { temAcao } = useAuth();
  const { showToast } = useToast();
  const qc = useQueryClient();

  const [titulo, setTitulo] = useState('');
  const [linhas, setLinhas] = useState<LinhaCalculo[]>([]);
  const [alertaAtivo, setAlertaAtivo] = useState(true);
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [erroEhConflito, setErroEhConflito] = useState(false);
  /** IDs de linhas que o user marcou como "revisado" (esta sessão). */
  const [revisadas, setRevisadas] = useState<Set<string>>(new Set());
  const dirtyRef = useRef(false);
  const debounceRef = useRef<number | null>(null);

  const lock = useLockRecurso('calculo', id ?? null);
  const { data: calculo, isLoading } = useEngenhariaCalculo(id ?? '');
  const salvarMutation = useSalvarCalculo();

  const ehDono = lock.status === 'meu';
  const podeEditar = temAcao('editar_engenharia_calculo');
  const readOnly = !podeEditar || !ehDono;

  // Hidrata estado local quando calculo chega/troca
  useEffect(() => {
    if (calculo) {
      setTitulo(calculo.titulo);
      setLinhas(calculo.documento.linhas.length > 0 ? calculo.documento.linhas : [novaLinhaVazia(0)]);
      setAlertaAtivo(calculo.alertaAtivo);
      setRevisadas(new Set());  // reset ao trocar de calculo
      dirtyRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculo?.id]);

  const salvar = useCallback(async () => {
    if (!calculo || readOnly || salvando) return;
    setSalvando(true);
    setErroSalvar(null);
    setErroEhConflito(false);
    const documento: DocumentoCalculo = { linhas };
    const result = await salvarMutation.mutateAsync({
      id: calculo.id,
      titulo,
      documento,
      alertaAtivo,
      versaoAtual: calculo.versao,
    });
    setSalvando(false);
    if (!result.ok) {
      const ehConflito = result.motivo === 'conflito_versao';
      setErroEhConflito(ehConflito);
      setErroSalvar(
        ehConflito
          ? 'Outro usuário salvou no meio. Recarregue para ver as mudanças.'
          : `Falha ao salvar: ${result.motivo}`,
      );
    } else {
      dirtyRef.current = false;
    }
  }, [calculo, readOnly, salvando, salvarMutation, titulo, linhas, alertaAtivo]);

  // Auto-save debounce
  useEffect(() => {
    if (!dirtyRef.current || readOnly) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => { void salvar(); }, AUTO_SAVE_DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [titulo, linhas, alertaAtivo, readOnly, salvar]);

  // Cmd/Ctrl+S
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        if (readOnly) return;
        e.preventDefault();
        void salvar();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [salvar, readOnly]);

  const onForcarLiberacao = temAcao('gerenciar_locks_engenharia') && id
    ? async () => {
        const { error } = await supabase
          .from('engenharia_locks')
          .delete()
          .eq('recurso_tipo', 'calculo')
          .eq('recurso_id', id);
        if (error) showToast({ kind: 'error', message: `Falha ao liberar lock: ${error.message}` });
        else showToast({ kind: 'success', message: 'Lock liberado. Tente editar agora.' });
      }
    : undefined;

  function handleLinhaChange(atualizada: LinhaCalculo) {
    setLinhas((prev) => prev.map((l) => (l.id === atualizada.id ? atualizada : l)));
    dirtyRef.current = true;
    // Mudar a expressao limpa o estado "revisado" da linha
    setRevisadas((prev) => {
      if (!prev.has(atualizada.id)) return prev;
      const next = new Set(prev);
      next.delete(atualizada.id);
      return next;
    });
  }

  function handleRevisado(linhaId: string) {
    setRevisadas((prev) => new Set(prev).add(linhaId));
    // Persistir o estado 'revisado' na linha também
    setLinhas((prev) => prev.map((l) => (l.id === linhaId ? { ...l, alerta: 'revisado' as const } : l)));
    dirtyRef.current = true;
  }

  function handleAdicionarLinha() {
    setLinhas((prev) => [...prev, novaLinhaVazia(prev.length)]);
    dirtyRef.current = true;
  }

  function handleToggleAlerta(novo: boolean) {
    setAlertaAtivo(novo);
    dirtyRef.current = true;
  }

  async function handleRecarregar() {
    if (!id) return;
    await qc.refetchQueries({ queryKey: ['engenharia', 'calculos', 'item', id] });
    const fresh = qc.getQueryData<EngenhariaCalculo>(['engenharia', 'calculos', 'item', id]);
    if (fresh) {
      setTitulo(fresh.titulo);
      setLinhas(fresh.documento.linhas.length > 0 ? fresh.documento.linhas : [novaLinhaVazia(0)]);
      setAlertaAtivo(fresh.alertaAtivo);
      setRevisadas(new Set());
      dirtyRef.current = false;
    }
    setErroSalvar(null);
    setErroEhConflito(false);
  }

  if (isLoading || !calculo || !id) {
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
      <header className="flex items-center gap-3 border-b border-border px-4 py-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input
          value={titulo}
          onChange={(e) => { setTitulo(e.target.value); dirtyRef.current = true; }}
          disabled={readOnly}
          className="text-lg font-medium border-none shadow-none focus-visible:ring-0 px-2"
          placeholder="Título do cálculo"
        />
        <span
          aria-live="polite"
          aria-atomic="true"
          className="text-xs text-muted-foreground min-w-[60px] text-right"
        >
          {salvando ? 'Salvando…' : (!dirtyRef.current ? 'Salvo' : '')}
        </span>
      </header>

      <LockBanner estado={lock} onForcarLiberacao={onForcarLiberacao} />

      {erroSalvar && (
        <div className="flex items-center gap-3 bg-destructive/10 text-destructive px-4 py-2 text-sm">
          <span className="flex-1">{erroSalvar}</span>
          {erroEhConflito && (
            <Button size="xs" variant="outline" onClick={handleRecarregar}>
              Recarregar
            </Button>
          )}
        </div>
      )}

      <CalculoToolbar
        alertaAtivo={alertaAtivo}
        onToggleAlerta={handleToggleAlerta}
        onSalvar={() => void salvar()}
        onAbrirHistorico={() => setHistoricoOpen(true)}
        onAdicionarLinha={handleAdicionarLinha}
        desabilitado={readOnly}
        salvando={salvando}
        podeVerHistorico={temAcao('ver_historico_engenharia')}
      />

      <main className="flex-1 overflow-y-auto max-w-4xl mx-auto w-full p-4 space-y-1">
        {linhas.map((l) => (
          <LinhaCalculoComp
            key={l.id}
            linha={l}
            alertaAtivo={alertaAtivo}
            readOnly={readOnly}
            onChange={handleLinhaChange}
            onRevisado={handleRevisado}
            marcadaRevisada={revisadas.has(l.id) || l.alerta === 'revisado'}
          />
        ))}
      </main>

      {temAcao('ver_historico_engenharia') && (
        <HistoricoCalculoDrawer
          open={historicoOpen}
          onOpenChange={setHistoricoOpen}
          calculoId={calculo.id}
          calculoAtual={calculo}
          ehReadOnly={readOnly}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build + commit**

```bash
npx tsc -b
git add src/modules/engenharia/pages/CalculoPage.tsx
git commit -m "feat(engenharia): CalculoPage (canvas de linhas + lock + auto-save + historico)

Composes useLockRecurso('calculo', id), useEngenhariaCalculo, useSalvarCalculo,
CalculoToolbar, LinhaCalculo (lista), LockBanner, HistoricoCalculoDrawer.

Auto-save 5s debounce + Cmd/Ctrl+S manual. Mudar expressao de uma linha
limpa o estado 'revisado' dessa linha (intencional — se a expressao
mudou, a revisao anterior ja nao se aplica). Botao Recarregar no erro
'conflito_versao' invalida + resync local (igual NotaPage)."
```

---

## Task 9: Rota + wire em PastaPage + Playwright E2E

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/modules/engenharia/pages/PastaPage.tsx`
- Create: `tests/engenharia-calculos.spec.ts`

- [ ] **Step 1: Adicionar lazy import + rota em `App.tsx`**

Alinhar com o pattern existente das rotas `/engenharia/*`. Adicionar logo após `NotaEngenhariaPage`:

```tsx
const CalculoEngenhariaPage = lazy(() => import('./modules/engenharia/pages/CalculoPage'));
```

E após a rota `/engenharia/nota/:id`:

```tsx
<Route
  path="/engenharia/calculo/:id"
  element={
    <ProtectedRoute acao="ver_engenharia">
      <Suspense fallback={<div className="p-8 text-center text-[var(--color-fg-muted)]">Carregando…</div>}>
        <CalculoEngenhariaPage />
      </Suspense>
    </ProtectedRoute>
  }
/>
```

- [ ] **Step 2: Wire dropdown "Cálculo" em `PastaPage.tsx`**

Substituir o `<DropdownMenuItem disabled>` que diz "Cálculo (Onda 5)" por:

```tsx
{temAcao('criar_engenharia_calculo') && (
  <DropdownMenuItem
    disabled={criarCalculo.isPending}
    onClick={async () => {
      try {
        const calc = await criarCalculo.mutateAsync({ pastaId: pasta.id, titulo: 'Novo cálculo' });
        navigate(`/engenharia/calculo/${calc.id}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'erro desconhecido';
        showToast({ kind: 'error', message: `Falha ao criar cálculo: ${msg}` });
      }
    }}
  >
    <Calculator className="mr-2 h-4 w-4" /> Cálculo
  </DropdownMenuItem>
)}
```

Adicionar `import { useCriarCalculo } from '../hooks/useEngenhariaCalculos';` e `const criarCalculo = useCriarCalculo();` no topo do componente (próximo ao `useCriarNota`).

- [ ] **Step 3: Implementar Playwright E2E em `tests/engenharia-calculos.spec.ts`**

```ts
import { test, expect } from '@playwright/test';
import { hasCredentials, login } from './_fixtures';

test.describe('Engenharia — Cálculos', () => {
  test.skip(!hasCredentials(), 'E2E_TEST_EMAIL / E2E_TEST_PASSWORD não setados');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('cria cálculo a partir de pasta de obra → abre editor', async ({ page }) => {
    await page.goto('/engenharia');
    const obrasSection = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Obras', level: 2 }),
    });
    await obrasSection.getByRole('button', { name: /Abrir pasta/i }).first().click();
    await expect(page).toHaveURL(/\/engenharia\/pasta\//);
    await page.getByRole('button', { name: /^Novo$/i }).click();
    await page.getByRole('menuitem', { name: /^Cálculo$/i }).click();
    await expect(page).toHaveURL(/\/engenharia\/calculo\//, { timeout: 10_000 });
    await expect(page.getByPlaceholder('Título do cálculo')).toBeVisible();
  });

  test('1+1= preenche resultado 2', async ({ page }) => {
    await page.goto('/engenharia');
    const obrasSection = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Obras', level: 2 }),
    });
    await obrasSection.getByRole('button', { name: /Abrir pasta/i }).first().click();
    await page.getByRole('button', { name: /^Novo$/i }).click();
    await page.getByRole('menuitem', { name: /^Cálculo$/i }).click();
    await expect(page).toHaveURL(/\/engenharia\/calculo\//, { timeout: 10_000 });

    const primeiraLinha = page.getByPlaceholder('Digite uma expressão (ex: 1+1=)').first();
    await primeiraLinha.fill('1+1=');
    await primeiraLinha.blur();
    await expect(primeiraLinha).toHaveValue('1+1=2');
  });

  test('2*5=11 acende alerta vermelho com calculado=10', async ({ page }) => {
    await page.goto('/engenharia');
    const obrasSection = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Obras', level: 2 }),
    });
    await obrasSection.getByRole('button', { name: /Abrir pasta/i }).first().click();
    await page.getByRole('button', { name: /^Novo$/i }).click();
    await page.getByRole('menuitem', { name: /^Cálculo$/i }).click();
    await expect(page).toHaveURL(/\/engenharia\/calculo\//, { timeout: 10_000 });

    const primeiraLinha = page.getByPlaceholder('Digite uma expressão (ex: 1+1=)').first();
    await primeiraLinha.fill('2*5=11');
    await expect(page.getByText('calculado: 10')).toBeVisible();
    await expect(page.getByRole('button', { name: /Alerta revisado/i })).toBeVisible();
  });

  test('clicar Alerta revisado limpa o vermelho, valor persiste', async ({ page }) => {
    await page.goto('/engenharia');
    const obrasSection = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Obras', level: 2 }),
    });
    await obrasSection.getByRole('button', { name: /Abrir pasta/i }).first().click();
    await page.getByRole('button', { name: /^Novo$/i }).click();
    await page.getByRole('menuitem', { name: /^Cálculo$/i }).click();
    await expect(page).toHaveURL(/\/engenharia\/calculo\//, { timeout: 10_000 });

    const primeiraLinha = page.getByPlaceholder('Digite uma expressão (ex: 1+1=)').first();
    await primeiraLinha.fill('2*5=11');
    await page.getByRole('button', { name: /Alerta revisado/i }).click();
    await expect(page.getByRole('button', { name: /Alerta revisado/i })).not.toBeVisible();
    await expect(primeiraLinha).toHaveValue('2*5=11');
  });

  test('desligar verificação tira o vermelho', async ({ page }) => {
    await page.goto('/engenharia');
    const obrasSection = page.locator('section').filter({
      has: page.getByRole('heading', { name: 'Obras', level: 2 }),
    });
    await obrasSection.getByRole('button', { name: /Abrir pasta/i }).first().click();
    await page.getByRole('button', { name: /^Novo$/i }).click();
    await page.getByRole('menuitem', { name: /^Cálculo$/i }).click();
    await expect(page).toHaveURL(/\/engenharia\/calculo\//, { timeout: 10_000 });

    const primeiraLinha = page.getByPlaceholder('Digite uma expressão (ex: 1+1=)').first();
    await primeiraLinha.fill('2*5=99');
    await expect(page.getByText('calculado: 10')).toBeVisible();
    await page.getByRole('switch', { name: /Verificação automática/i }).click();
    await expect(page.getByText('calculado: 10')).not.toBeVisible();
  });

  test('lock 2 usuarios — SKIPPED até fixture Onda 8', async () => {
    test.skip(true, 'TODO: requires 2 distinct test users — Onda 8');
  });
});
```

- [ ] **Step 4: Build + commit**

```bash
npx tsc -b
git add src/App.tsx src/modules/engenharia/pages/PastaPage.tsx tests/engenharia-calculos.spec.ts
git commit -m "feat(engenharia): rota /engenharia/calculo/:id + wire PastaPage + E2E

Rota lazy + ProtectedRoute(ver_engenharia). Dropdown 'Cálculo' de PastaPage
agora cria + navega (era disabled). Hidden quando !temAcao(criar_engenharia_calculo).

5 cenarios Playwright dos criterios 5.5 do prompt: cria+abre / 1+1= preenche
/ 2*5=11 alerta vermelho / Alerta revisado limpa / desligar switch tira.
Lock 2-usuarios SKIPPED ate fixture Onda 8."
```

---

## Task 10: Verificação + CHANGELOG + plano-mestre

- [ ] **Step 1: Suite completa**

```bash
npx vitest run src/modules/engenharia/
npx tsc -b
npm run build
```

Esperado:
- Vitest: 34 (Onda 4) + 13 (calcEngine) = **47+ verdes**.
- tsc: 0 erros.
- build: chunk lazy separado para `CalculoPage` (~150 KB gzip incluindo mathjs).

- [ ] **Step 2: `get_advisors security`**

`mcp__plugin_supabase_supabase__get_advisors type='security'`. Grep `engenharia_salvar_calculo_com_versao`. Esperado: 1 WARN "Signed-In Users Can Execute SECURITY DEFINER" (igual o `salvar_nota`). Documentar.

- [ ] **Step 3: Atualizar `docs/modulos/engenharia/CHANGELOG.md`**

Apêndice `## Onda 5 — Bloco de Cálculo, parte 1: parser, linhas, alerta (2026-05-27)` com:
- 1 migration (function `engenharia_salvar_calculo_com_versao` atômica).
- 1 package npm (`mathjs@14`, ~150 KB).
- 4 types em `types/calculo.ts` (EngenhariaCalculo + EngenhariaCalculoVersao + LinhaCalculo + DocumentoCalculo).
- 1 service `calcEngine.ts` (evalSafe sandbox + parseLinha) + 13 Vitest.
- 2 hooks files (useEngenhariaCalculos, useCalculoVersoes).
- 3 components (LinhaCalculo, CalculoToolbar, HistoricoCalculoDrawer).
- 1 page (CalculoPage).
- 1 rota + wire dropdown "Cálculo".
- 1 Playwright spec (5 ativos + 1 skipped lock 2-usuarios).
- Nota: prompt original tinha critério `2*5=20 → ok` matematicamente errado; seguimos a regra real (RHS=LHS computado).

- [ ] **Step 4: Marcar Onda 5 done no plano-mestre.**

No `docs/superpowers/plans/2026-05-26-engenharia-modulo.md` substituir o cabeçalho da seção 5 e o placeholder de plano TDD:

```
### Onda 5 — Bloco de Cálculo, parte 1: parser, linhas, alerta (10–16h) ✅ CONCLUÍDA 2026-05-27

**Plano TDD próprio:** [`2026-05-27-engenharia-onda-5-calculo-parser.md`](2026-05-27-engenharia-onda-5-calculo-parser.md) — 10 tasks (Tasks 1-5 inline, Tasks 6-9 via subagent com 2-stage review, Task 10 inline).

**CHANGELOG:** [`docs/modulos/engenharia/CHANGELOG.md`](../../modulos/engenharia/CHANGELOG.md#onda-5--bloco-de-calculo-parte-1-parser-linhas-alerta-2026-05-27).
```

- [ ] **Step 5: Commit final.**

```bash
git add docs/modulos/engenharia/CHANGELOG.md docs/superpowers/plans/2026-05-26-engenharia-modulo.md
git commit -m "docs(engenharia): CHANGELOG Onda 5 + marca concluida no plano-mestre

Bloco de calculo parte 1 fechada: parser sandboxed + canvas de linhas +
alerta visual + switch verificacao + auto-save + historico.

Hard stop antes da Onda 6 (variaveis + spinner + grid) conforme prompt
original. Apresentar ao user para aprovacao."
```

---

## Self-Review

**Spec coverage (prompt original 5.5):**
- ✅ `1+1=` resolve → Task 6 LinhaCalculo handleBlurAutoFill + Task 9 Playwright #2
- ⚠ `2*5=20 → ok`: prompt errado (5*2=10, não 20). Vitest documenta a divergência (Task 3 teste 4); Playwright pula esse exemplo e usa `2*10=20` se quiser testar match.
- ✅ `2*5=11` vermelho + ⚠ → Task 6 mostrarErro + Task 9 #3
- ✅ Botão "Alerta revisado" → Task 6 onRevisado + Task 9 #4
- ✅ Desligar switch tira vermelho → Task 7 CalculoToolbar + Task 9 #5
- ✅ Sandbox math.js (`import("foo")` throw + `createUnit` throw) → Task 3 testes 2 e 3

**Spec coverage (master plan onda 5):**
- ✅ Lib mathjs com sandbox → Task 2 + Task 3
- ✅ Rota `/engenharia/calculo/:id` lazy → Task 9
- ✅ CalculoPage com canvas + barra superior + título + switch + histórico → Tasks 7, 8
- ✅ `documento_json` shape: `{ linhas: [{ id, expressao, resultado, alerta, ordem }] }` → Task 4
- ✅ Auto-save + versionamento atômico → Tasks 1 + 5 + 8
- ✅ Lock pessimista reusado via `useLockRecurso('calculo', id)` → Task 8

**Placeholders:** O `extrairTextoCalculo` em HistoricoCalculoDrawer está definido funcionalmente mas não como código — é trivial (1 linha de `join`), implementador escreve direto. Nenhum TODO remanescente.

**Type consistency:**
- `SalvarCalculoResult` discriminada via `ok`.
- `AlertaLinha = 'ok' | 'erro' | 'revisado' | 'vazio'` consistente entre `calcEngine.ts`, `types/calculo.ts`, `LinhaCalculo`.
- `DocumentoCalculo.linhas` sempre array (mappers e novaLinhaVazia garantem).
- `engenharia_salvar_calculo_com_versao` retorna `{ ok, nova_versao, motivo }` — hook traduz pra `SalvarCalculoResult`.

**Granularidade:** 10 tasks, 2-4 steps cada, 1 checkpoint (Task 1 apply migration confirmado pelo user).

---

## Critério de "Onda 5 pronta"

- [ ] Function SECDEF aplicada + smoke test SQL OK.
- [ ] `mathjs@14` instalado, ~150 KB no chunk lazy de calculo.
- [ ] `calcEngine.ts` com 13 testes Vitest verdes (sandbox + parser).
- [ ] 4 tipos + mappers; 2 hooks; 3 components; 1 page novos.
- [ ] Rota `/engenharia/calculo/:id` ativa.
- [ ] Wire em PastaPage para criar+navegar cálculo.
- [ ] 5+ Playwright tests verdes (1 skipped lock 2-usuarios).
- [ ] `npx tsc -b` 0 erros em escopo Engenharia.
- [ ] `get_advisors security` sem novos issues além do esperado.
- [ ] CHANGELOG + plano-mestre atualizados.

---

## ⛔ Hard Stop antes da Onda 6

Do prompt original seção 5: "**Pare aqui. Faça commit. Mostre ao usuário. Só siga para 5.6 se aprovado.**"

A Onda 6 (variáveis + spinner + grid Excel + palavras reservadas) começa só com aprovação explícita do user depois desta onda fechada.

---

## Execution Handoff

**Plano salvo em `docs/superpowers/plans/2026-05-27-engenharia-onda-5-calculo-parser.md`.**

Pattern recomendado: **Tasks 1-5 inline** (migration + lib + service+test + types + hooks), **Tasks 6-9 via subagent** com 2-stage review por task (UI components + page + rota+wire+E2E), **Task 10 inline** (verificação + docs).

Pronto pra executar?
