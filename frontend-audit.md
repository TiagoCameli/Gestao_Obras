# Frontend Audit — Gestao_Obras

> **Escopo:** estado visual atual do app (React 19 + Vite + Tailwind v4 + shadcn) e benchmark contra Linear / Stripe / Vercel / Notion, com decisão final de personalidade e accent color. Insumo direto pro `docs/design-system.md` e `docs/migration-roadmap.md`.

---

## Sumário executivo

| Aspecto | Veredito | Severidade |
|---|---|---|
| **Tokens semânticos (CSS vars)** | Já existem, sofisticados, com light/dark + utilities premium. Subutilizados. | 🟢 Foundation OK; problema é adoção |
| **Cores Tailwind hardcoded** | 3.225 ocorrências misturando 3-4 famílias de neutros (gray+slate+zinc+stone) | 🔴 Alta inconsistência |
| **Tipografia — tamanhos** | 3.834 instâncias arbitrárias `text-[10px]` / `text-[11px]` | 🔴 Tokens ausentes (escala incompleta) |
| **Tipografia — pesos/leading/tracking** | Bem disciplinado (`font-medium`+`font-semibold` = 93%) | 🟢 OK |
| **Espaçamento** | Respeita escala Tailwind (top: `px-3`, `py-2`, `gap-2`) | 🟢 OK |
| **Radius** | 4 valores cobrem 82% (`lg`, `xl`, `full`, `md`) | 🟢 OK |
| **Shadows** | Misto: classes Tailwind + `shadow-[var(--shadow-*)]` (63 ocorrências) | 🟡 Documentar padrão |
| **Inline styles** | 78 arquivos (50% concentrado em `rodotracker`) | 🟡 Maioria legítima; ~35% ilegítima |
| **Componentes duplicados** | Modal/Drawer custom em `/ui/` vs shadcn Sheet/Dialog instalados | 🔴 Migrar pro shadcn |
| **PageHeader** | Não existe — cada página reinventa | 🔴 Criar |
| **EmptyState / ErrorState** | Existem em `combustivel/v2/shared/` mas não foram promovidos pra global | 🟡 Promover + adotar |
| **Loading state** | `<p>Carregando…</p>` em 90% das telas (Skeleton existe, usado em 32 lugares) | 🟡 Substituir por skeleton |
| **Forms (RHF + Zod)** | 7 ocorrências de uso real; libs instaladas (`react-hook-form` 7.76, `zod` 4.4) | 🔴 Adoção baixíssima |
| **Tables** | 17 implementações; 10 TanStack + 7 HTML cru | 🟡 Unificar TanStack |
| **Acessibilidade** | `focus-visible` 309× ✅, `aria-label` 107× ✅, `aria-describedby` 0× ❌ | 🟡 B/C |
| **Mobile dedicada** | 8 páginas em `src/pages/mobile/` (~20% coverage) | 🟡 Manutencao+Combustivel OK; Frota/Frete/Funcionarios/Compras/Financeiro/Depositos sem |

---

## Fase 1 — Inventário do estado atual

### 1.1 Cores

**Total: 3.225 ocorrências hardcoded Tailwind + 1.413 tokens via `var(--color-*)` + 438 hex arbitrários (`bg-[#…]`).**

#### Por família (top 12)

| Família | Matches | Comentário |
|---|--:|---|
| **gray** | 1.074 | dominante; conflito com slate/zinc/stone |
| amber | 343 | semântico de "pendente" mas convive com yellow (29) |
| **slate** | 326 | segunda família neutra (problema) |
| green | 286 | sucesso/ativo; convive com emerald (174) |
| red | 266 | erro/excluir — replicado em ~40 botões "Excluir" |
| blue | 216 | info/link |
| emerald | 174 | duplicata semântica de green |
| sky | 94 | usado em chips de info |
| purple | 81 | uso esparso (compras?) |
| orange | 66 | shades 50-950 todos presentes (sem padrão) |
| lime | 63 | uso isolado |
| zinc + stone + neutral | 13 | resíduo, baixíssimo uso |

**Distribuição por contexto:**

| Prefixo | Matches |
|---|--:|
| `text-*` | 1.806 |
| `bg-*` | 952 |
| `border-*` | 453 |
| `ring-*` | 14 |
| `from-` / `to-` / `via-` | 0 |

✅ Praticamente zero gradientes hardcoded. Ring quase não usado (cai pros tokens shadcn).

#### Cores arbitrárias (438 ocorrências hex)

- 100% concentradas em **`src/modules/rodotracker/`** (14 arquivos) + 1 em `MobileLayout.tsx`.
- Paleta dark hardcoded: `#0f1117`, `#181b23`, `#14161e`, `#2e3345`, `#f59e0b`, `#ef4444`, `#22c55e`, `#3b82f6`, `#8b5cf6`, etc.
- **Decisão**: tratar `rodotracker` como design system isolado (ele já tem identidade própria). Não migrar tudo; documentar como "ilha" e padronizar APIs (props, hooks) para não vazar pro resto.

#### Cores semânticas — inferência

| Conceito | Implementações encontradas | Problema |
|---|---|---|
| Erro / Excluir | `text-red-500`, `text-red-600`, `text-red-700`, `text-red-800` | 4 shades pro mesmo conceito; replicado em ~40 botões |
| Sucesso | `green-*` + `emerald-*` + `var(--color-success)` | 3 sistemas paralelos |
| Pendente / Warning | `yellow-*`, `amber-*` + `var(--color-warning)` | 3 sistemas paralelos |
| Info / Link | `blue-*` + `var(--color-info)` | 2 sistemas paralelos |

#### CSS variables (theme atual em `src/index.css`)

**621 linhas** — sistema semântico próprio bem completo:
- 50+ tokens (`--color-bg`, `--color-surface-{1,2,3}`, `--color-fg{,-muted,-subtle}`, `--color-accent{,-hover,-soft,-fg}`, `--color-{danger,warning,info,success}{,-soft,-fg}`)
- Brand: `--color-accent = #2D7F4F` (verde EMT) + `--color-accent-amber = #E89B17` secundário
- Sombras layered (`--shadow-xs` → `--shadow-xl`)
- Radius scale (`--radius-sm: 6px` → `--radius-2xl: 20px`)
- Motion tokens (`--ease-out`, `--dur-fast`, `--dur-base`, `--dur-slow`)
- Utilities premium: `.card-premium`, `.surface-raised`, `.surface-glass`, `.surface-sunken`, `.ambient-bg`, `.label-eyebrow`, `.chip` + 6 variants, `.hairline-divider`

**Compatibilidade dark mode**: 114 overrides retroativos (`.dark .bg-gray-100 { … }`, `.dark .text-red-700 { … }`) tentando salvar código que ignora os tokens. Sinal forte de débito técnico — funciona, mas não escala.

**Uso atual dos tokens:**
- `bg-[var(--…)]`: 1.410 matches
- `text-[var(--…)]`: 2.788 matches
- Tokens shadcn nativos (`bg-primary`, `text-muted-foreground`): 310 matches em 33 arquivos
- Tokens legacy de marca (`emt-verde`, `emt-amarelo`): 135 matches em 35 arquivos

### Veredito 1.1

1. **Brand:** verde `#2D7F4F` (via `--color-accent`) é a marca real. Não é laranja como o brief sugeriu — laranja só aparece em ~66 ocorrências esparsas. Há um accent secundário âmbar (`--color-accent-amber #E89B17`) pro módulo Trechos / acentos calorosos.
2. **Neutros bagunçados:** `gray + slate + zinc + stone = 1.413 ocorrências em 4 famílias diferentes`. Migrar tudo pra `--color-fg/-muted/-subtle` + `--color-surface-1/2/3`.
3. **Semânticas existem mas não são usadas:** os tokens `--color-{danger,warning,info,success}` estão definidos e ignorados. Cada arquivo escolhe sua cor.
4. **Rodotracker é uma ilha:** 438 hex arbitrários, mas tudo dentro de `src/modules/rodotracker/`. Tratamento separado.
5. **114 overrides retroativos** indicam que tentou-se forçar consistência no dark mode em vez de migrar o código. **Esses overrides ficam até a migração; depois disso, são removidos onda 8.**

---

### 1.2 Tipografia

#### Tamanhos (3.834 arbitrários!)

| Token / arbitrário | Matches | Avaliação |
|---|--:|---|
| `text-sm` (14px) | 1.252 | ✅ tamanho dominante |
| `text-xs` (12px) | 1.167 | ✅ |
| `text-[10px]` | 285 | 🔴 deveria ser token `--text-3xs` |
| `text-[11px]` | 274 | 🔴 deveria ser token `--text-2xs` |
| `text-base` (16px) | 80 | ✅ |
| `text-lg` (18px) | 59 | ✅ |
| `text-2xl` (24px) | 44 | ✅ |
| `text-xl` (20px) | 28 | ✅ |
| `text-3xl` (30px) | 13 | ✅ |
| `text-4xl` (36px) | 2 | ✅ |
| `text-[12px]`, `text-[13px]`, `text-[14px]`, `text-[22px]`, `text-[28px]`, etc. | 559 outros | 🔴 |

**Diagnóstico:** o app tem necessidade real de tamanhos menores que `text-xs` (badges densos, footers de tabela, eyebrow labels, placas de frota). A escala Tailwind padrão começa em 12px — não cobre 10px e 11px.

**Solução adotada:** `theme.css` define `--text-2xs: 0.6875rem` (11px) e `--text-3xs: 0.625rem` (10px) como tokens oficiais. Após migração, os 559 arbitrários viram classes.

#### Pesos — bem disciplinado

| Peso | Matches |
|---|--:|
| `font-medium` | 921 |
| `font-semibold` | 818 |
| `font-bold` | 127 |
| `font-normal` | 31 |

✅ 93% concentrado em medium+semibold. Sem arbitrários. **Manter.**

#### Tracking / leading / mono

| Token | Matches | Uso |
|---|--:|---|
| `tracking-wider` | 217 | eyebrow labels |
| `tracking-wide` | 201 | eyebrow / placas |
| `tracking-tight` | 69 | títulos |
| `tabular-nums` | 33 arquivos | valores monetários ✅ |
| `font-mono` | 302 | códigos, valores precisos ✅ |
| `leading-tight` | 18 | títulos |
| `leading-relaxed` | 17 | prose |

✅ Uso correto. `tabular-nums` aplicado em valores monetários (esperado).

### Veredito 1.2
- **Pesos / tracking / leading:** verde. Não mexer.
- **Tamanhos:** introduzir `--text-2xs` e `--text-3xs` no theme; depois migrar 559 arbitrários.

---

### 1.3 Espaçamento

#### Padding — top 15

| Classe | Matches |
|---|--:|
| `px-3` | 1.021 |
| `py-2` | 956 |
| `px-4` | 437 |
| `py-1` | 403 |
| `px-2` | 337 |
| `py-3` | 326 |
| `py-0` | 190 |
| `p-3` | 166 |
| `px-1` | 111 |
| `p-4` | 110 |
| `pt-2` | 69 |
| `p-1` | 49 |
| `p-2` | 43 |
| `py-8` | 42 |
| `p-5` | 37 |

✅ Distribuição saudável. Apenas **5 arbitrários** (`py-[18px]`, `pt-[18px]`, etc.). Respeita escala Tailwind 1-2-3-4-5-6-8.

#### Margin

Top 5 concentra 76% do uso (mt-1, mb-1, mt-0, mb-2, mb-3). ✅

#### Gap

`gap-1` (537) + `gap-2` (572) = 81% do uso. ✅

#### Containers

- `max-w-md` (25 occ) dominante. 10 variantes diferentes — razoável.
- `w-[Npx]` arbitrários: 14-17 ocorrências de `w-[180px]`, `w-[200px]`, `w-[160px]`, etc. → indica falta de escala oficial pra widths de cards/panels. **Padronizar no design-system** (ver Fase 5).

### Veredito 1.3
✅ Sistema verde. Não migrar — só documentar regra (page padding `px-6 lg:px-10`, section gap `gap-8`, card padding `p-4` ou `p-6`).

---

### 1.4 Inline styles — 78 arquivos (não 47)

**Classificação (amostra de 20 arquivos):**

| Categoria | Estimativa | Ação |
|---|--:|---|
| LEGÍTIMO (props dinâmicas — height de chart, width %, posicionamento) | ~45% | Manter |
| ILEGÍTIMO (valores estáticos como `padding: 16`) | ~35% | Migrar pra Tailwind classes |
| CSS-vars (`style={{ color: 'var(--accent)' }}`) | ~20% | Aceitável; converter pra className `text-[var(--color-accent)]` quando estático |

**Top 10 arquivos com mais inline styles:**

| # | Arquivo | Ocorrências |
|--:|---|--:|
| 1 | `src/modules/rodotracker/components/Planning/PlanningView.tsx` | 25+ |
| 2 | `src/modules/rodotracker/components/Measurement/MeasurementView.tsx` | 20+ |
| 3 | `src/modules/rodotracker/components/Sidebar/FilterPanel.tsx` | 12 |
| 4 | `src/modules/rodotracker/components/Map/ActivityMarker.tsx` | 10 |
| 5 | `src/pages/Dashboard.tsx` | 8 |
| 6 | `src/modules/rodotracker/components/Sidebar/Sidebar.tsx` | 6 |
| 7 | `src/pages/Login.tsx` | 5 |
| 8 | `src/pages/Frete.tsx` | 4 |
| 9 | `src/components/combustivel/v2/visao-geral/KpiCard.tsx` | 3 |
| 10 | `src/modules/rodotracker/components/Form/PhotoUpload.tsx` | 3 |

**Conclusão:** 6 dos 10 top arquivos são do `rodotracker`. O módulo tem padrão visual próprio e usa inline styles porque CSS-vars não foram introduzidas lá. Migração isolada: ou se padroniza `rodotracker` (entra na onda final), ou se aceita como design system separado.

### Veredito 1.4
- Fora de `rodotracker`: ~26 arquivos com inline styles ilegítimos. Migrar como parte da onda do módulo afetado.
- Em `rodotracker`: tratar como onda própria, isolada.

---

### 1.5 Componentes duplicados / similares

| Categoria | Implementações | Status |
|---|--:|---|
| **Button** | 1 (`ui/Button.tsx`) | ✅ Consolidado |
| **Card** | 1 base + 6 especializados (DepositoCard, OSCard, KpiCard, ChartCard…) | ✅ Razoável |
| **Modal/Drawer base** | 4 customs em `/ui/` (Modal, Drawer, ConfirmDialog, PasswordDialog) | 🔴 shadcn Dialog + Sheet **já instalados**; migrar |
| **Modal/Drawer especializados** | 48 wrappers por feature | 🟡 Manter (são composições) |
| **Table** | 17 (10 TanStack + 7 HTML cru) | 🟡 Migrar HTML cru pra TanStack |
| **EmptyState** | 1 em `combustivel/v2/shared/` | 🔴 Promover pra `ui/EmptyState`; adotar global |
| **ErrorState** | 1 em `combustivel/v2/shared/` | 🔴 Promover; adotar global |
| **LoadingState (Skeleton)** | `Skeleton.tsx` existe (70 LOC); usado em 32 lugares | 🟡 Adoção baixa; o resto usa `<p>Carregando…</p>` (90% das telas) |
| **PageHeader** | **NÃO existe** | 🔴 Criar |
| **Toast** | 1 (`ui/Toast.tsx`) | ✅ |
| **FilterBar** | 1 em `frete/`; importado por outros mas não é global | 🟡 Promover pra `ui/FilterBar` |

---

### 1.6 Padrões de página

| Padrão | Estado |
|---|---|
| **Header de página** | Cada página implementa. Padrão dominante: `<header>` + h1 + buttons à direita. **PageHeader reutilizável: 🔴 não existe.** |
| **Tabs** | ✅ shadcn `<Tabs>` JÁ adotado (Frota, Compras, Frete). 5 outras telas (Combustivel, Manutencao, Apontamento, Financeiro, ?) usam tabs custom — migrar. |
| **Filter bar** | `FilterBar` existe em `frete/`. Chips de filtro ativo existem (Frota). Não é global. |
| **Empty state** | Sem componente global. Padrão dominante: `<div className="rounded-2xl border border-dashed ...">` inline. |
| **Loading state** | `<p>Carregando…</p>` em 90%. Skeleton existe mas só 32 usos. |
| **Error state** | Disperso. `useToast()` em alguns lugares; `alert()` nativo em ~4. Nenhum `<ErrorState>` global. |
| **Formulários** | 1 coluna, labels acima, error inline via `<p className="text-danger">`. **Apenas 7 forms usam react-hook-form** (lib instalada). |

### Veredito 1.6
**Padronização baixa.** Tabs já migraram (raro!), mas o resto cada arquivo reinventa. Criar 4 componentes globais (`PageHeader`, `EmptyState`, `LoadingState`, `ErrorState`) é a ação de maior impacto.

---

### 1.7 Acessibilidade

| Verificação | Resultado | Nota |
|---|---|---|
| Labels (`<label htmlFor>`) | 59 ocorrências | OK |
| `aria-label=` em inputs | 107 | OK |
| Inputs sem label adjacente | ~8 (Combobox/SmartSelect/Search interna) | Verificar |
| `focus-visible:` classes | **309** | ✅ Excelente |
| `focus:` classes | ~309 | OK |
| Override global de outline | Não encontrado | ✅ |
| `aria-label=` (geral) | 107 | OK |
| `role=` | 15+ (listbox, option, dialog, status, alert) | OK |
| `aria-describedby=` | **0** | 🔴 |
| `aria-live=` | 2 (Toast) | 🟡 |
| `aria-hidden=` | usado em icons | ✅ |
| Botões icon-only | Alguns com `title=` em vez de `aria-label` | 🟡 |
| `sr-only` | 7 | 🟡 baixo |
| `tabIndex=` | 9 (mostly `tabIndex={0}` apropriado) | OK |
| `onKeyDown=` | 23 | OK (suporte teclado) |

### Veredito 1.7
**B/C.** Foco visível é excelente (309 ocorrências). Maior gap: zero `aria-describedby` (errors em forms precisam disso), `sr-only` baixo (botões icon-only sem texto pra screen reader).

---

### 1.8 Mobile

- **8 páginas dedicadas** em `src/pages/mobile/`:
  - `MAbrirOSPage.tsx`, `MChecklistPage.tsx`, `MEquipamentoHubPage.tsx`, `MEquipamentoInfoPage.tsx`, `MEquipamentosPage.tsx`, `MMedicaoPage.tsx`, `MSaidaCombustivelPage.tsx`, `MScanPage.tsx`
- **Cobertura:** Manutenção + Combustivel + Medicao = 3 módulos com mobile decente.
- **Sem mobile:** Frota, Frete, Funcionarios, Compras, Financeiro, Depositos = 6 módulos quebram em < 768px.
- **Padrões responsivos:** `md:grid-cols-2` (38x), `md:grid-cols-3` (19x), `md:table-cell` (16x). Mobile-first via Tailwind, sem `useMediaQuery` (0 ocorrências).

### Veredito 1.8
~20% coverage mobile. Aceitável pra MVP, mas Frete/Compras/Financeiro são fluxos críticos. **Roadmap inclui onda mobile.**

---

## Fase 2 — Benchmark de referências

Pra cada referência, listo 3 características que serão adotadas e como aplicar no contexto de construtora (lotes BR-364, frota pesada, frete por trecho, manutenção, RH operacional).

### 2.1 Linear

**Características adotadas:**

1. **Densidade alta com hierarquia clara** — tabelas mostram muita informação por linha (data + origem→destino + transportadora + motorista + placa empilhados na mesma célula em `FreteListV2`). **Como aplicar:** manter padrão atual de "stack vertical micro" dentro da célula, mas com `text-2xs` (11px) pra subtitles e `font-medium text-sm` pro primário. Spacing `leading-tight` em listas.
2. **Monocromático com accents pontuais** — Linear é 90% cinza, com cor (roxo) só em status críticos. **Como aplicar:** banir uso decorativo de cor. Cor reservada pra estado semântico (danger/warning/success). Marca (verde) só em CTA primário e progress.
3. **Hover reveals** — ações ficam escondidas até hover na linha. **Como aplicar:** no DataTable, `MoreVertical` aparece com `opacity-0 group-hover:opacity-100` (já parcialmente assim). Bulk select checkboxes idem.

### 2.2 Stripe

**Características adotadas:**

1. **Formulários polidos com fields agrupados** — Stripe agrupa campos relacionados sob eyebrow labels ("Card information", "Billing"). **Como aplicar:** `FreteForm` ganha grupos "Trecho" / "Carga" / "Valores" / "Documentos" com `.label-eyebrow`. Cada grupo = `<fieldset>` com `<legend>` semântico.
2. **Micro-interações em inputs** — focus ring acompanha o input com transição suave (220ms ease-out). **Como aplicar:** já temos `*:focus-visible` global; adicionar `transition: box-shadow 140ms var(--ease-out)` nos inputs.
3. **Validation inline polida** — erro aparece abaixo do input com ícone, com slide-down 140ms. **Como aplicar:** `<FormMessage>` shadcn + `aria-describedby` + animação tw-animate-css (`animate-in slide-in-from-top-1`).

### 2.3 Vercel

**Características adotadas:**

1. **Minimalismo extremo / preto-branco-cinza** — Vercel quase não tem cor. **Como aplicar:** Page header sem fundo gradiente, sem cor de fundo decorativa. Cor exclusivamente em CTA primário, badges semânticos, indicadores.
2. **Hierarquia tipográfica forte** — H1 grande, semibold, tracking-tight. Subtítulo cinza médio. **Como aplicar:** PageHeader com h1 `text-2xl sm:text-3xl font-semibold tracking-tight` + p `text-sm text-fg-muted`. Sem h2 decorativo.
3. **Sombras quase invisíveis** — Vercel usa shadow-sm ou nada. **Como aplicar:** já temos escala (`--shadow-xs` a `--shadow-xl`); regra é **`xs` no default, `sm` no hover, `md` em dropdowns, `lg` em modals**. Nunca `xl` em cards.

### 2.4 Notion

**Características adotadas:**

1. **Friendly mas profissional** — Notion usa ícones inline em headings (📦 antes de "Inventário"). **Como aplicar:** seções de página podem ter ícone Lucide à esquerda do título (já vemos em `DashboardManutencao`). Manter discreto — `w-4 h-4 text-fg-muted`.
2. **Density toggle** — Notion deixa o usuário escolher compact/normal/comfortable. **Como aplicar:** DataTable ganha props `density: 'compact' | 'normal' | 'comfortable'` (afeta `py-` da linha: 1 / 2 / 3).
3. **Empty states ilustrados** — Notion mostra ilustração + dica de ação em telas vazias. **Como aplicar:** `<EmptyState>` global aceita `icon`, `title`, `description`, `action` (CTA opcional).

---

## Decisão final — personalidade

> **70% Vercel (minimalismo, cor escassa, sombras leves) + 20% Linear (densidade nas listas, hover reveals, monocromático) + 10% Stripe (forms polidos com micro-interações).**

**Por que não Notion?** Notion é mais "friendly" — o app é operacional/corporativo (frota pesada, manutenção, RH). Tom profissional sério > playful.

**Por que não 100% Linear?** Linear é projetado pra knowledge workers que vivem em listas de tickets. O app tem dashboards analíticos pesados (FreteDashboard 1879 LOC) que precisam de cor pra leitura (charts), eyebrow labels, KPI hierarchy — Vercel cobre isso melhor.

### Accent color

✅ **Verde EMT `#2D7F4F` (mantém).** Já é a marca real (token `--color-accent`, 1.410 ocorrências via var). Brief sugeriu laranja mas dados mostram que verde é o padrão.

**Accent secundário:** Âmbar `#E89B17` (`--color-accent-amber`). Usado em:
- Módulo Trechos (rodotracker)
- CTAs secundários quentes
- States de foco amber (não-critical)

**Regra:** verde = ação primária / marca / sucesso. Âmbar = secundário / Trechos. Vermelho = perigo. Azul = info. Âmbar/Yellow ≠ warning (warning é amarelo `#F79009`, distinto do âmbar acentuado).

### Tom

Corporativo sério — não brincalhão. Sem ícones decorativos sem razão. Sem ilustrações cartoon. Sem cores aleatórias em KPIs (KPI usa cor SE tem semântica — vencidas=danger, próximas=warning, OK=neutral).

---

## Próximos passos

1. **`src/styles/theme.css`** ✅ entregue (Fase 3)
2. **`docs/design-system.md`** ✅ entregue (Fases 3-5)
3. **`src/pages/_premium-pilot/*.tsx`** ✅ 3 telas (Fase 6)
4. **`docs/migration-roadmap.md`** ✅ 8 ondas (Fase 7)
5. **Aprovação do usuário** → executar onda por onda
