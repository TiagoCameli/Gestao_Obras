# Engenharia Onda 6a — Bloco de Cálculo: variáveis (numéricas + string + aliases + reservadas)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans. Steps usam checkbox (`- [ ]`).

**Goal:** Estender o bloco de cálculo (Onda 5) para suportar **variáveis nomeadas com escopo por bloco e reavaliação em cascade**: `x = 2*2` define `x=4`; `x*2=` resolve `8`; `"Brita 4" = 110` define variável string referenciável como `brita4`/`Brita 4`/`BRITA 4`; nomes que colidem com funções do math.js (`sin`, `log10`...) são rejeitados com erro inline. Entrega o **cenário canônico**: `x=4`, `y=3`, `"Brita 4"=110`, `x+y+brita4=` → `117`.

**Architecture:** A avaliação deixa de ser por-linha (Onda 5) e passa a ser **document-level**: `recalcularDocumento(linhas)` processa as linhas em ordem, mantém um `scope` cumulativo, detecta atribuições (`nome = expr`) vs avaliações (`expr =`), registra aliases de variáveis string, substitui aliases nas expressões (greedy longest-match) antes de chamar `evalSafe`, e devolve `LinhaAvaliada[]` (resultado + alerta + tipo + var definida por linha). `LinhaCalculo` deixa de chamar `parseLinha` sozinho e passa a receber a `LinhaAvaliada` já computada pelo pai. `CalculoPage` memoiza `recalcularDocumento(linhas)` e persiste resultado/alerta derivados. Palavras reservadas vêm de `calcReservedWords.ts`.

**Tech Stack:** Reusa math.js sandboxed (`evalSafe` da Onda 5). **Zero libs novas.** Vitest pesado na engine; Playwright pros cenários canônicos.

**Spec:** Master plan [`2026-05-26-engenharia-modulo.md`](2026-05-26-engenharia-modulo.md) Onda 6 sub-fases 6.1+6.2 + critérios 6.8 (variáveis + reservadas). Spinner (6.3), caixas de texto (6.4) e grid (6.5) ficam para ondas 6b/6c/6d (NÃO neste plano).

**Dependências:**
- Onda 5: `calcEngine.ts` (`evalSafe`, `parseLinha`, `AlertaLinha`), `types/calculo.ts` (`LinhaCalculo`, `DocumentoCalculo`, `novaLinhaVazia`), `LinhaCalculo.tsx`, `CalculoPage.tsx`, hooks de cálculo, function SECDEF de save.

---

## Decisões de design (travadas para este plano)

1. **Atribuição vs avaliação — regra de detecção:**
   - **Atribuição** quando o LHS (texto antes do 1º `=`) é, após trim, **um identificador simples** (`/^[a-zA-Z_][a-zA-Z0-9_]*$/`) OU **uma string entre aspas** (`/^"[^"]+"$/`), E o RHS (depois do `=`) é não-vazio. Ex: `x = 2*2`, `"Brita 4" = 110`.
   - **Avaliação** caso contrário: LHS composto (`x*2`, `2*5`) com `=` no fim (RHS vazio) ou com valor pra conferir (`2*5=11`). Comportamento idêntico ao da Onda 5, mas avaliando no `scope` cumulativo.
   - `x = 4` é **atribuição** (define x=4), NÃO avaliação. (LHS `x` é identificador simples.)

2. **Scope cumulativo, ordem de cima pra baixo.** Variável usada antes de ser definida → erro (`indefinida`). Redefinição sobrescreve a partir da linha de redefinição (cascade só pra frente).

3. **Variáveis string (`"Brita 4" = 110`):**
   - Normalização do nome: `lowercase` + `trim` + colapsar espaços internos → forma canônica `brita 4`.
   - Chave segura no scope do math.js: `__sv_` + canônica com não-alfanuméricos viram `_` → `__sv_brita_4`. (math.js só aceita identificadores simples.)
   - `scope['__sv_brita_4'] = 110`.
   - **Aliases referenciáveis:** a forma canônica COM espaço (`brita 4`) e SEM espaço (`brita4`), case-insensitive. Substituição greedy longest-match antes de avaliar.

4. **Palavras reservadas (D-6):** bloquear definição de variável (num OU string) cujo nome normalizado ∈ lista. Erro inline `alerta='erro'` + `erroEngine` mencionando que é reservada. Lista em `calcReservedWords.ts`. NÃO bloquear uso da função (ex: `sin(x)=` continua funcionando) — só bloquear DEFINIR `sin = 5`.

5. **`recalcularDocumento` é puro** (sem efeitos, sem React). Recebe `LinhaCalculo[]`, devolve `LinhaAvaliada[]`. Testável isoladamente. `CalculoPage` memoiza.

6. **`LinhaCalculo` vira apresentacional:** recebe `avaliada: LinhaAvaliada` (não chama `parseLinha`). Input continua controlado em `linha.expressao`. Ghost/erro/checkmark usam campos da `avaliada`.

---

## File Structure

**Create:**
- `src/modules/engenharia/services/calcReservedWords.ts` — `PALAVRAS_RESERVADAS` + `ehReservada`.
- `src/modules/engenharia/services/calcReservedWords.test.ts` — Vitest.
- `src/modules/engenharia/services/calcDocumento.ts` — `recalcularDocumento` + tipos `LinhaAvaliada` + helpers de alias.
- `src/modules/engenharia/services/calcDocumento.test.ts` — Vitest (núcleo da onda).

**Modify:**
- `src/modules/engenharia/components/LinhaCalculo.tsx` — passa a receber `avaliada: LinhaAvaliada`; remove `parseLinha` interno.
- `src/modules/engenharia/pages/CalculoPage.tsx` — memoiza `recalcularDocumento(linhas)`, passa `avaliada` por linha, persiste resultado/alerta derivados.
- `tests/engenharia-calculos.spec.ts` — +cenários de variáveis (canônico + reservada).

---

## Task 1: `calcReservedWords.ts` + testes

**Files:**
- Create: `src/modules/engenharia/services/calcReservedWords.ts`
- Create: `src/modules/engenharia/services/calcReservedWords.test.ts`

- [ ] **Step 1: Implementar `calcReservedWords.ts`**

```ts
// Palavras reservadas: nomes que colidem com funções/constantes do math.js.
// Definir uma variável com esses nomes mascara a função (ex: `"sin" = 5` quebraria
// `sin(x)`), então bloqueamos a DEFINIÇÃO (não o uso da função). Decisão D-6.
export const PALAVRAS_RESERVADAS: ReadonlySet<string> = new Set([
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
  'log', 'ln', 'log10', 'log2', 'exp', 'sqrt', 'abs',
  'min', 'max', 'sum', 'mean', 'median', 'std',
  'floor', 'ceil', 'round', 'pi', 'e', 'i',
  'true', 'false', 'null', 'nan', 'infinity',
  'mod', 'gcd', 'lcm', 'sign',
]);

/** Normaliza um nome de variável para comparação (lowercase + trim + colapsa espaços). */
export function normalizarNome(nome: string): string {
  return nome.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Uma variável é reservada se seu nome normalizado (sem espaços, pois funções
 * math.js não têm espaço) bater com a lista. Para nomes string com espaço
 * (`"Brita 4"`), nunca colidem (têm espaço), então retornam false.
 */
export function ehReservada(nome: string): boolean {
  const norm = normalizarNome(nome);
  return PALAVRAS_RESERVADAS.has(norm);
}
```

- [ ] **Step 2: Testes `calcReservedWords.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { ehReservada, normalizarNome, PALAVRAS_RESERVADAS } from './calcReservedWords';

describe('calcReservedWords', () => {
  it('reconhece funções math.js como reservadas', () => {
    expect(ehReservada('sin')).toBe(true);
    expect(ehReservada('log10')).toBe(true);
    expect(ehReservada('sqrt')).toBe(true);
    expect(ehReservada('pi')).toBe(true);
  });

  it('case-insensitive', () => {
    expect(ehReservada('SIN')).toBe(true);
    expect(ehReservada('Log10')).toBe(true);
  });

  it('nomes de usuário comuns NÃO são reservados', () => {
    expect(ehReservada('x')).toBe(false);
    expect(ehReservada('viga_principal')).toBe(false);
    expect(ehReservada('brita4')).toBe(false);
    expect(ehReservada('Brita 4')).toBe(false);  // tem espaço, nunca reservada
  });

  it('normalizarNome colapsa espaços e baixa caixa', () => {
    expect(normalizarNome('  Brita   4 ')).toBe('brita 4');
    expect(normalizarNome('VIGA')).toBe('viga');
  });

  it('lista tem ao menos 30 entradas', () => {
    expect(PALAVRAS_RESERVADAS.size).toBeGreaterThanOrEqual(30);
  });
});
```

- [ ] **Step 3: Rodar + commit**

```bash
npx vitest run src/modules/engenharia/services/calcReservedWords.test.ts
git add src/modules/engenharia/services/calcReservedWords.ts src/modules/engenharia/services/calcReservedWords.test.ts
git commit -m "feat(engenharia): calcReservedWords (palavras reservadas math.js + ehReservada)

Lista de 36 nomes de funcoes/constantes math.js que nao podem virar nome
de variavel (D-6). normalizarNome (lowercase+trim+colapsa espacos) +
ehReservada. Nomes com espaco (string vars) nunca colidem."
```

---

## Task 2: `calcDocumento.ts` — `recalcularDocumento` (núcleo)

**Files:**
- Create: `src/modules/engenharia/services/calcDocumento.ts`

**Por quê:** é o coração da onda. Função pura que transforma `LinhaCalculo[]` em `LinhaAvaliada[]` mantendo scope cumulativo, atribuições, aliases string e cascade.

- [ ] **Step 1: Implementar `calcDocumento.ts`**

```ts
import { evalSafe, type AlertaLinha } from './calcEngine';
import { ehReservada, normalizarNome } from './calcReservedWords';
import type { LinhaCalculo } from '../types/calculo';

export type TipoLinha = 'atribuicao_num' | 'atribuicao_str' | 'avaliacao' | 'vazio';

export interface LinhaAvaliada {
  id: string;
  expressao: string;
  tipo: TipoLinha;
  /** Texto à esquerda do 1º `=` (trim). */
  lhs: string;
  /** Texto à direita do 1º `=` (trim), ou null se não há `=` / RHS vazio. */
  rhsUsuario: string | null;
  /** Resultado calculado (stringificado), ou null. */
  resultado: string | null;
  alerta: Exclude<AlertaLinha, 'revisado'>;  // 'revisado' é estado de UI, não da engine
  erroEngine?: string;
  /** Nome canônico da variável definida nesta linha (atribuições). */
  varDefinida?: string;
}

const RE_IDENT_SIMPLES = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const RE_STRING_LITERAL = /^"([^"]+)"$/;

interface AliasRegistrado {
  /** Forma canônica com espaços (ex: "brita 4"). */
  canonico: string;
  /** Chave segura no scope (ex: "__sv_brita_4"). */
  chaveScope: string;
}

/** Gera a chave de scope segura a partir do nome canônico. */
function chaveScopeDe(canonico: string): string {
  return '__sv_' + canonico.replace(/[^a-z0-9]/gi, '_');
}

function stringifyResultado(v: unknown): string {
  if (typeof v === 'number') {
    return Number.isInteger(v) ? v.toString() : Number(v.toFixed(10)).toString();
  }
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

function resultadosBatem(calc: string, user: string): boolean {
  const a = Number(calc);
  const b = Number(user);
  if (!Number.isNaN(a) && !Number.isNaN(b)) return Math.abs(a - b) < 1e-9;
  return calc.trim() === user.trim();
}

/**
 * Substitui aliases string na expressão por suas chaves de scope, greedy
 * longest-match (canônicos mais longos primeiro), case-insensitive, tolerando
 * espaços internos. Ex: com alias "brita 4" → chave "__sv_brita_4", a expressão
 * "x + brita4 + BRITA 4" vira "x + __sv_brita_4 + __sv_brita_4".
 */
export function substituirAliases(expr: string, aliases: AliasRegistrado[]): string {
  let out = expr;
  // Ordena por tamanho do canônico desc (longest-match)
  const ordenados = [...aliases].sort((a, b) => b.canonico.length - a.canonico.length);
  for (const a of ordenados) {
    // Padrão: as palavras do canônico separadas por \s* (tolera "brita4" e "brita 4")
    const partes = a.canonico.split(' ').map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const padrao = partes.join('\\s*');
    const re = new RegExp(padrao, 'gi');
    out = out.replace(re, a.chaveScope);
  }
  return out;
}

/** Classifica e parseia uma linha isolada (sem scope). */
function classificar(expressao: string): {
  tipo: TipoLinha;
  lhs: string;
  rhsUsuario: string | null;
  rhsExpr: string;        // RHS sem trim p/ avaliação de atribuição
  nomeVar?: string;       // identificador/string da atribuição
  ehString?: boolean;
} {
  const igualIdx = expressao.indexOf('=');
  if (igualIdx < 0) {
    return { tipo: 'vazio', lhs: expressao, rhsUsuario: null, rhsExpr: '' };
  }
  const lhs = expressao.slice(0, igualIdx).trim();
  const rhsRaw = expressao.slice(igualIdx + 1);
  const rhsTrim = rhsRaw.trim();
  const rhsUsuario = rhsTrim === '' ? null : rhsTrim;

  if (lhs === '') {
    return { tipo: 'vazio', lhs: '', rhsUsuario, rhsExpr: rhsRaw };
  }

  const mStr = lhs.match(RE_STRING_LITERAL);
  if (mStr && rhsUsuario !== null) {
    return { tipo: 'atribuicao_str', lhs, rhsUsuario, rhsExpr: rhsRaw, nomeVar: mStr[1], ehString: true };
  }
  if (RE_IDENT_SIMPLES.test(lhs) && rhsUsuario !== null) {
    return { tipo: 'atribuicao_num', lhs, rhsUsuario, rhsExpr: rhsRaw, nomeVar: lhs, ehString: false };
  }
  return { tipo: 'avaliacao', lhs, rhsUsuario, rhsExpr: rhsRaw };
}

/**
 * Avalia o documento inteiro em ordem, mantendo scope cumulativo + aliases.
 * Função pura. Não muta as linhas de entrada.
 */
export function recalcularDocumento(linhas: LinhaCalculo[]): LinhaAvaliada[] {
  const scope: Record<string, unknown> = {};
  const aliases: AliasRegistrado[] = [];
  const out: LinhaAvaliada[] = [];

  for (const linha of linhas) {
    const c = classificar(linha.expressao);
    const base = { id: linha.id, expressao: linha.expressao, lhs: c.lhs, rhsUsuario: c.rhsUsuario };

    if (c.tipo === 'vazio') {
      out.push({ ...base, tipo: 'vazio', resultado: null, alerta: 'vazio' });
      continue;
    }

    // Atribuições
    if (c.tipo === 'atribuicao_num' || c.tipo === 'atribuicao_str') {
      // Bloqueia palavra reservada
      if (ehReservada(c.nomeVar!)) {
        out.push({
          ...base, tipo: c.tipo, resultado: null, alerta: 'erro',
          erroEngine: `'${c.nomeVar}' é palavra reservada (função do math.js)`,
        });
        continue;
      }
      // Avalia o RHS (substituindo aliases já conhecidos)
      let valor: unknown;
      try {
        valor = evalSafe(substituirAliases(c.rhsExpr, aliases), scope);
      } catch (e) {
        out.push({
          ...base, tipo: c.tipo, resultado: null, alerta: 'erro',
          erroEngine: e instanceof Error ? e.message : 'erro de cálculo',
        });
        continue;
      }
      const resultado = stringifyResultado(valor);

      if (c.ehString) {
        const canonico = normalizarNome(c.nomeVar!);
        const chave = chaveScopeDe(canonico);
        scope[chave] = valor;
        // Re-registra (ou atualiza) alias
        if (!aliases.some((a) => a.canonico === canonico)) {
          aliases.push({ canonico, chaveScope: chave });
        }
        out.push({ ...base, tipo: 'atribuicao_str', resultado, alerta: 'ok', varDefinida: canonico });
      } else {
        scope[c.nomeVar!] = valor;
        out.push({ ...base, tipo: 'atribuicao_num', resultado, alerta: 'ok', varDefinida: c.nomeVar });
      }
      continue;
    }

    // Avaliação (expr= ou expr=valor)
    let valor: unknown;
    try {
      valor = evalSafe(substituirAliases(c.lhs, aliases), scope);
    } catch (e) {
      out.push({
        ...base, tipo: 'avaliacao', resultado: null, alerta: 'erro',
        erroEngine: e instanceof Error ? e.message : 'erro de cálculo',
      });
      continue;
    }
    const resultado = stringifyResultado(valor);

    if (c.rhsUsuario === null) {
      out.push({ ...base, tipo: 'avaliacao', resultado, alerta: 'ok' });
    } else if (resultadosBatem(resultado, c.rhsUsuario)) {
      out.push({ ...base, tipo: 'avaliacao', resultado, alerta: 'ok' });
    } else {
      out.push({ ...base, tipo: 'avaliacao', resultado, alerta: 'erro' });
    }
  }

  return out;
}
```

- [ ] **Step 2: Build**

```bash
npx tsc -b
```

Esperado: 0 erros. (Sem commit ainda — testes vêm na Task 3, commitamos juntos.)

---

## Task 3: Testes de `calcDocumento` (núcleo da onda)

**Files:**
- Create: `src/modules/engenharia/services/calcDocumento.test.ts`

- [ ] **Step 1: Implementar testes**

```ts
import { describe, it, expect } from 'vitest';
import { recalcularDocumento, substituirAliases } from './calcDocumento';
import type { LinhaCalculo } from '../types/calculo';

let _id = 0;
function L(expressao: string): LinhaCalculo {
  return { id: `l${_id++}`, expressao, resultado: null, alerta: 'vazio', ordem: 0 };
}
function docFrom(...exprs: string[]) {
  return recalcularDocumento(exprs.map(L));
}

describe('recalcularDocumento — variáveis numéricas', () => {
  it('x=4 define x (atribuicao_num)', () => {
    const [a] = docFrom('x=4');
    expect(a.tipo).toBe('atribuicao_num');
    expect(a.varDefinida).toBe('x');
    expect(a.resultado).toBe('4');
    expect(a.alerta).toBe('ok');
  });

  it('x=2*2 depois x*2= → 8 (cascade)', () => {
    const r = docFrom('x=2*2', 'x*2=');
    expect(r[0].resultado).toBe('4');
    expect(r[1].tipo).toBe('avaliacao');
    expect(r[1].resultado).toBe('8');
    expect(r[1].alerta).toBe('ok');
  });

  it('variável usada antes de definida → erro', () => {
    const r = docFrom('y*2=');
    expect(r[0].alerta).toBe('erro');
    expect(r[0].erroEngine).toBeTruthy();
  });

  it('redefinição sobrescreve pra frente', () => {
    const r = docFrom('x=2', 'x*10=', 'x=5', 'x*10=');
    expect(r[1].resultado).toBe('20');
    expect(r[3].resultado).toBe('50');
  });
});

describe('recalcularDocumento — variáveis string + aliases', () => {
  it('"Brita 4" = 110 define string var (atribuicao_str)', () => {
    const [a] = docFrom('"Brita 4" = 110');
    expect(a.tipo).toBe('atribuicao_str');
    expect(a.varDefinida).toBe('brita 4');
    expect(a.resultado).toBe('110');
    expect(a.alerta).toBe('ok');
  });

  it('"Brita 4"=110 depois brita4 + 5 = → 115', () => {
    const r = docFrom('"Brita 4" = 110', 'brita4 + 5 =');
    expect(r[1].resultado).toBe('115');
    expect(r[1].alerta).toBe('ok');
  });

  it('alias tolera variações de caixa e espaço', () => {
    const r = docFrom('"Brita 4" = 110', 'Brita 4 =', 'BRITA 4 =', 'brita4 =');
    expect(r[1].resultado).toBe('110');
    expect(r[2].resultado).toBe('110');
    expect(r[3].resultado).toBe('110');
  });

  it('⭐ cenário canônico: x=4, y=3, "Brita 4"=110, x+y+brita4= → 117', () => {
    const r = docFrom('x=4', 'y=3', '"Brita 4" = 110', 'x+y+brita4=');
    expect(r[3].resultado).toBe('117');
    expect(r[3].alerta).toBe('ok');
  });

  it('greedy longest-match: "brita" e "brita 4" coexistem', () => {
    const r = docFrom('"brita" = 1', '"brita 4" = 110', 'brita 4 =', 'brita =');
    expect(r[2].resultado).toBe('110');  // longest match
    expect(r[3].resultado).toBe('1');
  });
});

describe('recalcularDocumento — palavras reservadas', () => {
  it('"sin" = 5 rejeitado com erro inline', () => {
    const [a] = docFrom('"sin" = 5');
    expect(a.alerta).toBe('erro');
    expect(a.erroEngine).toMatch(/reservada/i);
  });

  it('sin = 5 (sem aspas, identificador) também rejeitado', () => {
    const [a] = docFrom('sin = 5');
    expect(a.alerta).toBe('erro');
    expect(a.erroEngine).toMatch(/reservada/i);
  });

  it('"log10" = 100 rejeitado', () => {
    const [a] = docFrom('"log10" = 100');
    expect(a.alerta).toBe('erro');
  });

  it('"viga_principal" = 5 aceito (não reservada)', () => {
    const [a] = docFrom('"viga_principal" = 5');
    expect(a.alerta).toBe('ok');
    expect(a.varDefinida).toBe('viga_principal');
  });

  it('função reservada ainda USÁVEL em expressão (só DEFINIR é bloqueado)', () => {
    const r = docFrom('sqrt(16)=');
    expect(r[0].resultado).toBe('4');
    expect(r[0].alerta).toBe('ok');
  });
});

describe('recalcularDocumento — compatibilidade Onda 5', () => {
  it('linha vazia → vazio', () => {
    expect(docFrom('')[0].alerta).toBe('vazio');
  });
  it('texto livre sem `=` → vazio', () => {
    expect(docFrom('memória de cálculo')[0].alerta).toBe('vazio');
  });
  it('1+1= → 2', () => {
    expect(docFrom('1+1=')[0].resultado).toBe('2');
  });
  it('2*5=11 → erro (RHS não bate)', () => {
    const [a] = docFrom('2*5=11');
    expect(a.resultado).toBe('10');
    expect(a.alerta).toBe('erro');
  });
});

describe('substituirAliases', () => {
  it('substitui forma com e sem espaço', () => {
    const aliases = [{ canonico: 'brita 4', chaveScope: '__sv_brita_4' }];
    expect(substituirAliases('brita4 + 5', aliases)).toBe('__sv_brita_4 + 5');
    expect(substituirAliases('BRITA 4 + 5', aliases)).toBe('__sv_brita_4 + 5');
  });
  it('sem aliases retorna expr intacta', () => {
    expect(substituirAliases('x + 1', [])).toBe('x + 1');
  });
});
```

- [ ] **Step 2: Rodar tests**

```bash
npx vitest run src/modules/engenharia/services/calcDocumento.test.ts
```

Esperado: ~22 testes verdes. Se algum falhar, é bug no `recalcularDocumento` — corrigir o `calcDocumento.ts` (não o teste, salvo se o teste estiver matematicamente errado).

- [ ] **Step 3: Commit (Task 2 + 3 juntas)**

```bash
npx tsc -b
git add src/modules/engenharia/services/calcDocumento.ts src/modules/engenharia/services/calcDocumento.test.ts
git commit -m "feat(engenharia): recalcularDocumento (variaveis num/string + aliases + cascade)

Avaliacao document-level: scope cumulativo, deteccao atribuicao vs avaliacao
(LHS identificador-simples ou string-literal = atribuicao), variaveis string
com aliases greedy longest-match (brita4/Brita 4/BRITA 4), palavras reservadas
bloqueadas na definicao. Funcao pura, testavel.

~22 Vitest incl. cenario canonico x=4,y=3,\"Brita 4\"=110,x+y+brita4=117."
```

---

## Task 4: Refatorar `LinhaCalculo` para receber `LinhaAvaliada`

**Files:**
- Modify: `src/modules/engenharia/components/LinhaCalculo.tsx`

**Por quê:** com avaliação document-level, a linha não pode mais chamar `parseLinha` sozinha (não tem scope). O pai (`CalculoPage`) computa `recalcularDocumento` e passa a `avaliada` pronta.

- [ ] **Step 1: Reescrever `LinhaCalculo.tsx`**

```tsx
import { AlertTriangle, Check } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { Input } from '@/components/shadcn/input';
import type { LinhaCalculo as TLinha } from '../types/calculo';
import type { LinhaAvaliada } from '../services/calcDocumento';

interface LinhaCalculoProps {
  linha: TLinha;
  /** Resultado da avaliação document-level (vem do CalculoPage). */
  avaliada: LinhaAvaliada;
  alertaAtivo: boolean;
  readOnly: boolean;
  onChange: (atualizada: TLinha) => void;
  onRevisado: (linhaId: string) => void;
  marcadaRevisada: boolean;
}

export function LinhaCalculo({
  linha,
  avaliada,
  alertaAtivo,
  readOnly,
  onChange,
  onRevisado,
  marcadaRevisada,
}: LinhaCalculoProps) {
  const alertaEfetivo = marcadaRevisada ? 'revisado' : avaliada.alerta;
  const mostrarErro = alertaAtivo && alertaEfetivo === 'erro';

  // Ghost do resultado quando avaliação `expr=` sem RHS (ou atribuição) resolveu ok.
  const mostrarGhostResultado =
    avaliada.alerta === 'ok' &&
    avaliada.rhsUsuario === null &&
    avaliada.resultado !== null &&
    avaliada.tipo !== 'vazio' &&
    !mostrarErro;

  function handleChange(novoTexto: string) {
    // Só persiste a expressão; resultado/alerta vêm do recalcularDocumento no pai.
    onChange({ ...linha, expressao: novoTexto });
  }

  function handleBlurAutoFill() {
    // `1+1=` sem RHS → persiste `1+1=2`. Atribuições não auto-preenchem (já têm RHS).
    if (
      avaliada.tipo === 'avaliacao' &&
      avaliada.alerta === 'ok' &&
      avaliada.rhsUsuario === null &&
      avaliada.resultado !== null
    ) {
      const completo = `${avaliada.lhs}=${avaliada.resultado}`;
      if (linha.expressao !== completo) {
        onChange({ ...linha, expressao: completo });
      }
    }
  }

  return (
    <div
      data-alerta={alertaEfetivo}
      data-tipo={avaliada.tipo}
      className={[
        'flex items-center gap-2 px-3 py-1.5 rounded-md border',
        mostrarErro
          ? 'border-destructive/50 bg-destructive/5'
          : 'border-transparent hover:bg-muted/40',
      ].join(' ')}
    >
      <Input
        value={linha.expressao}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlurAutoFill}
        disabled={readOnly}
        className="font-mono text-sm border-none shadow-none focus-visible:ring-0 px-0 bg-transparent"
        placeholder="Digite uma expressão (ex: 1+1= ou x=2*2)"
        aria-invalid={mostrarErro || undefined}
      />
      {mostrarGhostResultado && (
        <span className="text-xs text-muted-foreground whitespace-nowrap" aria-hidden>
          = {avaliada.resultado}
        </span>
      )}
      {mostrarErro && (
        <>
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" aria-hidden />
          <span className="text-xs text-destructive whitespace-nowrap">
            {avaliada.erroEngine
              ? avaliada.erroEngine
              : avaliada.resultado !== null
                ? `calculado: ${avaliada.resultado}`
                : 'expressão inválida'}
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

> Nota: o erro de variável reservada/indefinida aparece via `avaliada.erroEngine` no bloco de erro — atende o critério "erro inline + tooltip" (o texto fica visível inline; refinar com tooltip rico fica pra Onda 8 polish).

- [ ] **Step 2: Build + commit**

```bash
npx tsc -b
git add src/modules/engenharia/components/LinhaCalculo.tsx
git commit -m "refactor(engenharia): LinhaCalculo recebe LinhaAvaliada (avaliacao document-level)

Remove parseLinha por-linha (nao tinha scope). Agora recebe avaliada pronta
do CalculoPage (recalcularDocumento). onChange so persiste expressao;
resultado/alerta/erroEngine vem do pai. Erro de reservada/indefinida aparece
inline. data-tipo no elemento para testes/estilo."
```

---

## Task 5: Integrar `recalcularDocumento` no `CalculoPage`

**Files:**
- Modify: `src/modules/engenharia/pages/CalculoPage.tsx`

- [ ] **Step 1: Computar avaliadas + persistir resultado/alerta derivados**

Adicionar import:
```tsx
import { useMemo } from 'react';  // se ainda não importado, juntar ao import existente de react
import { recalcularDocumento } from '../services/calcDocumento';
```

Logo após o estado `linhas`:
```tsx
const avaliadas = useMemo(() => recalcularDocumento(linhas), [linhas]);
const avaliadaPorId = useMemo(
  () => new Map(avaliadas.map((a) => [a.id, a])),
  [avaliadas],
);
```

Ajustar `salvar` para persistir resultado/alerta DERIVADOS da avaliação (em vez do que estava na linha):
```tsx
// dentro de salvar(), antes do mutateAsync, derive as linhas persistidas:
const linhasPersistir = linhas.map((l) => {
  const a = avaliadaPorId.get(l.id);
  return {
    ...l,
    resultado: a?.resultado ?? null,
    alerta: (a?.alerta ?? 'vazio') as LinhaCalculo['alerta'],
  };
});
const documento: DocumentoCalculo = { linhas: linhasPersistir };
```

Ajustar o `.map` de render pra passar `avaliada`:
```tsx
{linhas.map((l) => {
  const avaliada = avaliadaPorId.get(l.id)!;
  return (
    <LinhaCalculoComp
      key={l.id}
      linha={l}
      avaliada={avaliada}
      alertaAtivo={alertaAtivo}
      readOnly={readOnly}
      onChange={handleLinhaChange}
      onRevisado={handleRevisado}
      marcadaRevisada={revisadas.has(l.id) || l.alerta === 'revisado'}
    />
  );
})}
```

`handleLinhaChange` simplifica (só expressao muda; resultado/alerta vêm do recalc):
```tsx
function handleLinhaChange(atualizada: LinhaCalculo) {
  setLinhas((prev) => prev.map((l) => (l.id === atualizada.id ? atualizada : l)));
  dirtyRef.current = true;
  setRevisadas((prev) => {
    if (!prev.has(atualizada.id)) return prev;
    const next = new Set(prev);
    next.delete(atualizada.id);
    return next;
  });
}
```

> Observação importante sobre `marcadaRevisada`: hoje usa `l.alerta === 'revisado'`. Como `recalcularDocumento` nunca emite `'revisado'` (é estado de UI), a fonte de "revisado persistido" continua sendo `l.alerta` salvo no banco. Mantém `revisadas.has(l.id) || l.alerta === 'revisado'`. Ao salvar, NÃO sobrescreva `alerta` de uma linha marcada revisada com o alerta da avaliação — ajuste a derivação:

```tsx
const linhasPersistir = linhas.map((l) => {
  const a = avaliadaPorId.get(l.id);
  const ehRevisada = revisadas.has(l.id) || l.alerta === 'revisado';
  return {
    ...l,
    resultado: a?.resultado ?? null,
    alerta: ehRevisada ? ('revisado' as const) : ((a?.alerta ?? 'vazio') as LinhaCalculo['alerta']),
  };
});
```

- [ ] **Step 2: Build + commit**

```bash
npx tsc -b
git add src/modules/engenharia/pages/CalculoPage.tsx
git commit -m "feat(engenharia): CalculoPage usa recalcularDocumento (cascade de variaveis)

Memoiza recalcularDocumento(linhas) -> avaliadaPorId. Passa avaliada por
linha pro LinhaCalculo. salvar() persiste resultado/alerta derivados da
avaliacao (preservando 'revisado' das linhas marcadas). handleLinhaChange
so muda expressao; o recalc cuida de resultado/alerta em cascade."
```

---

## Task 6: Playwright — cenários de variáveis

**Files:**
- Modify: `tests/engenharia-calculos.spec.ts`

- [ ] **Step 1: Adicionar cenários (dentro do `test.describe` existente)**

```ts
  test('variável numérica: x=4 depois x*2= → 8', async ({ page }) => {
    await abrirNovoCalculo(page);
    const l1 = page.getByPlaceholder(/Digite uma expressão/i).first();
    await l1.fill('x=4');
    await l1.blur();
    await page.getByRole('button', { name: /Adicionar linha/i }).click();
    const l2 = page.getByPlaceholder(/Digite uma expressão/i).nth(1);
    await l2.fill('x*2=');
    await l2.blur();
    await expect(l2).toHaveValue('x*2=8');
  });

  test('⭐ cenário canônico: x+y+brita4 = 117', async ({ page }) => {
    await abrirNovoCalculo(page);
    const addBtn = page.getByRole('button', { name: /Adicionar linha/i });
    const linha = (n: number) => page.getByPlaceholder(/Digite uma expressão/i).nth(n);

    await linha(0).fill('x=4'); await linha(0).blur();
    await addBtn.click(); await linha(1).fill('y=3'); await linha(1).blur();
    await addBtn.click(); await linha(2).fill('"Brita 4" = 110'); await linha(2).blur();
    await addBtn.click(); await linha(3).fill('x+y+brita4='); await linha(3).blur();

    await expect(linha(3)).toHaveValue('x+y+brita4=117');
  });

  test('palavra reservada: "sin" = 5 rejeitada com erro', async ({ page }) => {
    await abrirNovoCalculo(page);
    const l1 = page.getByPlaceholder(/Digite uma expressão/i).first();
    await l1.fill('"sin" = 5');
    await expect(page.getByText(/reservada/i)).toBeVisible();
  });
```

> O placeholder mudou para "Digite uma expressão (ex: 1+1= ou x=2*2)" na Task 4. Os seletores usam regex `/Digite uma expressão/i`, que continua casando. Os testes da Onda 5 que usavam o texto exato `'Digite uma expressão (ex: 1+1=)'` via `getByPlaceholder` com STRING devem ser atualizados para regex `/Digite uma expressão/i` — ajuste-os nesta task se quebrarem.

- [ ] **Step 2: tsc + (opcional) playwright --list + commit**

```bash
npx tsc -b
git add tests/engenharia-calculos.spec.ts
git commit -m "test(engenharia): Playwright variaveis (x*2, cenario canonico 117, reservada)

3 cenarios novos: variavel numerica cascade, cenario canonico
x=4/y=3/\"Brita 4\"=110/x+y+brita4=117, palavra reservada rejeitada.
Seletores de placeholder migrados pra regex (placeholder mudou na refatoracao)."
```

---

## Task 7: Verificação + CHANGELOG + plano-mestre

- [ ] **Step 1: Suite completa**

```bash
npx vitest run src/modules/engenharia/
npx tsc -b
npm run build
```

Esperado: 47 (ondas anteriores) + ~5 (reservadas) + ~22 (calcDocumento) = **74+ Vitest verdes**; tsc 0 erros; build com chunk lazy do CalculoPage.

- [ ] **Step 2: CHANGELOG** — `docs/modulos/engenharia/CHANGELOG.md` ganha seção `## Onda 6a — Variáveis (2026-05-28)` com: calcReservedWords, calcDocumento (recalcularDocumento + aliases + cascade), refactor LinhaCalculo→avaliada, CalculoPage document-level, ~27 Vitest novos, 3 Playwright novos. Documentar a regra de detecção atribuição-vs-avaliação e o cenário canônico.

- [ ] **Step 3: Plano-mestre** — em `2026-05-26-engenharia-modulo.md`, na seção Onda 6, marcar as sub-fases 6.1 e 6.2 como ✅ CONCLUÍDAS 2026-05-28 (parte da Onda 6a), deixando 6.3/6.4/6.5 pendentes. Linkar este plano e o CHANGELOG.

- [ ] **Step 4: Commit final.**

```bash
git add docs/modulos/engenharia/CHANGELOG.md docs/superpowers/plans/2026-05-26-engenharia-modulo.md docs/superpowers/plans/2026-05-28-engenharia-onda-6a-variaveis.md
git commit -m "docs(engenharia): CHANGELOG Onda 6a (variaveis) + plano + marca 6.1/6.2 no mestre"
```

---

## Self-Review

**Spec coverage (master plan 6.1 + 6.2 + critérios 6.8 aplicáveis):**
- ✅ 6.1 variáveis numéricas, scope, cascade → Task 2 + testes Task 3 (x=4→x*2=8, redefinição)
- ✅ 6.2 variáveis string + aliases greedy longest-match → Task 2 `substituirAliases` + Task 3
- ✅ Palavras reservadas (D-6) → Task 1 + Task 2 (bloqueio na definição) + Task 3
- ✅ Cenário canônico `x+y+brita4=117` → Task 3 (Vitest) + Task 6 (Playwright)
- ✅ `"sin"=5` rejeitado, `"log10"=100` rejeitado, `"viga_principal"=5` aceito → Task 3
- ⛔ 6.3 spinner / 6.4 caixas / 6.5 grid → fora deste plano (ondas 6b/6c/6d)
- ⛔ Lock 2-contextos e performance 100 linhas <200ms → não neste plano (lock já testado na Onda 4; perf entra quando houver virtualização na 6d ou na Onda 8)

**Placeholders:** nenhum TODO de código. O "tooltip rico" das reservadas é explicitamente adiado (erro inline já satisfaz o critério funcional).

**Type consistency:**
- `LinhaAvaliada.alerta` é `Exclude<AlertaLinha,'revisado'>` (engine nunca emite revisado).
- `recalcularDocumento(LinhaCalculo[]) → LinhaAvaliada[]`.
- `substituirAliases(string, AliasRegistrado[]) → string` exportada e testada.
- `CalculoPage` deriva `linhasPersistir` com `alerta` preservando `'revisado'`.

**Granularidade:** 7 tasks. Tasks 1-3 (engine, inline — alto valor de teste) + Tasks 4-6 (UI refactor + integração + E2E, via subagent com 2-stage review) + Task 7 (docs, inline).

---

## Critério de "Onda 6a pronta"

- [ ] `calcReservedWords` + `ehReservada` com Vitest verde.
- [ ] `recalcularDocumento` com ~22 Vitest verdes incl. cenário canônico 117.
- [ ] `LinhaCalculo` refatorado pra `avaliada` (sem `parseLinha` interno).
- [ ] `CalculoPage` document-level via `useMemo(recalcularDocumento)`.
- [ ] 3 Playwright novos (x*2, canônico, reservada).
- [ ] Suite Vitest do módulo 74+ verdes; `tsc -b` 0 erros; build OK.
- [ ] CHANGELOG + plano-mestre (6.1/6.2 ✅) atualizados.

---

## Execution Handoff

**Plano salvo em `docs/superpowers/plans/2026-05-28-engenharia-onda-6a-variaveis.md`.**

Pattern recomendado: **Tasks 1-3 inline** (engine + testes — onde mora o risco e onde testes dão retorno máximo), **Tasks 4-6 via subagent** com 2-stage review por task (refactor LinhaCalculo + integração CalculoPage + Playwright), **Task 7 inline** (verificação + docs).

Pronto pra executar?
