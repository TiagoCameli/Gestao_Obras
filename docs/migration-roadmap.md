# Migration Roadmap — Frontend Premium

> Plano de execução em **8 ondas curtas** (1-2 dias cada). Cada onda é independente, mergeada antes da próxima. Critério guia: o app continua 100% funcional ao final de cada onda. Nada de big-bang.

**Total estimado:** ~10-14 dias úteis · 60-90h de trabalho.

---

## Pré-requisitos (1 vez, antes da Onda 1)

- [ ] Aprovação dos 5 entregáveis desta sessão (`frontend-audit.md`, `docs/design-system.md`, `src/styles/theme.css`, 3 pilots em `src/pages/_premium-pilot/`, este arquivo)
- [ ] Snapshot do estado atual: `git tag pre-frontend-premium-$(date +%Y%m%d)` pra rollback total se desastre
- [ ] Criar branch `feat/frontend-premium-foundation`
- [ ] Coletar baseline de Lighthouse das 3 telas piloto (pra comparar depois)

---

## ONDA 1 — Fundação (1 dia / ~6h) 🟢 RISCO BAIXO

**Objetivo:** instalar o `theme.css` novo + componentes shadcn faltantes. Zero refactor visual ainda.

### Tarefas

1. **Mover @theme do `src/index.css` pro `src/styles/theme.css`** (já entregue)
   - Atualizar `src/index.css` pra `@import "./styles/theme.css"` no início
   - Manter no `index.css` apenas: base styles, compat layer (`.dark .bg-gray-*`), utilities (`.surface-raised` etc)
2. **Instalar shadcn components faltantes** via CLI:
   ```bash
   npx shadcn@latest add tooltip alert progress avatar accordion collapsible scroll-area calendar checkbox switch radio-group select form badge
   ```
3. **Promover `EmptyState` e `ErrorState`** de `src/components/combustivel/v2/shared/` pra `src/components/ui/`
4. **Criar `src/components/ui/LoadingState.tsx`** (skeleton wrapper) e `src/components/ui/PageHeader.tsx` (conforme spec do design-system.md)
5. **Criar `src/components/ui/Spinner.tsx`** (simples — usado em loading buttons)

### Arquivos afetados

```
src/styles/theme.css              [NEW — já existe]
src/index.css                     [MODIFY — refatorar import]
src/components/ui/EmptyState.tsx  [NEW — promote from combustivel/v2]
src/components/ui/ErrorState.tsx  [NEW — promote from combustivel/v2]
src/components/ui/LoadingState.tsx [NEW]
src/components/ui/PageHeader.tsx  [NEW]
src/components/ui/Spinner.tsx     [NEW]
src/components/shadcn/tooltip.tsx [NEW via CLI]
src/components/shadcn/alert.tsx   [NEW via CLI]
src/components/shadcn/progress.tsx [NEW]
src/components/shadcn/avatar.tsx  [NEW]
src/components/shadcn/accordion.tsx [NEW]
src/components/shadcn/collapsible.tsx [NEW]
src/components/shadcn/scroll-area.tsx [NEW]
src/components/shadcn/calendar.tsx [NEW]
src/components/shadcn/checkbox.tsx [NEW]
src/components/shadcn/switch.tsx  [NEW]
src/components/shadcn/radio-group.tsx [NEW]
src/components/shadcn/select.tsx  [NEW]
src/components/shadcn/form.tsx    [NEW]
src/components/shadcn/badge.tsx   [NEW]
```

### Critério de aceite

- [ ] `npm run dev` sobe sem erro
- [ ] `npm run build` passa
- [ ] Visual de TODAS as páginas existentes inalterado (tokens nos lugares antigos)
- [ ] Storybook (se existir) verde
- [ ] Lighthouse das 3 piloto **mantém ou melhora** score
- [ ] Novos componentes (`EmptyState`, `ErrorState`, `LoadingState`, `PageHeader`) importam e renderizam isoladamente

### Rollback

```bash
git checkout main && git branch -D feat/frontend-premium-foundation
```
Sem migrações de banco, sem schema changes. Reverter é só apagar branch.

---

## ONDA 2 — Components de página (1 dia / ~6h) 🟢 RISCO BAIXO

**Objetivo:** plugar `PageHeader`, `EmptyState`, `LoadingState`, `ErrorState` em 5-7 páginas representativas. Antes/depois visual.

### Tarefas

1. **5-7 páginas pra refatorar (escolha por impacto):**
   - `src/pages/Manutencao.tsx` → usa `PageHeader`
   - `src/pages/Frete.tsx` → usa `PageHeader` + `EmptyState` quando lista vazia
   - `src/pages/Frota.tsx` → `PageHeader` + `EmptyState`
   - `src/pages/Funcionarios.tsx` → `PageHeader`
   - `src/pages/Compras.tsx` → `PageHeader`
   - `src/pages/Combustivel.tsx` → `PageHeader`
   - `src/pages/Financeiro.tsx` → `PageHeader`

2. **Substituir TODOS os `<p>Carregando…</p>` em essas páginas** por `<LoadingState>` ou skeletons inline (formato do conteúdo final).

3. **Substituir empty inline (`<div>Nenhum ...</div>`)** por `<EmptyState>` com ícone + CTA.

4. **Substituir erros (`alert()`, console-only)** por `<ErrorState>` ou Toast.

### Antes/Depois (capturar prints)

- Frota: header atual (gradiente + ID obra) → header novo (eyebrow + h1 + actions)
- Manutencao: `<p>Carregando…</p>` → skeleton com KPI placeholders
- Frete: empty atual (texto solto) → EmptyState premium

### Critério de aceite

- [ ] 5-7 páginas com header consistente (mesma tipografia, mesmo spacing)
- [ ] Zero `<p>Carregando…</p>` em páginas refatoradas (loading via Skeleton)
- [ ] Zero `alert()` em fluxos refatorados
- [ ] Compare lado a lado: visual fica MELHOR e MAIS CONSISTENTE
- [ ] Smoke test manual: cada página abre, carrega, paginar/filtrar funciona

### Rollback

Reverter PR. Mudanças localizadas a 5-7 arquivos page-level.

---

## ONDA 3 — DataTable (1-2 dias / ~10h) 🟡 RISCO MÉDIO

**Objetivo:** criar `ui/DataTable.tsx` premium e migrar 2 listas principais.

### Tarefas

1. **Criar `src/components/ui/DataTable.tsx`** wrappando TanStack Table com:
   - Sort, paginação numerada, bulk select, column visibility, density toggle, sticky header, footer com totalizações, loading skeleton, empty state
   - API:
     ```tsx
     <DataTable
       columns={columns}
       data={data}
       isLoading={isLoading}
       empty={{ icon: Plus, title: '…', description: '…', action: <Button>Novo</Button> }}
       enableBulkActions
       bulkActions={(selected) => <><Button onClick={…}>Exportar {selected.length}</Button></>}
       density="normal"
       footer={(rows) => ({ totalRow: { peso: sum('pesoToneladas'), valor: sum('valorTotal') } })}
     />
     ```

2. **Migrar `src/components/frete/FreteListV2.tsx`** pra usar `DataTable` — 367 LOC → ~180 LOC. Já é TanStack, é só refatorar pra wrapper.

3. **Migrar `src/components/frota/FrotaList.tsx`** pra `DataTable` (precisa identificar — pode ser uma `FrotaGrid` que faz `.map`).

### Arquivos afetados

```
src/components/ui/DataTable.tsx        [NEW ~300 LOC]
src/components/ui/data-table/columns.ts [NEW — helpers]
src/components/frete/FreteListV2.tsx   [MODIFY — refactor pra usar DataTable]
src/components/frota/FrotaList.tsx     [MODIFY] OR src/components/frota/FrotaGrid.tsx
```

### Critério de aceite

- [ ] FreteListV2 visualmente igual ou melhor (mesmo dado, ações idênticas)
- [ ] Bulk select funciona; bulk delete pede confirm + Toast sucesso
- [ ] Density toggle muda visualmente
- [ ] Sticky header não bloqueia conteúdo
- [ ] Paginação numerada (não só prev/next)
- [ ] Footer mostra count + sum quando aplicável
- [ ] FrotaList visual unificado com FreteListV2

### Rollback

Manter `FreteListV2` antigo como `FreteListV2.legacy.tsx` por 1 semana. Trocar import nos 1-2 lugares que usam. Se quebrar, troca import de volta.

---

## ONDA 4 — Forms módulo Frete (1-2 dias / ~10h) 🟡 RISCO MÉDIO

**Objetivo:** migrar TODOS os forms do módulo Frete pra `react-hook-form` + `zod` + grupos visuais.

### Tarefas

1. **`src/components/frete/FreteForm.tsx`** (614 LOC) → refatorar conforme pilot `03-FreteFormPremium.tsx`:
   - RHF + Zod schema
   - 5 grupos com eyebrow + hairline-divider
   - Footer sticky com primary direita
   - Validação inline com aria-invalid + aria-describedby
   - Computed values como chips (.surface-sunken), não inputs feios
2. **`src/components/frete/PagamentoFreteForm.tsx`** → mesma estrutura, escopo menor
3. **`src/components/frete/PedidoMaterialForm.tsx`** → mesma estrutura
4. **`src/components/frete/ImportAtualizacaoFretesModal.tsx`** → preview "vai mudar X pra Y" antes do commit em massa (era um gap conhecido do frete-audit)

### Arquivos afetados

```
src/components/frete/FreteForm.tsx                       [MODIFY ~370 LOC após refactor]
src/components/frete/PagamentoFreteForm.tsx              [MODIFY]
src/components/frete/PedidoMaterialForm.tsx              [MODIFY]
src/components/frete/ImportAtualizacaoFretesModal.tsx    [MODIFY — adicionar preview]
src/schemas/frete.ts                                     [NEW — zod schemas]
```

### Critério de aceite

- [ ] Forms validam inline (erro aparece abaixo do input)
- [ ] Submit desabilitado só com erros, não silenciosamente
- [ ] Botão "Salvar" mostra loading inline (não trava)
- [ ] Computed (Valor total) atualiza ao vivo, formatado pt-BR
- [ ] Mobile (360px) não quebra
- [ ] Acessibilidade: tab order correto, errors lidos por screen reader
- [ ] Smoke test: criar + editar + delete cada entidade funciona

### Rollback

Forms são localizados. Reverter PR. Sem impacto no schema do banco.

---

## ONDA 5 — Forms módulos Frota + Combustível + RH (1-2 dias / ~10h) 🟡 RISCO MÉDIO

**Objetivo:** estender o padrão RHF+Zod pros 3 módulos críticos.

### Tarefas

- **Frota:** `EquipamentoFormFrota.tsx` (550 LOC), `DocumentoForm`, `EspecificacoesForm`, `FinanceiroForm` → migrar
- **Combustível:** `SaidaCombustivelForm.tsx` (1028 LOC — mega) — pode ser dividido em 2 abas internas pra reduzir complexidade visual
- **RH:** `FuncionarioForm.tsx` (603 LOC) → migrar + adicionar campo `salario_base` que está faltando (gap conhecido do apontamento-rh-audit)

### Critério de aceite

- Mesmo da Onda 4, replicado pros 3 módulos.

### Risco

`SaidaCombustivelForm` (1028 LOC) tem lógica condicional sofisticada (campos desabilitados por tipo de consumidor). Risco de regressão lógica → testar todos os caminhos.

---

## ONDA 6 — Tabs custom → shadcn Tabs (0.5 dia / ~4h) 🟢 RISCO BAIXO

**Objetivo:** eliminar as 5 implementações de tabs custom.

### Tarefas

- `src/components/combustivel/CombustivelTabsNav.tsx` (186 LOC) → deprecar; usar shadcn Tabs
- Manutenção: trocar `if (pathname === '…')` no `Manutencao.tsx` por sub-rotas declarativas
- Apontamento RH: `ApontamentoPage.tsx` usa 7 abas custom — migrar
- Financeiro: idem
- Persistir aba selecionada na URL via querystring (`?tab=visao_geral`)

### Critério de aceite

- Visual idêntico ao atual (ou MELHOR — shadcn é mais polido)
- URL persiste aba selecionada (reload mantém)
- Mobile: tabs scroll horizontal sem quebrar

### Rollback

Localizado. Trocar componente de volta.

---

## ONDA 7 — Modal/Drawer custom → shadcn Dialog/Sheet (1 dia / ~6h) 🟡 RISCO MÉDIO

**Objetivo:** deprecar `ui/Modal.tsx`, `ui/Drawer.tsx`, `ui/ConfirmDialog.tsx`. 48+ wrappers especializados continuam (composições válidas).

### Tarefas

1. **Migrar wrappers especializados** pra usar `shadcn/dialog` + `shadcn/sheet` por baixo:
   - Compras: 8 modais
   - Manutenção: 7 modais
   - Combustível: 6 modais
   - Frota: 5 modais
   - Financeiro: 4 modais
   - Frete: 4 modais (incluindo FreteDetalhesDrawer)
2. **`ui/ConfirmDialog.tsx`** → usar shadcn `AlertDialog` (instalar via CLI primeiro)
3. **`ui/PasswordDialog.tsx`** → usar shadcn `Dialog`
4. **Eliminar `alert()` / `window.confirm()` restantes** (~4 ocorrências, frete-audit mencionou em `TransportadoraExtratoModal` e `LixeiraFreteTab`)
5. **Delete `ui/Modal.tsx`, `ui/Drawer.tsx`** quando ninguém mais importar

### Critério de aceite

- Trap focus funciona em modais (Radix nativo)
- ESC fecha, click no overlay fecha (Radix default)
- Animação slide-in 380ms ease-out (config no theme)
- Zero `alert()` no app
- Zero `window.confirm()` no app

### Rollback

Customs ainda existem até o final da onda. Se algo quebrar, manter import antigo no arquivo problemático e migrar gradual.

---

## ONDA 8 — Polish + cleanup (1 dia / ~6h) 🟢 RISCO BAIXO

**Objetivo:** acessibilidade, motion, dark mode, eliminar débito técnico.

### Tarefas

1. **Acessibilidade:**
   - Adicionar `aria-describedby` em todos os forms (deve dobrar de 0 → 50+ ocorrências)
   - Auditar botões icon-only sem `aria-label` (existem ~5)
   - Aumentar uso de `sr-only` (de 7 → 20+) pra screen readers
   - Rodar axe-core ou Lighthouse Accessibility (target: 95+)
2. **Motion:**
   - Garantir transições uniformes em hover (140ms ease-out)
   - Adicionar `tw-animate-css` em modais, drawers, toasts (animate-in fade-in slide-in)
   - Skeleton com shimmer suave
3. **Dark mode polish:**
   - Remover os 114 overrides retroativos `.dark .bg-gray-100 { ... }` do `index.css` (devem virar desnecessários após Ondas 4-7 migrarem o código pra tokens semânticos)
   - Testar manualmente as 30 telas principais em dark
4. **Eliminar inline styles ilegítimos:**
   - 26 arquivos fora do rodotracker (35% de 78 - rodotracker)
   - Substituir `style={{ padding: 16 }}` por `className="p-4"`
   - Substituir `style={{ color: '#xxx' }}` estáticos por tokens
5. **Deletar `src/pages/_premium-pilot/`** (pilots cumpriram função)
6. **Update CLAUDE.md / memória** com convenções novas

### Critério de aceite

- Lighthouse Accessibility: ≥95 nas 5 páginas principais
- Lighthouse Performance: ≥90
- Zero `<p>Carregando…</p>` em todo `src/` (fora de pilots já deletados)
- Inline styles ilegítimos fora de rodotracker: 0
- Dark mode visualmente coerente em ≥30 telas

### Rollback

Polish é incremental. Reverter PR.

---

## ONDA EXTRA — Rodotracker (opcional, separada — 2 dias) 🟠 RISCO ALTO

**Não está na rota crítica. Decidir após Onda 8.**

Rodotracker é uma ilha com:
- 438 hex arbitrários em 14 arquivos
- 6 dos 10 arquivos com mais inline styles do app
- Paleta dark hardcoded própria

**Opções:**

| Opção | Esforço | Risco |
|---|---|---|
| Migrar pros tokens do app | ~16h | Médio (visual pode mudar) |
| Manter como design system separado, documentar | ~4h | Baixo |
| Reescrever (refactor profundo) | ~40h | Alto |

**Recomendação:** **opção 2** (manter + documentar). Rodotracker funciona, tem identidade própria, é pouco tocado. Migrar só se houver demanda de UI uniforme com o resto do app.

---

## ONDA EXTRA — Mobile (opcional, separada — 2-3 dias) 🟡 RISCO MÉDIO

**Cobertura atual: 20%.**

Módulos sem mobile dedicada: Frota, Frete, Funcionarios, Compras, Financeiro, Depositos.

**Prioridade:** Frete > Compras > Financeiro (mais visitados em campo).

**Padrão:** cards stack em vez de tabela em <768px, ações em `<Sheet>` lateral em vez de modal centrado, FAB pra ação primária.

---

# Fase 8 — Quality Bar (checklist de aceite premium)

Esta tabela é o **critério objetivo** pra dizer "está premium":

## 8.1 Visual

| Critério | Como medir | Target |
|---|---|---|
| Toda página segue grid consistente | Inspecionar 10 páginas | px-6 lg:px-10 + space-y-8 |
| Cores fora da paleta | `rg "(?:bg|text|border)-(gray|slate|zinc|stone|emerald|orange)-" src --count` | 0 ocorrências (rodotracker excluído) |
| Inline styles ilegítimos | Auditoria amostral em 20 arquivos | 0 fora de rodotracker |
| Tabular-nums em valores numéricos | `rg "R\$" src -t tsx -A2` → conferir `tabular-nums` | 100% dos valores |
| Hover states | Inspeção visual de cada elemento clicável | Todos têm hover |
| Focus visible WCAG AA | `rg "focus-visible" src --count` | ≥309 (mantém ou cresce) |

## 8.2 Motion

| Critério | Target |
|---|---|
| Toda transição 140-380ms ease-out | Sem instantâneo, sem >500ms |
| Skeleton em todo loading | 0 `<p>Carregando…</p>` |
| Toast com animação entrada | slide-in 380ms |
| Modal/Drawer com animação | Radix default ok |

## 8.3 Acessibilidade

| Critério | Como medir | Target |
|---|---|---|
| Contraste mínimo 4.5:1 | Lighthouse / axe | WCAG AA |
| Navegação completa por teclado | Tab através das 5 páginas principais | Sem dead-ends |
| Screen reader testado | VoiceOver nas 3 piloto | Forms anunciam erro |
| aria-describedby em forms | `rg "aria-describedby" src --count` | ≥50 |
| sr-only em botões icon-only | `rg "sr-only" src --count` | ≥20 |

## 8.4 Performance

| Critério | Como medir | Target |
|---|---|---|
| Time to Interactive | Lighthouse mobile | <3s em 3G |
| Lighthouse Performance | 5 páginas | ≥90 |
| Lighthouse Accessibility | 5 páginas | ≥95 |
| Lighthouse Best Practices | 5 páginas | ≥95 |
| Bundle size | `npm run build` + dist size | Não regredir >10% |

## 8.5 Consistência

| Critério | Target |
|---|---|
| Mesma ação visual = mesmo componente | Audit visual amostral |
| Posição do CTA primário | Sempre direita (header, footer sticky) |
| Cor semântica respeitada | Erro=danger, sucesso=success, pendente=warning sempre |
| Eyebrow labels uppercase tracking-wider | Padrão `.label-eyebrow` aplicado |

---

# Fase 9 — Recomendações priorizadas

Tabela final pra decidir o que executar primeiro.

| Prioridade | Onda | Ação | Esforço | Impacto visível |
|:--:|--|---|--:|---|
| 🔴 ALTA | 1 | Fundação (theme.css + shadcn faltantes + EmptyState/ErrorState/LoadingState/PageHeader) | 6h | Foundation pronta |
| 🔴 ALTA | 2 | Refatorar 5-7 páginas pra usar PageHeader + EmptyState + Skeleton | 6h | Consistência visual imediata |
| 🔴 ALTA | 3 | DataTable + migrar FreteListV2 + FrotaList | 10h | Listas premium (bulk + density + sticky) |
| 🟡 MÉDIA | 4 | Forms Frete pra RHF+Zod | 10h | Validação real, UX polida |
| 🟡 MÉDIA | 5 | Forms Frota+Combustível+RH pra RHF+Zod | 10h | Cobertura ampla |
| 🟡 MÉDIA | 6 | Tabs custom → shadcn Tabs | 4h | Consistência tabs |
| 🟡 MÉDIA | 7 | Modal/Drawer custom → shadcn Dialog/Sheet | 6h | Trap focus + a11y |
| 🟢 BAIXA | 8 | Polish (a11y + motion + dark mode + inline styles + cleanup) | 6h | Quality bar 95+ |
| 🟠 OPCIONAL | extra | Rodotracker (recomendado: manter + documentar) | 4h | Sanidade |
| 🟡 OPCIONAL | extra | Mobile coverage (Frete + Compras + Financeiro) | 16h | UX em campo |

**Total mínimo viável (Ondas 1-8):** **58h** (~8-10 dias úteis a 6-7h/dia)
**Total c/ opcionais:** **78h** (~12-14 dias)

---

## Cronograma sugerido

| Semana | Ondas | Entregue |
|:--:|---|---|
| 1 | 1 + 2 | Fundação + 5-7 páginas refatoradas |
| 2 | 3 + 4 | DataTable + Forms Frete |
| 3 | 5 + 6 + 7 | Forms outros + Tabs + Modals |
| 4 | 8 + (extras) | Polish + opcionais |

---

## Métricas de sucesso (medir antes e depois)

| Métrica | Hoje | Meta pós-Onda 8 |
|---|--:|--:|
| Cores Tailwind hardcoded (gray+slate+zinc+stone) | 1.413 | <100 (rodotracker excluído) |
| `text-[10px]` / `text-[11px]` arbitrários | 559 | <50 (tokens text-2xs/3xs adotados) |
| Hex `bg-[#…]` arbitrários | 438 | <30 (rodotracker excluído) |
| Inline styles fora de rodotracker | ~26 ilegítimos | 0 |
| `<p>Carregando…</p>` | ~30 telas | 0 |
| Empty state inline (não componente) | ~20 ocorrências | 0 |
| Forms com RHF+Zod | 7 | 30+ (cobertura ~80%) |
| Lighthouse Accessibility (média 5 páginas) | ~75 | ≥95 |
| Lighthouse Performance (média 5 páginas) | ~80 | ≥90 |
| Componentes Modal/Drawer custom | 4 base | 0 (todos shadcn) |
| Tabs custom | 5 | 0 |
| Componentes globais shadcn instalados | 13 | 28+ |

---

## Comunicação aos consumidores das mudanças

**Quem precisa saber:**

- Time backend: zero impacto (frontend-only)
- QA: roteiro de regressão visual + funcional após Onda 2, 3, 5, 7
- Usuários finais (operação BR-364): comunicar "interface ficou mais polida, fluxos iguais" após Onda 8

**Não comunicar:** mudanças individuais por onda. Acumular pra release final no fim do roadmap.
