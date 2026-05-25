# Premium Pilots

3 telas piloto redesenhadas seguindo o `docs/design-system.md`. **Não substituem nada** — ficam ao lado pra comparação visual.

## Telas

| # | Arquivo | Versão atual (referência) | LOC original → piloto |
|--:|---|---|---|
| 1 | `01-DashboardManutencaoPremium.tsx` | `src/components/manutencao/DashboardManutencao.tsx` | 464 → ~380 |
| 2 | `02-FreteListV2Premium.tsx` | `src/components/frete/FreteListV2.tsx` | 367 → ~420 (ganha bulk select, density, sticky header) |
| 3 | `03-FreteFormPremium.tsx` | `src/components/frete/FreteForm.tsx` | 614 → ~360 (recorta pros campos principais; demonstra RHF + Zod + grupos) |

## Como visualizar

Adicione rotas temporárias em `src/App.tsx` (ou similar):

```tsx
import DashboardManutencaoPremium from '@/pages/_premium-pilot/01-DashboardManutencaoPremium';
import FreteListV2Premium from '@/pages/_premium-pilot/02-FreteListV2Premium';
import FreteFormPremium from '@/pages/_premium-pilot/03-FreteFormPremium';

// dentro do <Routes>
<Route path="/pilot/dashboard" element={<DashboardManutencaoPremium />} />
<Route path="/pilot/lista" element={<FreteListV2Premium />} />
<Route path="/pilot/form" element={<FreteFormPremium />} />
```

Depois acesse:
- http://localhost:5173/pilot/dashboard
- http://localhost:5173/pilot/lista
- http://localhost:5173/pilot/form

## Premissas

- Usam tokens semânticos via `var(--color-*)` em vez de `gray-*` / `slate-*` / `emt-verde`
- Padrões `PageHeader`, `EmptyState`, `ErrorState`, `LoadingState` (Skeleton), `KPICard`, `FilterBar` definidos inline aqui pra rodar standalone. Em produção, esses viram `ui/PageHeader.tsx` etc na Onda 2.
- Mantêm as APIs / props dos componentes originais — o consumo (modules, routes) não muda.
- Mantém deps já instaladas — não introduz lib nova.

## Limpeza

Após aprovação e merge da Onda 8, esta pasta é **deletada**.
