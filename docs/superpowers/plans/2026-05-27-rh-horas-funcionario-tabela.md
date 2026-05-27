# Tabela "Horas por funcionário" na DashboardTab RH (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nova seção full-width na DashboardTab do RH mostrando, por funcionário no período filtrado, total de horas produtivas + drill-down (obra, serviço, horas, % do tempo dele).

**Architecture:** Lógica de agregação pura em arquivo separado (`dashboardHorasFuncionario.ts`), testada via Vitest. Renderização reusa `DataTable` shadcn (TanStack v8, suporte nativo a `enableExpanding` + `renderExpanded`). Zero queries novas — dados já carregados pela DashboardTab. Pré-requisito: estender `Servico` com `obraId` (hoje o mapper descarta o campo) pra agrupar serviços por obra no detail.

**Tech Stack:** React 19, TypeScript, TanStack Table v8 (via `DataTable.tsx`), Vitest, Supabase (sem mudança no banco).

**Spec:** [`docs/superpowers/specs/2026-05-27-rh-horas-funcionario-tabela-design.md`](../specs/2026-05-27-rh-horas-funcionario-tabela-design.md)

---

## File Structure

- **Modify:** `src/modules/apontamento/utils/apontamentoServicoApi.ts` — adiciona `obraId: string | null` à interface `Servico` + 2 mappers (`listServicosDaObra`, `listTodosServicos`).
- **Create:** `src/modules/apontamento/utils/dashboardHorasFuncionario.ts` — função pura `agregarHorasPorFuncionario(...)` + tipos `LinhaFunc`, `DetalheServico`.
- **Create:** `src/modules/apontamento/utils/dashboardHorasFuncionario.test.ts` — Vitest com 8 casos cobrindo regras de negócio.
- **Modify:** `src/modules/apontamento/components/DashboardTab.tsx` — adiciona `obrasById` Map, useMemo da agregação, nova seção full-width `<DataTable>` no fim do JSX retornado.

---

### Task 1: Estender `Servico` com `obraId`

**Files:**
- Modify: `src/modules/apontamento/utils/apontamentoServicoApi.ts` (interface + 2 mappers)

- [ ] **Step 1: Editar interface `Servico` (linhas ~7-12)**

Em `src/modules/apontamento/utils/apontamentoServicoApi.ts`:

```ts
export interface Servico {
  id: string;
  nome: string;
  codigo: string | null;
  unidade: string | null;
  obraId: string | null;
}
```

- [ ] **Step 2: Atualizar `listServicosDaObra` (linhas ~78-92)**

Trocar a SELECT + map:

```ts
export async function listServicosDaObra(
  obraId: string
): Promise<Servico[]> {
  if (!obraId) return [];
  const { data, error } = await supabase
    .from("rodotracker_contract_items")
    .select("id, code, name, unit, obra_id")
    .eq("obra_id", obraId)
    .order("code", { ascending: true });
  throwIfError(error, "listServicosDaObra");
  return ((data ?? []) as { id: string; code: string | null; name: string; unit: string | null; obra_id: string | null }[]).map(
    (r) => ({ id: r.id, nome: r.name, codigo: r.code, unidade: r.unit, obraId: r.obra_id })
  );
}
```

- [ ] **Step 3: Atualizar `listTodosServicos` (linhas ~175-184)**

Mesmo padrão:

```ts
export async function listTodosServicos(): Promise<Servico[]> {
  const { data, error } = await supabase
    .from("rodotracker_contract_items")
    .select("id, code, name, unit, obra_id");
  throwIfError(error, "listTodosServicos");
  return ((data ?? []) as { id: string; code: string | null; name: string; unit: string | null; obra_id: string | null }[]).map(
    (r) => ({ id: r.id, nome: r.name, codigo: r.code, unidade: r.unit, obraId: r.obra_id })
  );
}
```

- [ ] **Step 4: Verificar typecheck**

Run: `npx tsc -b 2>&1 | grep -E "apontamentoServicoApi|Servico" | head -5`
Expected: vazio. Se aparecer erro em algum consumer (`LancamentoServicoModal`, `ApontamentoServicoTab`), confirmar que apenas LÊ outros campos da interface — `obraId` é aditivo, não quebra.

- [ ] **Step 5: Commit**

```bash
git add src/modules/apontamento/utils/apontamentoServicoApi.ts
git commit -m "feat(apontamento): Servico expõe obraId (mappers de listServicosDaObra/listTodosServicos)

Pré-requisito da tabela 'Horas por funcionário' na DashboardTab —
o agrupamento por obra no expand exige saber a qual obra cada serviço
pertence. Backend já retornava obra_id; só faltava ser propagado pelo
mapper pra ficar disponível no front.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Função pura `agregarHorasPorFuncionario` (TDD)

**Files:**
- Create: `src/modules/apontamento/utils/dashboardHorasFuncionario.ts`
- Create: `src/modules/apontamento/utils/dashboardHorasFuncionario.test.ts`

- [ ] **Step 1: Escrever teste failing**

`src/modules/apontamento/utils/dashboardHorasFuncionario.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { agregarHorasPorFuncionario } from './dashboardHorasFuncionario'
import type { Funcionario, Obra } from '../types/funcionario'
import type { Servico, ApontamentoServico } from './apontamentoServicoApi'

const F: Funcionario = {
  id: 'f1', nome: 'João Silva', cpf: '', rg: null, pis: null, ctps: null,
  dataNascimento: '', fotoPerfil: null, fotosReferenciaFacial: [],
  funcao: 'PEDREIRO' as Funcionario['funcao'], tipoVinculo: 'CLT',
  salarioBase: 1518, valorDiaria: null, valorHora: null,
  obraId: null, equipeId: null, encarregadoId: null,
  dataAdmissao: '2026-01-01', dataDemissao: null, status: 'ativo',
  contatoEmergencia: null, permiteHorasExtras: true, documentos: [],
  createdAt: '', updatedAt: '',
}
const F2: Funcionario = { ...F, id: 'f2', nome: 'Maria Santos' }

const O1: Obra = { id: 'o1', nome: 'BR-364 (Lote 9)' }
const O2: Obra = { id: 'o2', nome: 'MT-208' }

const S1: Servico = { id: 's1', nome: 'CBUQ', codigo: null, unidade: 'm³', obraId: 'o1' }
const S2: Servico = { id: 's2', nome: 'Solo', codigo: null, unidade: 'm³', obraId: 'o1' }
const S3: Servico = { id: 's3', nome: 'Pintura', codigo: null, unidade: 'm²', obraId: 'o2' }
const S4: Servico = { id: 's4', nome: 'Órfão', codigo: null, unidade: null, obraId: 'inexistente' }

function ap(over: Partial<ApontamentoServico>): ApontamentoServico {
  return {
    id: 'a' + Math.random(), funcionarioId: 'f1', data: '2026-05-01',
    servicoId: 's1', estacaInicial: null, estacaFinal: null, lado: null,
    horas: 1, tipo: 'produtivo', motivoImprodutivo: null, observacao: null,
    registradoPorId: null, createdAt: '', updatedAt: '',
    ...over,
  }
}

const funcsById = new Map([[F.id, F], [F2.id, F2]])
const servicosById = new Map([[S1.id, S1], [S2.id, S2], [S3.id, S3], [S4.id, S4]])
const obrasById = new Map([[O1.id, O1], [O2.id, O2]])

describe('agregarHorasPorFuncionario', () => {
  it('lista vazia retorna []', () => {
    expect(agregarHorasPorFuncionario([], funcsById, servicosById, obrasById)).toEqual([])
  })

  it('1 funcionário, 1 serviço, 1 apontamento', () => {
    const result = agregarHorasPorFuncionario(
      [ap({ servicoId: 's1', horas: 8 })],
      funcsById, servicosById, obrasById,
    )
    expect(result).toHaveLength(1)
    expect(result[0].funcionarioNome).toBe('João Silva')
    expect(result[0].horasProd).toBe(8)
    expect(result[0].obrasCount).toBe(1)
    expect(result[0].servicosCount).toBe(1)
    expect(result[0].detalhes).toHaveLength(1)
    expect(result[0].detalhes[0]).toMatchObject({
      obraNome: 'BR-364 (Lote 9)',
      servicoNome: 'CBUQ',
      horas: 8,
      percentual: 100,
    })
  })

  it('1 funcionário, N serviços em obras diferentes — percentuais somam 100', () => {
    const [linha] = agregarHorasPorFuncionario(
      [
        ap({ servicoId: 's1', horas: 18 }),
        ap({ servicoId: 's2', horas: 12 }),
        ap({ servicoId: 's3', horas: 10 }),
      ],
      funcsById, servicosById, obrasById,
    )
    expect(linha.horasProd).toBe(40)
    expect(linha.obrasCount).toBe(2) // o1 + o2
    expect(linha.servicosCount).toBe(3)
    // ordenado por horas desc
    expect(linha.detalhes.map((d) => d.servicoNome)).toEqual(['CBUQ', 'Solo', 'Pintura'])
    expect(linha.detalhes[0].percentual).toBe(45)
    expect(linha.detalhes[1].percentual).toBe(30)
    expect(linha.detalhes[2].percentual).toBe(25)
    const somaPct = linha.detalhes.reduce((s, d) => s + d.percentual, 0)
    expect(somaPct).toBeCloseTo(100, 1)
  })

  it('apontamentos do mesmo serviço em dias diferentes somam', () => {
    const [linha] = agregarHorasPorFuncionario(
      [
        ap({ servicoId: 's1', data: '2026-05-01', horas: 4 }),
        ap({ servicoId: 's1', data: '2026-05-02', horas: 4 }),
      ],
      funcsById, servicosById, obrasById,
    )
    expect(linha.horasProd).toBe(8)
    expect(linha.detalhes).toHaveLength(1)
    expect(linha.detalhes[0].horas).toBe(8)
  })

  it('ignora improdutivos', () => {
    const result = agregarHorasPorFuncionario(
      [
        ap({ servicoId: 's1', horas: 6, tipo: 'produtivo' }),
        ap({ servicoId: null, horas: 2, tipo: 'improdutivo' }),
      ],
      funcsById, servicosById, obrasById,
    )
    expect(result).toHaveLength(1)
    expect(result[0].horasProd).toBe(6)
  })

  it('servico_id NULL vira "— Sem serviço vinculado —"', () => {
    const [linha] = agregarHorasPorFuncionario(
      [ap({ servicoId: null, horas: 3 })],
      funcsById, servicosById, obrasById,
    )
    expect(linha.detalhes[0]).toMatchObject({
      obraNome: '—',
      servicoNome: '— Sem serviço vinculado —',
      obraId: null,
      servicoId: null,
    })
    expect(linha.obrasCount).toBe(0)
    expect(linha.servicosCount).toBe(0)
  })

  it('servico cujo obra_id não existe na obrasById vira "Obra <id>"', () => {
    const [linha] = agregarHorasPorFuncionario(
      [ap({ servicoId: 's4', horas: 5 })],
      funcsById, servicosById, obrasById,
    )
    expect(linha.detalhes[0].obraNome).toBe('Obra inexistente')
    expect(linha.obrasCount).toBe(1)
  })

  it('funcionário deletado (não está em funcsById) é descartado', () => {
    const result = agregarHorasPorFuncionario(
      [ap({ funcionarioId: 'orfao', horas: 5 })],
      funcsById, servicosById, obrasById,
    )
    expect(result).toEqual([])
  })

  it('múltiplos funcionários retornam linhas separadas', () => {
    const result = agregarHorasPorFuncionario(
      [
        ap({ funcionarioId: 'f1', servicoId: 's1', horas: 4 }),
        ap({ funcionarioId: 'f2', servicoId: 's2', horas: 6 }),
      ],
      funcsById, servicosById, obrasById,
    )
    expect(result).toHaveLength(2)
    expect(result.find((r) => r.funcionarioId === 'f1')!.horasProd).toBe(4)
    expect(result.find((r) => r.funcionarioId === 'f2')!.horasProd).toBe(6)
  })
})
```

- [ ] **Step 2: Rodar pra confirmar fail**

Run: `npx vitest run src/modules/apontamento/utils/dashboardHorasFuncionario.test.ts`
Expected: FAIL com "Cannot find module './dashboardHorasFuncionario'".

- [ ] **Step 3: Implementar `dashboardHorasFuncionario.ts`**

```ts
// Agregação pura pra tabela "Horas por funcionário" da DashboardTab RH.
// Recebe apontamentos do período + maps de lookup, retorna 1 linha por
// funcionário com horas produtivas + detalhes (obra, serviço, horas, %).

import type { Funcionario, Obra } from '../types/funcionario'
import type { Servico, ApontamentoServico } from './apontamentoServicoApi'

export interface DetalheServico {
  obraId: string | null
  obraNome: string
  servicoId: string | null
  servicoNome: string
  horas: number
  percentual: number
}

export interface LinhaFunc {
  funcionarioId: string
  funcionarioNome: string
  horasProd: number
  obrasCount: number
  servicosCount: number
  detalhes: DetalheServico[]
}

export function agregarHorasPorFuncionario(
  apontamentos: ApontamentoServico[],
  funcsById: Map<string, Funcionario>,
  servicosById: Map<string, Servico>,
  obrasById: Map<string, Obra>,
): LinhaFunc[] {
  // 1) filtra só produtivos
  const produtivos = apontamentos.filter((a) => a.tipo === 'produtivo')

  // 2) agrupa por (funcionarioId, servicoId) somando horas
  type Key = string
  const bucket = new Map<Key, { funcId: string; servicoId: string | null; horas: number }>()
  for (const a of produtivos) {
    const key = `${a.funcionarioId}|${a.servicoId ?? 'null'}`
    const prev = bucket.get(key)
    if (prev) prev.horas += a.horas
    else bucket.set(key, { funcId: a.funcionarioId, servicoId: a.servicoId, horas: a.horas })
  }

  // 3) reagrupa por funcionário
  const porFunc = new Map<string, LinhaFunc>()
  for (const item of bucket.values()) {
    const func = funcsById.get(item.funcId)
    if (!func) continue // funcionário deletado/órfão — descarta
    let linha = porFunc.get(item.funcId)
    if (!linha) {
      linha = {
        funcionarioId: item.funcId,
        funcionarioNome: func.nome,
        horasProd: 0,
        obrasCount: 0,
        servicosCount: 0,
        detalhes: [],
      }
      porFunc.set(item.funcId, linha)
    }
    const servico = item.servicoId ? servicosById.get(item.servicoId) : null
    const obraId = servico?.obraId ?? null
    const obraNome = obraId
      ? (obrasById.get(obraId)?.nome ?? `Obra ${obraId}`)
      : '—'
    linha.detalhes.push({
      obraId,
      obraNome,
      servicoId: item.servicoId,
      servicoNome: servico?.nome ?? '— Sem serviço vinculado —',
      horas: item.horas,
      percentual: 0, // calculado em (4)
    })
    linha.horasProd += item.horas
  }

  // 4) calcula percentual + counts + sort detalhes por horas desc
  for (const linha of porFunc.values()) {
    linha.obrasCount = new Set(
      linha.detalhes.map((d) => d.obraId).filter((id): id is string => id !== null),
    ).size
    linha.servicosCount = new Set(
      linha.detalhes.map((d) => d.servicoId).filter((id): id is string => id !== null),
    ).size
    linha.detalhes.sort((a, b) => b.horas - a.horas)
    for (const d of linha.detalhes) {
      d.percentual = linha.horasProd > 0 ? (d.horas / linha.horasProd) * 100 : 0
    }
  }

  // 5) só funcionários com horas > 0
  return Array.from(porFunc.values()).filter((l) => l.horasProd > 0)
}
```

- [ ] **Step 4: Rodar pra confirmar pass**

Run: `npx vitest run src/modules/apontamento/utils/dashboardHorasFuncionario.test.ts`
Expected: 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/apontamento/utils/dashboardHorasFuncionario.ts src/modules/apontamento/utils/dashboardHorasFuncionario.test.ts
git commit -m "feat(apontamento): agregarHorasPorFuncionario (puro, 9 tests)

Função pura que recebe apontamentos do período + maps de lookup
(funcsById, servicosById, obrasById) e retorna 1 linha por funcionário
com horas produtivas + detalhes (obra, serviço, horas, %). Filtra
improdutivos, ignora funcionários deletados, lida com servico_id NULL
e obra inexistente. Sort por horas desc.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Wire-up + renderização na DashboardTab

**Files:**
- Modify: `src/modules/apontamento/components/DashboardTab.tsx`

- [ ] **Step 1: Adicionar imports no topo**

Após os imports existentes em `src/modules/apontamento/components/DashboardTab.tsx:1-15`:

```ts
import DataTable from "../../../components/ui/DataTable";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronRight } from "lucide-react";
import {
  agregarHorasPorFuncionario,
  type LinhaFunc,
} from "../utils/dashboardHorasFuncionario";
```

- [ ] **Step 2: Adicionar `obrasById` Map após os Maps existentes**

Após `servicosById` (linha ~92 atual):

```ts
const obrasById = useMemo(
  () => new Map(obras.map((o) => [o.id, o])),
  [obras]
);
```

- [ ] **Step 3: Adicionar `useMemo` da agregação**

Logo após `topServicos` (linha ~190 atual, antes do `return (`):

```ts
// ─── Horas por funcionário (tabela detalhada) ───────────────────────
const horasPorFuncionario = useMemo(
  () => agregarHorasPorFuncionario(apontamentos, funcsById, servicosById, obrasById),
  [apontamentos, funcsById, servicosById, obrasById]
);
```

- [ ] **Step 4: Adicionar helper de formato no topo do arquivo**

Logo após `isoDaysAgo` (linha ~32 atual):

```ts
function formatHoras(n: number): string {
  return n.toFixed(1).replace('.', ',');
}
```

- [ ] **Step 5: Definir colunas + render expanded ANTES do return**

Logo após o `useMemo` do step 3, antes do `return (`:

```ts
const horasColumns: ColumnDef<LinhaFunc>[] = [
  {
    id: "expander",
    header: () => null,
    cell: ({ row }) => (
      <button
        type="button"
        aria-label={row.getIsExpanded() ? "Recolher detalhes" : "Expandir detalhes"}
        aria-expanded={row.getIsExpanded()}
        onClick={(e) => { e.stopPropagation(); row.toggleExpanded(); }}
        className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-[var(--color-surface-2)] transition-colors"
      >
        <ChevronRight
          aria-hidden
          className={
            "w-4 h-4 text-[var(--color-fg-muted)] transition-transform " +
            (row.getIsExpanded() ? "rotate-90" : "")
          }
        />
      </button>
    ),
    size: 32,
    enableSorting: false,
  },
  {
    accessorKey: "funcionarioNome",
    header: "Funcionário",
    cell: ({ getValue }) => (
      <span className="font-medium text-[var(--color-fg)]">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: "horasProd",
    header: () => <span className="block text-right">Horas</span>,
    cell: ({ getValue }) => (
      <span className="block text-right tabular-nums">{formatHoras(getValue() as number)}</span>
    ),
  },
  {
    accessorKey: "obrasCount",
    header: () => <span className="block text-right">Obras</span>,
    cell: ({ getValue }) => (
      <span className="block text-right tabular-nums">{getValue() as number}</span>
    ),
  },
  {
    accessorKey: "servicosCount",
    header: () => <span className="block text-right">Serviços</span>,
    cell: ({ getValue }) => (
      <span className="block text-right tabular-nums">{getValue() as number}</span>
    ),
  },
];

function HorasExpanded({ linha }: { linha: LinhaFunc }) {
  return (
    <div className="px-4 py-3 bg-[var(--color-surface-2)]">
      <table className="w-full text-sm" role="region" aria-label={`Detalhes de ${linha.funcionarioNome}`}>
        <thead>
          <tr className="text-xs text-[var(--color-fg-muted)] border-b border-[var(--color-border)]">
            <th className="text-left py-2 font-medium">Obra</th>
            <th className="text-left py-2 font-medium">Serviço</th>
            <th className="text-right py-2 font-medium">Horas</th>
            <th className="text-right py-2 font-medium pr-2">%</th>
          </tr>
        </thead>
        <tbody>
          {linha.detalhes.map((d, i) => (
            <tr key={i} className="border-b border-[var(--color-border)]/40">
              <td className="py-1.5">{d.obraNome}</td>
              <td className="py-1.5">{d.servicoNome}</td>
              <td className="py-1.5 text-right tabular-nums">{formatHoras(d.horas)}</td>
              <td className="py-1.5 text-right tabular-nums pr-2">{d.percentual.toFixed(1)}%</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="pt-2" colSpan={2}>Total</td>
            <td className="pt-2 text-right tabular-nums">{formatHoras(linha.horasProd)}</td>
            <td className="pt-2 text-right tabular-nums pr-2">100,0%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 6: Adicionar a `<DataTable>` no JSX**

Localizar o JSX onde o `ChartCard title="Top serviços"` fecha (procurar por `</ChartCard>` mais ao fim, linha ~360 atual). Logo APÓS esse `</ChartCard>` e antes do `</div>` que fecha o container principal, adicionar:

```tsx
{/* ─── Tabela: Horas por funcionário (detalhado) ───────────────────── */}
<section className="space-y-3">
  <div>
    <h2 className="text-base font-semibold text-[var(--color-fg)]">
      Horas por funcionário (detalhado)
    </h2>
    <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
      Clique numa linha pra ver obras e serviços.
    </p>
  </div>

  <DataTable<LinhaFunc>
    columns={horasColumns}
    data={horasPorFuncionario}
    isLoading={isLoading}
    defaultSorting={[{ id: "horasProd", desc: true }]}
    getRowId={(r) => r.funcionarioId}
    enableExpanding
    renderExpanded={(linha) => <HorasExpanded linha={linha} />}
    onRowClick={(linha) => {
      // toggle via click na linha inteira (UX comum) — DataTable não expõe
      // toggleExpanded direto, mas o efeito é o mesmo via column expander.
      // Como já temos a coluna chevron, deixar o click só nela. Skip.
      void linha;
    }}
    empty={{
      title: "Sem horas apontadas neste período",
      description: "Ajuste o intervalo no topo do dashboard ou aguarde novos apontamentos.",
    }}
    pageSize={25}
    persistPageSizeKey="apont-dash-horas-func-pagesize"
    renderFooter={(rows) => {
      const totalH = rows.reduce((acc, r) => acc + r.horasProd, 0);
      return (
        <span className="text-xs text-[var(--color-fg-muted)]">
          {rows.length} {rows.length === 1 ? "funcionário" : "funcionários"}
          {" · "}{formatHoras(totalH)} horas
        </span>
      );
    }}
  />
</section>
```

> Nota: `onRowClick` foi mantido como no-op (`void linha`) propositalmente — o expand é feito via column chevron pra evitar conflito de UX (linha grande clicável tende a confundir com "abrir detalhe do funcionário em página").

- [ ] **Step 7: Verificar typecheck**

Run: `npx tsc -b 2>&1 | grep -E "DashboardTab|dashboardHoras" | head -5`
Expected: vazio (sem erros).

Outros erros de TS em arquivos alheios (WIP do usuário) — IGNORAR.

- [ ] **Step 8: Smoke local (dev)**

Run: `npm run dev` (background)
Acesse `http://localhost:5173/apontamento?tab=dashboard`. Confirma:
- Tabela aparece no fim da página, abaixo de "Top serviços"
- Coluna "Horas" tem sort default DESC (maior em cima)
- Click no chevron expande a linha mostrando obra/serviço/horas/%
- Footer mostra total
- Filtros do topo (range/obra/equipe) alteram a tabela

Se loading parecer estranho, é o `isLoading={isLoading}` que cobre via skeleton/loading state do DataTable.

- [ ] **Step 9: Commit**

```bash
git add src/modules/apontamento/components/DashboardTab.tsx
git commit -m "feat(apontamento): seção 'Horas por funcionário' na DashboardTab RH

Tabela nova full-width abaixo de 'Top serviços' mostrando, por funcionário
no período filtrado:
  - Total horas produtivas
  - # obras e # serviços (distintos)
  - Expand revela detalhe (obra, serviço, horas, % do tempo do funcionário)
  - Footer: N funcionários + total geral
  - Sort default por horas desc, pageSize 25 persistido

Reusa filtros já existentes (range, obra, equipe) — zero queries novas.
Agregação via agregarHorasPorFuncionario (puro, testado isoladamente).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Validação final + push

**Files:** nenhum

- [ ] **Step 1: Rodar suite de tests apontamento**

```bash
npx vitest run src/modules/apontamento
```
Expected: `Test Files 1 passed (1), Tests 9 passed (9)`.

- [ ] **Step 2: Typecheck full**

```bash
npx tsc -b
```
Expected: zero erros nos arquivos modificados/criados nessa feature. Erros pré-existentes em WIPs alheios — não meu problema (pre-push hook pode bloquear; se bloquear, reportar ao usuário).

- [ ] **Step 3: Push**

```bash
git push origin "$(git branch --show-current)"
```

Se pre-push hook bloquear por erros alheios, NÃO use `--no-verify`. Reportar ao usuário com a lista de erros pra ele decidir (fix alheio ou pular hook).

---

## Self-review

**Spec coverage:**
- Spec §1 (Problema) → contexto no header ✓
- Spec §2 (Objetivos) → Task 3 monta a UI; Task 2 garante agregação correta ✓
- Spec §3.1 (Posição) → Task 3 Step 6 (depois do "Top serviços") ✓
- Spec §3.2 (DataTable shadcn + flags) → Task 3 Step 6 (props enableExpanding, defaultSorting, etc) ✓
- Spec §3.3 (agregação client-side) → Task 1 (pré-req obraId) + Task 2 (função) + Task 3 Step 3 (useMemo) ✓
- Spec §3.4 (colunas linha principal) → Task 3 Step 5 (horasColumns) ✓
- Spec §3.5 (sub-row expand) → Task 3 Step 5 (HorasExpanded) ✓
- Spec §3.6 (footer) → Task 3 Step 6 (renderFooter) ✓
- Spec §4 (edge cases) → cobertos nos 9 testes (Task 2 Step 1): null servicoId, obra inexistente, improdutivo, funcionário órfão ✓
- Spec §5 (performance) → useMemo + sem worker, validado por smoke (Task 3 Step 8) ✓
- Spec §7 (a11y) → Task 3 Step 5 (aria-label, aria-expanded no chevron; role+aria-labelledby no expand) ✓
- Spec §8 (testes) → Task 2 (unit) + Task 3 Step 8 (smoke manual) ✓
- Spec §9 (rollback) → git revert do PR único ✓
- Spec §10 (não-objetivos) → respeitados (sem export, sem improdutivo, sem column filter custom) ✓

**Placeholder scan:** zero "TBD/TODO/implement later". O único `void linha;` na Task 3 Step 6 é código real (no-op intencional documentado).

**Type consistency:**
- `LinhaFunc`, `DetalheServico` definidos na Task 2, usados na Task 3 ✓
- `agregarHorasPorFuncionario` assinatura idêntica em Task 2 (impl) e Task 3 Step 3 (call) ✓
- `Servico.obraId` adicionado na Task 1, lido na Task 2 (`servico?.obraId`) ✓
- `formatHoras` definido na Task 3 Step 4, usado nos Steps 5+6 ✓
