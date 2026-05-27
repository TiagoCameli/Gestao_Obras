# Tabela "Horas por funcionário" na DashboardTab do RH

**Data:** 2026-05-27
**Módulo:** `src/modules/apontamento/components/DashboardTab.tsx`
**Escopo:** nova seção full-width na DashboardTab mostrando, por funcionário, total de horas produtivas no período + drill-down (obra, serviço, horas, % do funcionário).
**Não-escopo:** horas improdutivas; novos filtros próprios; nova RPC ou migration; export pra Excel (fica de fora — vale outra sessão).

---

## 1. Problema

Hoje a DashboardTab tem KPIs agregados + gráficos top-N. Não há como ver, por funcionário, **em quais obras e quais itens (serviços do contrato)** ele trabalhou no período filtrado. Auditoria (`apontamento-rh-audit.md`, Fase 4.5) já tinha sinalizado a falta de visão de produtividade.

## 2. Objetivos

- Tabela com **1 linha por funcionário** mostrando total de horas produtivas no período.
- **Expand de linha** abre detalhamento (obra, serviço, horas, % do tempo daquele funcionário).
- Reusa filtros já existentes (range, obra, equipe) — sem novo controle.
- Sem novo dado backend (agregação client-side).

## 3. Componentes e dados

### 3.1 Onde encaixa

Nova seção full-width **abaixo do ChartCard "Top serviços"** (último elemento da DashboardTab atual). Título: "**Horas por funcionário (detalhado)**" + subtitle "Clique numa linha pra ver obras e serviços".

### 3.2 Componente de tabela

Reusa `src/components/ui/DataTable.tsx` (TanStack v8) com:
- `enableExpanding: true`
- `renderExpanded: (row) => SubRow`
- `defaultSorting: [{ id: 'horas', desc: true }]`
- `renderFooter`: total de funcionários + soma de horas
- `pageSize: 25` (com toggle padrão do DataTable)
- `empty`: ícone + "Sem horas apontadas neste período"

### 3.3 Dados — agregação client-side

Os dados já são carregados pela DashboardTab:
- `apontamentos: ApontamentoServico[]` (de `listApontamentosServicoRange(filtros)`)
- `funcionarios: Funcionario[]` (de `useFuncionarios()`)
- `obras: Obra[]` (de `useObrasApont()`)
- `servicos: Servico[]` (de `listTodosServicos`)

Já existem `funcsById`, `servicosById` Maps na DashboardTab. Faltam:

```ts
// Map adicional pra contagem de obras por serviço
const obrasById = useMemo(
  () => new Map(obras.map((o) => [o.id, o])),
  [obras]
);
```

A agregação fica em arquivo separado (`src/modules/apontamento/utils/dashboardHorasFuncionario.ts`) pra ser unit-testada sem renderizar React. A DashboardTab chama via `useMemo`:

```ts
import { agregarHorasPorFuncionario } from '../utils/dashboardHorasFuncionario';

const horasPorFuncionario = useMemo(
  () => agregarHorasPorFuncionario(apontamentos, funcsById, servicosById, obrasById),
  [apontamentos, funcsById, servicosById, obrasById]
);
```

Tipos exportados do arquivo:

```ts
interface DetalheServico {
  obraId: string | null;
  obraNome: string;
  servicoId: string | null;
  servicoNome: string;
  horas: number;
  percentual: number; // (horas / linhaFunc.horasProd) * 100
}

interface LinhaFunc {
  funcionarioId: string;
  funcionarioNome: string;
  horasProd: number;
  obrasCount: number;     // distinct obraId
  servicosCount: number;  // distinct servicoId
  detalhes: DetalheServico[]; // ordenado por horas desc
}

// Implementação interna:
export function agregarHorasPorFuncionario(
  apontamentos: ApontamentoServico[],
  funcsById: Map<string, Funcionario>,
  servicosById: Map<string, Servico>,
  obrasById: Map<string, Obra>,
): LinhaFunc[] {
  // 1) filtra só produtivos
  const produtivos = apontamentos.filter((a) => a.tipo === 'produtivo');

  // 2) agrupa por (funcionarioId, servicoId)
  type Key = string; // `${funcId}|${servicoId ?? 'null'}`
  const bucket = new Map<Key, { funcId: string; servicoId: string | null; horas: number }>();
  for (const a of produtivos) {
    const key = `${a.funcionarioId}|${a.servicoId ?? 'null'}`;
    const prev = bucket.get(key);
    if (prev) prev.horas += a.horas;
    else bucket.set(key, { funcId: a.funcionarioId, servicoId: a.servicoId, horas: a.horas });
  }

  // 3) reagrupa por funcionário, montando detalhes + counts
  const porFunc = new Map<string, LinhaFunc>();
  for (const item of bucket.values()) {
    const func = funcsById.get(item.funcId);
    if (!func) continue; // funcionário deletado/órfão — descarta
    let linha = porFunc.get(item.funcId);
    if (!linha) {
      linha = {
        funcionarioId: item.funcId,
        funcionarioNome: func.nome,
        horasProd: 0,
        obrasCount: 0,
        servicosCount: 0,
        detalhes: [],
      };
      porFunc.set(item.funcId, linha);
    }
    const servico = item.servicoId ? servicosById.get(item.servicoId) : null;
    const obraId = servico?.obraId ?? null;
    const obraNome = obraId ? (obrasById.get(obraId)?.nome ?? `Obra ${obraId}`) : '—';
    linha.detalhes.push({
      obraId,
      obraNome,
      servicoId: item.servicoId,
      servicoNome: servico?.nome ?? '— Sem serviço vinculado —',
      horas: item.horas,
      percentual: 0, // calculado depois
    });
    linha.horasProd += item.horas;
  }

  // 4) calcula percentual + counts + sort detalhes
  for (const linha of porFunc.values()) {
    linha.obrasCount = new Set(linha.detalhes.map((d) => d.obraId).filter(Boolean)).size;
    linha.servicosCount = new Set(linha.detalhes.map((d) => d.servicoId).filter(Boolean)).size;
    linha.detalhes.sort((a, b) => b.horas - a.horas);
    for (const d of linha.detalhes) {
      d.percentual = linha.horasProd > 0 ? (d.horas / linha.horasProd) * 100 : 0;
    }
  }

  // 5) só funcionários com horas > 0
  return Array.from(porFunc.values()).filter((l) => l.horasProd > 0);
}
```

### 3.4 Colunas da tabela principal

| Header | Cell | Sort |
|---|---|---|
| `▶` (chevron) | `<button>` que dispara `row.toggleExpanded()` | — |
| Funcionário | `linha.funcionarioNome` | sim (text filter via column filter do DataTable) |
| Horas | `formatHoras(linha.horasProd)` ("42,0") | sim — **default DESC** |
| Obras | `linha.obrasCount` | sim |
| Serviços | `linha.servicosCount` | sim |

`formatHoras(n: number)` = `n.toFixed(1).replace('.', ',')`.

### 3.5 Sub-row (expand)

Função `renderExpanded(linha: LinhaFunc)` retorna uma sub-tabela compacta:

```tsx
<div className="px-4 py-3 bg-[var(--color-surface-2)]">
  <table className="w-full text-sm">
    <thead>
      <tr className="text-xs text-[var(--color-fg-muted)] border-b border-[var(--color-border)]">
        <th className="text-left py-2">Obra</th>
        <th className="text-left py-2">Serviço</th>
        <th className="text-right py-2">Horas</th>
        <th className="text-right py-2 pr-2">%</th>
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
```

### 3.6 Footer da tabela principal

```tsx
renderFooter={(rows) => {
  const totalH = rows.reduce((acc, r) => acc + r.horasProd, 0);
  return (
    <span className="text-xs text-[var(--color-fg-muted)]">
      {rows.length} {rows.length === 1 ? 'funcionário' : 'funcionários'} ·
      {' '}{formatHoras(totalH)} horas
    </span>
  );
}}
```

(O footer NÃO é a soma do percentual por linha — é só dimensão geral do dataset filtrado.)

---

## 4. Edge cases

| Caso | Comportamento |
|---|---|
| Funcionário sem nenhum apontamento de serviço no período | Não aparece na tabela (filter `horasProd > 0`) |
| Apontamento com `servico_id IS NULL` | Vira linha "— Sem serviço vinculado —" no expand; ainda conta horas; obra fica "—" |
| Apontamento com `tipo='improdutivo'` | Ignorado totalmente |
| Servico cujo `obra_id` não bate com obra cadastrada | Mostra "Obra {id}" como fallback (defensive) |
| 0 funcionários com horas no período | Empty state do DataTable: "Sem horas apontadas neste período" |
| Funcionário deletado mas com apontamentos antigos no período | `funcsById.get` retorna undefined → linha é descartada (não exibe órfãs) |
| `linha.horasProd === 0` (cabe acontecer se todos serviços vinculados tiverem 0h, raro) | Descartado pelo filtro final |

---

## 5. Performance

- Agregação: 1 pass `O(N apontamentos)` + 1 pass `O(M funcionários)`. Range típico 7-30 dias = 200-2000 apontamentos. Instantâneo no `useMemo`.
- DataTable já tem paginação (25 default). Pra equipes grandes (100+ funcionários) ainda é fluido.
- Auto-refresh dos dados continua sendo o existente (60s).

## 6. Performance UX: por que não worker?

Operação é puramente CPU client-side leve (<5ms pra 2000 apontamentos). Não justifica worker (lição da sessão anterior).

## 7. Acessibilidade

- Chevron tem `aria-label="Expandir detalhes de {nome}"` e `aria-expanded` reflete estado
- Sub-row tem `role="region"` e `aria-labelledby` apontando pra row do funcionário
- Click na linha INTEIRA expande (UX comum). Click em `<button>` interno usa `stopPropagation`.

## 8. Testes

| Camada | O que testa |
|---|---|
| Unit — função `agregarHorasPorFuncionario` (extrair pra arquivo separado) | Vitest puro. Casos: lista vazia, 1 funcionário 1 serviço, 1 funcionário N serviços, N funcionários, apontamento improdutivo filtrado, servico_id null, funcionário órfão, percentual soma 100 |
| Integração manual (smoke) | Abre DashboardTab em range 7d, expand uma linha, valida horas + % batem com soma |

A função de agregação fica em `src/modules/apontamento/utils/dashboardHorasFuncionario.ts` (separada da DashboardTab) pra ser unit-testada sem renderizar React.

## 9. Plano de rollback

`git revert` do PR único. Sem migration, sem schema change. Zero risco operacional.

## 10. Não-objetivos (explícitos)

- Export Excel/CSV — provavelmente útil mas escopo separado
- Horas improdutivas — escopo separado, talvez como segunda tabela
- Filtros adicionais (por funcionário específico, etc) — column filter do DataTable cobre suficientemente
- Drill-down infinito (mostrar batidas individuais por dia) — fora de escopo, vai pra HistoricoTab
- Bloco 3 modernização da DashboardTab inteira — fora; só adiciona a tabela nova; o resto mantém padrão atual

---

## 11. Métricas de sucesso

- Usuário consegue, em < 10s, identificar quem trabalhou mais no período e em quais obras/serviços
- Tabela carrega em < 100ms perceptível após filtros mudarem
- Zero queries adicionais (validado por NetworkTab)
