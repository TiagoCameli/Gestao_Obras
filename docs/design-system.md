# Design System — Gestao_Obras

> **Personalidade:** 70% Vercel (minimalismo) + 20% Linear (densidade) + 10% Stripe (forms polidos).
> **Accent:** Verde EMT `#2D7F4F` (primário) + Âmbar `#E89B17` (secundário).
> **Tom:** corporativo sério. Operacional, denso, premium.
>
> Este documento é a **bíblia visual** do app. Tudo aqui é fonte da verdade. JSX mostrado é o final — não pseudocódigo. Se o código real do app divergir, o documento ganha.

---

## Índice

- [Parte 1 — Tokens (Fase 3)](#parte-1--tokens)
- [Parte 2 — Catálogo de componentes (Fase 4)](#parte-2--catálogo-de-componentes)
- [Parte 3 — Patterns de página (Fase 5)](#parte-3--patterns-de-página)

---

# Parte 1 — Tokens

> Fonte oficial: `src/styles/theme.css`. Este documento descreve **como usar** os tokens, não os redefine.

## 1.1 Cores

### Paleta de referência (50→950)

| Família | Quando usar |
|---|---|
| `neutral-*` | Backgrounds, borders, texto. Tudo cinza vai aqui (chega de slate/zinc/stone). |
| `primary-*` | Marca / accent / sucesso. **Anchor é `primary-600`.** |
| `success-*` | Sucesso (cosmético — alias de primary nos shades grandes). |
| `danger-*` | Erros, deletes, destrutivo. Anchor `danger-600`. |
| `warning-*` | Alerta / pendente / atrasado. Anchor `warning-600`. |
| `info-*` | Links, info neutra. Anchor `info-500`. |

**Regra:** **NUNCA** use a palette scale direto em componentes (ex: `bg-primary-600`). Use sempre o token semântico.

### Tokens semânticos (uso direto)

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--color-bg` | `#F7F8FA` | `#0A0C10` | Background da página |
| `--color-surface-1` | `#FFFFFF` | `#11141A` | Cards, modais, popovers |
| `--color-surface-2` | `#F2F4F7` | `#161A21` | Recessed (table header, code) |
| `--color-surface-3` | `#E7EAF0` | `#1E232C` | Nested recessed |
| `--color-border` | `#E4E7EC` | `rgba(255,255,255,.10)` | Bordas default |
| `--color-border-strong` | `#D0D5DD` | `rgba(255,255,255,.18)` | Bordas separadoras |
| `--color-fg` | `#101828` | `#F2F4F8` | Texto primário |
| `--color-fg-muted` | `#475467` | `#B0B7C3` | Texto secundário |
| `--color-fg-subtle` | `#667085` | `#858DA0` | Texto terciário / placeholder |
| `--color-fg-disabled` | `#98A2B3` | `#5C6577` | Label desabilitado |
| `--color-accent` | `#2D7F4F` | `#3AA368` | CTA primário, marca |
| `--color-accent-hover` | `#1E5A38` | `#46BE7B` | Hover do CTA |
| `--color-accent-soft` | `#ECFDF3` | `rgba(58,163,104,.14)` | Background de chip "ativo" |
| `--color-accent-fg` | `#1E5A38` | `#7DDFA3` | Texto sobre accent-soft |
| `--color-accent-amber` | `#E89B17` | `#FFB020` | Trechos / CTA secundário |
| `--color-danger / -soft / -fg` | — | — | Estado de erro |
| `--color-warning / -soft / -fg` | — | — | Estado pendente |
| `--color-info / -soft / -fg` | — | — | Estado neutro de info |
| `--color-success / -soft / -fg` | — | — | Estado concluído |

### Como aplicar

```tsx
// ❌ ruim — Tailwind hardcoded, vira gray-slate-zinc soup
<div className="bg-white border-gray-200 text-gray-900">…</div>

// ✅ bom — usa tokens semânticos via var
<div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] text-[var(--color-fg)]">…</div>

// ✅ melhor — usa utilities helpers (definidas em index.css)
<div className="card-premium">…</div>

// ✅ excelente em forms — texto secundário
<p className="text-[var(--color-fg-muted)] text-sm">Período do faturamento.</p>
```

### Decisões semânticas (regra de equipe)

| Conceito | Token único | Por quê |
|---|---|---|
| "Salvar / Criar / Enviar" | `--color-accent` (verde) | Marca + ação positiva |
| "Excluir / Cancelar destrutivo" | `--color-danger` (vermelho) | Universal |
| "Pendente / Atrasado / Aguardando" | `--color-warning` (amber `#F79009`) | NÃO usar âmbar de marca aqui |
| "Sucesso / Concluído / Aprovado" | `--color-success` (verde escuro) | Distinto do accent |
| "Informativo / Link / Highlight neutro" | `--color-info` (azul) | Não confundir com warning |
| "Trechos / CTA quente / Highlight especial" | `--color-accent-amber` | Reservado pro Trechos / acentos secundários |

---

## 1.2 Tipografia

### Famílias

```css
--font-sans: 'Geist Variable', 'Inter', ui-sans-serif, system-ui, sans-serif;
--font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
```

`@fontsource-variable/geist` já está no package.json. Geist Variable é a primária; Inter é fallback.

### Escala (rem-based, 16px root)

| Token | px | Uso |
|---|--:|---|
| `--text-3xs` | 10 | Micro-labels (frota plates, table footers) |
| `--text-2xs` | 11 | Eyebrow, badge, table micro |
| `--text-xs` | 12 | Captions |
| `--text-sm` | 14 | Table body, secondary copy |
| `--text-base` | 16 | Body |
| `--text-lg` | 18 | Sub-headers |
| `--text-xl` | 20 | Section heading |
| `--text-2xl` | 24 | Page title (mobile) |
| `--text-3xl` | 30 | Page title (desktop) |
| `--text-4xl` | 36 | Hero numerals (KPIs) |

**Regra:** zero arbitrário `text-[NNpx]` em novo código. Se precisa de um tamanho fora da escala, propõe um novo token.

### Pesos

- `font-normal` (400) — raro, só body longo de prose
- `font-medium` (500) — labels, body de cards densos, valores
- `font-semibold` (600) — títulos, KPI numerals, CTA labels
- `font-bold` (700) — **proibido em texto normal.** Só em logo/marca.

### Letter spacing

- `tracking-tight` (`-0.02em`) — h1, h2
- `tracking-snug` (`-0.01em`) — h3, h4, big numbers
- `tracking-wider` (`+0.08em`) — eyebrow labels
- `tracking-widest` (`+0.14em`) — UPPERCASE MICRO-LABELS

### Tabular nums

**Sempre** em valores numéricos (R$, peso, KM, dias):
```tsx
<span className="tabular-nums font-mono">R$ 12.345,67</span>
```

### Hierarquia padrão de página

```tsx
<h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--color-fg)]">
  Manutenção
</h1>
<p className="text-sm text-[var(--color-fg-muted)] mt-1">
  OS abertas, custos e disponibilidade.
</p>
```

---

## 1.3 Espaçamento

> **Regra de ouro:** respeitar Tailwind 1-2-3-4-6-8-10-12-16-20-24. Nunca `p-[13px]`.

| Contexto | Classe |
|---|---|
| Page padding (mobile) | `px-4` |
| Page padding (desktop) | `px-6 lg:px-10` |
| Section gap (blocos diferentes) | `space-y-8` ou `gap-8` |
| Section gap (densos / mesma família) | `space-y-4` |
| Card padding (compact) | `p-4` |
| Card padding (default) | `p-6` |
| Form column gap | `space-y-4` |
| Form 2-col grid gap | `gap-x-4 gap-y-4` |
| Toolbar gap | `gap-2` |
| Inline icon+text | `gap-1.5` |
| Chip cluster | `gap-1` |

---

## 1.4 Radius

| Token | px | Uso |
|---|--:|---|
| `--radius-xs` | 4 | Input dentro de table row |
| `--radius-sm` | 6 | Inputs, small buttons, chips |
| `--radius-md` | 8 | Default buttons, badges |
| `--radius-lg` | 12 | Cards, dropdowns, popovers |
| `--radius-xl` | 16 | Modais, sheets |
| `--radius-2xl` | 20 | Hero panels, drawers |
| `--radius-full` | 9999 | Avatares, status dots |

**Proibido:** `rounded-[3px]`, `rounded-[5px]`, `rounded-[10px]`. Se precisa de outro, propõe novo token.

---

## 1.5 Shadows

| Token | Uso | Quando aplica |
|---|---|---|
| `--shadow-xs` | Default em cards | Sempre — base |
| `--shadow-sm` | Hover de cards clicáveis | Em hover de `<Card variant="interactive">` |
| `--shadow-md` | Dropdowns, popovers, toasts | Elevação ativa |
| `--shadow-lg` | Drawers, sheets (lateral) | Sliding panels |
| `--shadow-xl` | Modais | Centered overlay |

**Regra:** sombras são sutis (transparência ~5-12%). Nunca `shadow-2xl` em card. Reservar `xl` pro modal.

---

## 1.6 Motion

| Token | Valor | Uso |
|---|---|---|
| `--dur-fast` | 140ms | Hover, focus ring, button press |
| `--dur-base` | 220ms | Color/bg transitions, dropdowns |
| `--dur-slow` | 380ms | Drawer/sheet slide, modal fade |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Default — snap final |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Pop-in (badges, success) |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | Continuous (sliders) |

```tsx
// Snappy hover
<button className="transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:bg-[var(--color-surface-2)]">

// Smooth panel
<div className="transition-transform duration-[var(--dur-slow)] ease-[var(--ease-out)]">
```

`tw-animate-css` já está disponível pra `animate-in fade-in slide-in-from-top-2`.

---

# Parte 2 — Catálogo de componentes

> Para cada componente: **status atual no app**, **variantes obrigatórias**, **acessibilidade**, **exemplo de uso**.

## 2.1 Inputs & forms

### Button

- **Status atual:** `src/components/ui/Button.tsx` (50 LOC). ✅ Consolidado.
- **Variantes:** `primary` (verde), `secondary` (outline neutral), `ghost` (sem border), `danger` (vermelho).
- **Sizes:** `sm`, `md` (default), `lg`.
- **Estados:** default, hover, focus-visible, active, disabled, loading (spinner inline + label "Salvando…").
- **A11y:** `aria-busy={loading}`, `aria-disabled={disabled}`, `<button type="button">` por padrão.
- **Uso:**
  ```tsx
  <Button variant="primary" loading={isSaving}>Salvar</Button>
  <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
  <Button variant="danger" onClick={onDelete} size="sm">Excluir</Button>
  ```

### Input

- **Status:** `ui/Input.tsx` (25 LOC). ✅
- **Composição:** sempre com `<Label>` acima (não use `placeholder` como label).
- **A11y:** `id` obrigatório, `<label htmlFor={id}>`, `aria-invalid={!!error}`, `aria-describedby={error ? errorId : undefined}`.
- **Variantes visuais:** default, error (border-danger), success (border-success — raro), disabled.
- **Uso premium (com RHF):**
  ```tsx
  <FormField name="origem" control={form.control} render={({ field, fieldState }) => (
    <FormItem>
      <FormLabel>Origem</FormLabel>
      <FormControl>
        <Input {...field} placeholder="Cidade" aria-invalid={!!fieldState.error} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )} />
  ```

### Textarea

- **Status:** `shadcn/textarea.tsx` instalado. ✅
- **Defaults:** `rows={3}`, `resize-y`, mesma altura mínima do Input.

### Select

- **Status:** `ui/Select.tsx` legacy (60 LOC). **Migrar pra shadcn `<Select>` em ondas futuras.**
- **Recomendado novo:** `shadcn/select` (instalar).
- **Para listas grandes (>15 opções):** usar Combobox (`SmartSelect.tsx`).

### Combobox / Searchable Select

- **Status:** `ui/SmartSelect.tsx` (450 LOC). ✅ Usado em forms complexos.
- **Recomendado:** consolidar APIs entre `SmartSelect`, `ComboboxInput` e `FilterCombobox` numa onda. Hoje são 3 implementações similares.
- **A11y:** role `combobox`, `aria-expanded`, `aria-controls`, navegação por seta cima/baixo.

### DatePicker

- **Status atual:** `<input type="date">` nativo em muitos lugares (Combustivel, FreteList).
- **Recomendado:** instalar `shadcn/calendar` + `react-day-picker`. Substituir gradualmente.

### Checkbox / RadioGroup / Switch

- **Status:** Não instalados via shadcn ainda.
- **Ação:** instalar shadcn variantes (`checkbox`, `radio-group`, `switch`).

### FileUpload

- **Status atual:** `AnexosUploader` (combustivel/) — usado em Frete, Manutenção, Apontamento.
- **Issue conhecido:** upload acontece antes do submit → órfãos se INSERT falhar. **Fora do escopo de design**, mas vale anotar.

---

## 2.2 Feedback

### Toast

- **Status:** `ui/Toast.tsx` (140 LOC) com `useToast()`. ✅
- **Variantes:** `success`, `error`, `info`, `warning`.
- **A11y:** `role="status"`, `aria-live="polite"` (já em uso).
- **Posição:** bottom-right, `z-[var(--z-toast)]`.
- **Uso:**
  ```tsx
  const { showToast } = useToast();
  showToast({ kind: 'success', message: 'Frete registrado.' });
  ```

### Alert

- **Status:** instalar `shadcn/alert`. Não há reuso hoje.
- **Variantes:** `info`, `success`, `warning`, `danger`.
- **Uso:** banner inline em forms / dashboards.

### Badge

- **Status:** chip CSS utility (`.chip`, `.chip-accent`, `.chip-amber`, `.chip-danger`, `.chip-warning`, `.chip-success`, `.chip-info`) JÁ definido em `index.css`. ✅
- **Uso:**
  ```tsx
  <span className="chip chip-warning">Pendente</span>
  <span className="chip chip-success">Concluído</span>
  ```

### Skeleton

- **Status:** `ui/Skeleton.tsx` (70 LOC). ✅ Existe, subutilizado (32 ocorrências de 50+ telas).
- **Padrão:** desenhar o SKELETON com o formato do conteúdo final.
- **Anti-pattern:** `<p>Carregando…</p>` — banir em código novo.
- **Uso:**
  ```tsx
  {isLoading
    ? <div className="space-y-3">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    : <Content />}
  ```

### Spinner

- **Status:** não existe centralizado.
- **Ação:** criar `ui/Spinner.tsx` simples — usado em buttons loading e inline.

### Progress

- **Status:** instalar `shadcn/progress`. Usado em uploads.

### EmptyState ⭐

- **Status:** existe em `combustivel/v2/shared/EmptyState.tsx`. **Promover pra `ui/EmptyState.tsx` global.**
- **Props:** `icon` (Lucide), `title`, `description`, `action` (opcional, ReactNode).
- **Uso:**
  ```tsx
  <EmptyState
    icon={ClipboardList}
    title="Nenhum frete encontrado"
    description="Ajuste os filtros ou crie um novo frete."
    action={<Button onClick={onNew}>Novo frete</Button>}
  />
  ```

### ErrorState ⭐

- **Status:** existe em `combustivel/v2/shared/ErrorState.tsx`. **Promover pra `ui/ErrorState.tsx` global.**
- **Props:** `title`, `description`, `onRetry`, `error` (opcional, mostra em `<details>` colapsável).
- **Uso:**
  ```tsx
  <ErrorState
    title="Falha ao carregar fretes"
    description="Verifique sua conexão e tente novamente."
    onRetry={refetch}
    error={error}
  />
  ```

### LoadingState ⭐

- **Status:** **criar** `ui/LoadingState.tsx`.
- **Modos:** `skeleton` (default, recebe um child que renderiza N skeletons) e `inline` (spinner + texto).

---

## 2.3 Overlay

### Dialog

- **Status:** `shadcn/dialog.tsx` instalado. ✅ Mas o app usa `ui/Modal.tsx` custom em 48+ lugares.
- **Ação:** consolidar. `ui/Modal.tsx` deprecado em onda 7.
- **Sizes:** `sm` (400px), `md` (560px), `lg` (760px), `xl` (920px).
- **A11y:** Radix nativo (`aria-labelledby`, `aria-describedby`, focus trap).

### Sheet (Drawer lateral)

- **Status:** `shadcn/sheet.tsx` instalado. ✅ Mas o app usa `ui/Drawer.tsx` custom.
- **Ação:** consolidar. `ui/Drawer.tsx` deprecado em onda 7.
- **Sides:** `right` (default — usado em detalhes), `bottom` (mobile), `left` (sidebar — raro).

### Popover

- **Status:** `shadcn/popover.tsx` instalado. ✅
- **Uso:** filtros avançados, color pickers, mini forms.

### Tooltip

- **Status:** instalar `shadcn/tooltip`.
- **Uso:** ações com ícone-só, valores truncados.
- **Delay padrão:** 400ms.

### DropdownMenu

- **Status:** `shadcn/dropdown-menu.tsx` instalado. ✅ Já em uso (`FreteListV2`).
- **Padrão:** trigger é botão ícone (Lucide `MoreVertical`), menu align="end".

### Command (cmdK)

- **Status:** `shadcn/command.tsx` instalado. ✅
- **Uso futuro:** palette global de busca/navegação (futuro).

---

## 2.4 Layout

### Card

- **Status:** `shadcn/card.tsx` + `ui/Card.tsx` + utility `.card-premium`. ✅
- **Recomendação:** novo código usa **`.card-premium`** (ou `.surface-raised`) — não shadcn Card direto, porque ele não conhece os tokens locais.
- **Composição premium:**
  ```tsx
  <section className="surface-raised p-6">
    <header className="flex items-center justify-between mb-4">
      <h3 className="text-sm label-eyebrow">Resumo do mês</h3>
      <Button variant="ghost" size="sm">Ver tudo →</Button>
    </header>
    <div className="space-y-3">…</div>
  </section>
  ```

### Separator

- **Status:** utility `.hairline-divider` JÁ definida (`index.css`). ✅
- **Uso:** entre seções dentro do mesmo card.

### Accordion / Collapsible

- **Status:** instalar `shadcn/accordion` + `shadcn/collapsible`.
- **Uso:** FAQ, seções colapsáveis em formulários longos (FreteForm "Detalhes opcionais").

### Tabs

- **Status:** `shadcn/tabs.tsx` instalado. ✅ Adotado em Frota, Compras, Frete.
- **Migrar:** Combustivel, Manutencao, Apontamento, Financeiro ainda usam tabs custom — onda 5.
- **Padrão visual:**
  ```tsx
  <Tabs defaultValue="abertas">
    <TabsList className="bg-[var(--color-surface-2)] p-1 rounded-lg">
      <TabsTrigger value="abertas">Abertas</TabsTrigger>
      <TabsTrigger value="concluidas">Concluídas</TabsTrigger>
    </TabsList>
    <TabsContent value="abertas" className="mt-4">…</TabsContent>
  </Tabs>
  ```

### ScrollArea

- **Status:** instalar `shadcn/scroll-area` (custom scrollbar). Já temos override webkit-scrollbar em `index.css`.

### Sidebar

- **Status:** layout próprio em `src/layouts/`. Manter — não migrar pra shadcn sidebar (overkill).

### PageHeader ⭐ NOVO

- **Status:** **criar** `ui/PageHeader.tsx`.
- **Props:** `eyebrow?`, `title`, `description?`, `actions?` (ReactNode), `breadcrumb?` (array).
- **Layout:**
  ```tsx
  <PageHeader
    breadcrumb={[{ label: 'Operação', href: '/operacao' }, { label: 'Manutenção' }]}
    eyebrow="Dashboard"
    title="Manutenção"
    description="OS abertas, custos e disponibilidade da frota."
    actions={
      <>
        <Button variant="secondary"><FileDown className="w-4 h-4" /> PDF</Button>
        <Button><Plus className="w-4 h-4" /> Nova OS</Button>
      </>
    }
  />
  ```

---

## 2.5 Data

### Table (base)

- **Status:** `shadcn/table.tsx` instalado. ✅
- **Componente premium:** `DataTable` (criar — ver abaixo).

### DataTable ⭐

- **Status:** **criar** `ui/DataTable.tsx` wrappando TanStack Table.
- **Features obrigatórias:**
  - Sort por coluna
  - Pagination (page numbers, não só prev/next)
  - Bulk selection (checkbox + bulk actions toolbar quando >0 selecionados)
  - Column visibility toggle (DropdownMenu)
  - Density toggle (`compact` / `normal` / `comfortable`)
  - Sticky header on scroll
  - Loading state (skeleton rows)
  - Empty state via `<EmptyState>`
  - Footer com count + sum total (configurável por coluna)
- **Visual:** alternância de linhas opcional, hover muda bg, row click expandable, ações em `<DropdownMenu>` na última coluna.

### List

- **Status:** `<ul>` HTML cru em 7 lugares.
- **Ação:** quando virar dado tabular real → DataTable. Quando é lista linear (ex: top 10 equipamentos), manter `<ul>` mas usar `TopList` padronizado (já em DashboardManutencao).

### Calendar

- **Status:** instalar `shadcn/calendar`.
- **Uso:** AprovacaoTab (Apontamento RH), filtros de período.

### Avatar / AvatarGroup

- **Status:** instalar `shadcn/avatar`.
- **Uso:** Funcionarios, motoristas em Fretes (foto principal).

---

## 2.6 Navigation

### Breadcrumb

- **Status:** instalar `shadcn/breadcrumb` ou usar embutido em `PageHeader`.
- **Padrão:**
  ```tsx
  <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)]">
    <a href="/operacao" className="hover:text-[var(--color-fg)]">Operação</a>
    <ChevronRight className="w-3 h-3 inline mx-1" aria-hidden />
    <span className="text-[var(--color-fg)]">Manutenção</span>
  </nav>
  ```

### Pagination

- **Status:** custom inline em `FreteListV2`. **Padronizar** dentro do `DataTable`.

### CommandPalette

- **Status:** `shadcn/command.tsx` instalado.
- **Roadmap:** ⌘K global pra navegação (futuro).

---

# Parte 3 — Patterns de página

> Cada padrão tem JSX final + checklist de aceite.

## 3.1 Page Header

```tsx
import { ChevronRight, Plus, FileDown } from 'lucide-react';
import Button from '@/components/ui/Button';

export function PageHeader({
  breadcrumb, eyebrow, title, description, actions,
}: {
  breadcrumb?: { label: string; href?: string }[];
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
      <div className="min-w-0">
        {breadcrumb && (
          <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-fg-muted)] mb-1.5">
            {breadcrumb.map((b, i) => (
              <span key={i}>
                {b.href
                  ? <a href={b.href} className="hover:text-[var(--color-fg)] transition-colors">{b.label}</a>
                  : <span className="text-[var(--color-fg)]">{b.label}</span>}
                {i < breadcrumb.length - 1 && (
                  <ChevronRight className="w-3 h-3 inline mx-1 opacity-60" aria-hidden />
                )}
              </span>
            ))}
          </nav>
        )}
        {eyebrow && <p className="label-eyebrow mb-1">{eyebrow}</p>}
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--color-fg)]">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-[var(--color-fg-muted)] mt-1 max-w-2xl">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </header>
  );
}
```

**Aceite:** title legível mobile + desktop · breadcrumb opcional · ações alinhadas à direita no desktop, embaixo no mobile · spacing consistente entre páginas.

---

## 3.2 Filter Bar

```tsx
import { Search, X } from 'lucide-react';

export function FilterBar({
  search, onSearchChange,
  chips,
  actions,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  chips?: { label: string; value: string; onRemove: () => void }[];
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 mb-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-fg-subtle)]" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar…"
            className="w-full h-9 pl-9 pr-3 text-sm rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus-visible:border-[var(--color-accent)] transition-colors duration-[var(--dur-fast)]"
          />
        </div>
        {actions}
      </div>
      {chips && chips.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {chips.map((c) => (
            <button
              key={c.value}
              onClick={c.onRemove}
              className="chip chip-accent group hover:opacity-80 transition-opacity"
              type="button"
            >
              {c.label}
              <X className="w-3 h-3" aria-label="Remover filtro" />
            </button>
          ))}
          {chips.length > 1 && (
            <button
              onClick={() => chips.forEach((c) => c.onRemove())}
              className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] underline underline-offset-2 ml-1"
            >
              Limpar tudo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

**Aceite:** busca à esquerda + chips ativos abaixo + ações à direita · chip clicável remove o filtro · "Limpar tudo" só aparece com >1 chip.

---

## 3.3 Data Table (composição)

Ver `_premium-pilot/02-FreteListV2Premium.tsx` pro exemplo completo. Componentes obrigatórios:

```tsx
<div className="surface-raised overflow-hidden">
  {/* Toolbar: count selecionados (esquerda) + actions (direita) */}
  {selecionados.length > 0 && (
    <div className="flex items-center justify-between px-4 py-2 bg-[var(--color-accent-soft)] border-b border-[var(--color-border)]">
      <span className="text-sm font-medium text-[var(--color-accent-fg)]">
        {selecionados.length} selecionado{selecionados.length > 1 ? 's' : ''}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBulkExport}>Exportar</Button>
        <Button variant="danger" size="sm" onClick={onBulkDelete}>Excluir</Button>
      </div>
    </div>
  )}

  {/* Sticky header table */}
  <div className="overflow-auto max-h-[calc(100vh-280px)]">
    <table className="w-full text-sm">
      <thead className="sticky top-0 z-[var(--z-sticky)] bg-[var(--color-surface-2)]/90 backdrop-blur-sm">
        <tr>
          <th className="w-10 px-3 py-2.5">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
          </th>
          {/* …colunas com sort */}
        </tr>
      </thead>
      <tbody>
        {/* rows com hover:bg-[var(--color-surface-1)] group */}
      </tbody>
      {/* footer total */}
    </table>
  </div>

  {/* Paginação */}
  <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--color-border)] bg-[var(--color-surface-2)]/30 text-xs">
    {/* count + paginação numerada */}
  </div>
</div>
```

**Aceite:** sticky header · checkbox bulk · ações revealed on hover · paginação numerada (não só prev/next) · loading state (skeleton rows) · empty state via `<EmptyState>` · footer com count.

---

## 3.4 Empty State

```tsx
import { ClipboardList, type LucideIcon } from 'lucide-react';

export function EmptyState({
  icon: Icon = ClipboardList,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="surface-raised p-10 text-center">
      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center">
        <Icon className="w-6 h-6 text-[var(--color-fg-subtle)]" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-[var(--color-fg)]">{title}</p>
      {description && (
        <p className="text-xs text-[var(--color-fg-muted)] mt-1 max-w-sm mx-auto">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
```

**Aceite:** ícone discreto · título + descrição · CTA opcional · centralizado · sem ilustração cartoon.

---

## 3.5 Loading State

**Sempre skeleton com formato do conteúdo final.**

```tsx
// Lista
<div className="space-y-2">
  {Array.from({ length: 5 }).map((_, i) => (
    <div key={i} className="surface-raised p-4 flex items-center gap-3">
      <Skeleton className="w-10 h-10 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  ))}
</div>

// Dashboard KPIs
<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
  {Array.from({ length: 8 }).map((_, i) => (
    <Skeleton key={i} className="h-20 rounded-xl" />
  ))}
</div>

// Tabela
<table>
  <tbody>
    {Array.from({ length: 8 }).map((_, i) => (
      <tr key={i} className="border-t border-[var(--color-border)]">
        {Array.from({ length: 6 }).map((_, j) => (
          <td key={j} className="px-3 py-3"><Skeleton className="h-4" /></td>
        ))}
      </tr>
    ))}
  </tbody>
</table>
```

**Banido:** `<p>Carregando…</p>` em código novo.

---

## 3.6 Error State

```tsx
import { AlertCircle } from 'lucide-react';

export function ErrorState({
  title = 'Algo deu errado',
  description = 'Não conseguimos carregar os dados.',
  onRetry,
  error,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  error?: Error | string;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] p-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-[var(--color-danger)] shrink-0 mt-0.5" aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--color-danger-fg)]">{title}</p>
          <p className="text-xs text-[var(--color-danger-fg)]/85 mt-1">{description}</p>
          {error && (
            <details className="mt-2">
              <summary className="text-xs text-[var(--color-fg-muted)] cursor-pointer">Detalhes técnicos</summary>
              <pre className="text-xs font-mono mt-1 p-2 bg-[var(--color-surface-1)] rounded overflow-auto max-h-32">
                {typeof error === 'string' ? error : (error.message + '\n' + error.stack)}
              </pre>
            </details>
          )}
          <div className="flex items-center gap-2 mt-3">
            {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Tentar novamente</Button>}
            <a href="mailto:suporte@…" className="text-xs text-[var(--color-fg-muted)] underline">
              Reportar problema
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Aceite:** ícone semântico · título + descrição amigável · botão retry · link reportar · detalhes técnicos colapsáveis (não esconder, mas não assustar).

---

## 3.7 Formulário (RHF + Zod)

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/shadcn/form';

const schema = z.object({
  origem: z.string().min(1, 'Obrigatório'),
  destino: z.string().min(1, 'Obrigatório'),
  peso: z.number().positive('Peso deve ser maior que zero'),
});

export function FreteFormPremium({ initial, onSubmit, onCancel }) {
  const form = useForm({ resolver: zodResolver(schema), defaultValues: initial });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

        {/* Grupo 1 — Trecho */}
        <fieldset className="space-y-4">
          <legend className="label-eyebrow">Trecho</legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
            <FormField control={form.control} name="origem" render={({ field }) => (
              <FormItem>
                <FormLabel>Origem</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="destino" render={({ field }) => (
              <FormItem>
                <FormLabel>Destino</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </fieldset>

        <div className="hairline-divider" />

        {/* Grupo 2 — Carga */}
        <fieldset className="space-y-4">
          <legend className="label-eyebrow">Carga</legend>
          {/* …campos */}
        </fieldset>

        {/* …mais grupos */}

        {/* Footer sticky com ações */}
        <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-4 bg-[var(--color-surface-1)] border-t border-[var(--color-border)] flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" loading={form.formState.isSubmitting}>
            {initial ? 'Salvar alterações' : 'Registrar frete'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

**Aceite:** 1 coluna mobile, 2 col desktop · labels acima · errors inline (`<FormMessage>`) · eyebrow por grupo · separators hairline entre grupos · footer sticky com primary direita.

---

## 3.8 Drawer de detalhe

```tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/shadcn/sheet';

<Sheet open={open} onOpenChange={setOpen}>
  <SheetContent side="right" className="w-full sm:max-w-[640px] p-0 flex flex-col">

    {/* Header sticky */}
    <SheetHeader className="sticky top-0 z-10 bg-[var(--color-surface-1)] border-b border-[var(--color-border)] px-6 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label-eyebrow mb-1">Frete #{frete.id.slice(0,6)}</p>
          <SheetTitle className="text-lg font-semibold truncate">
            {frete.origem} → {frete.destino}
          </SheetTitle>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm"><Pencil className="w-4 h-4" /></Button>
          <Button variant="ghost" size="sm" className="text-[var(--color-danger)]"><Trash2 className="w-4 h-4" /></Button>
        </div>
      </div>
    </SheetHeader>

    {/* Tabs internas */}
    <Tabs defaultValue="detalhes" className="flex-1 flex flex-col min-h-0">
      <TabsList className="mx-6 mt-3 self-start">
        <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
        <TabsTrigger value="historico">Histórico</TabsTrigger>
      </TabsList>

      {/* Corpo scrollável */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <TabsContent value="detalhes" className="mt-0 space-y-6">…</TabsContent>
        <TabsContent value="historico" className="mt-0">…</TabsContent>
      </div>
    </Tabs>

    {/* Footer com ações */}
    <SheetFooter className="border-t border-[var(--color-border)] px-6 py-3 bg-[var(--color-surface-1)]">
      <Button variant="secondary" onClick={() => setOpen(false)}>Fechar</Button>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

**Aceite:** header sticky · corpo scrollável · footer com ações · tabs internas opcionais · slide-in 380ms ease-out.

---

## 3.9 Dashboard Stat Card (KPI)

```tsx
import { type LucideIcon } from 'lucide-react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

export function KPICard({
  label, valor, legenda, delta, deltaPositiveMeans = 'good',
  icon: Icon, intent = 'neutral', onClick,
}: {
  label: string;
  valor: string | number;
  legenda?: string;
  delta?: { value: number; period: string };
  deltaPositiveMeans?: 'good' | 'bad'; // pra inverter cores (custo subiu = ruim)
  icon?: LucideIcon;
  intent?: 'neutral' | 'success' | 'danger' | 'warning' | 'info';
  onClick?: () => void;
}) {
  const intentBg = {
    neutral: 'bg-[var(--color-surface-2)] text-[var(--color-fg)]',
    success: 'bg-[var(--color-success-soft)] text-[var(--color-success-fg)]',
    danger:  'bg-[var(--color-danger-soft)] text-[var(--color-danger-fg)]',
    warning: 'bg-[var(--color-warning-soft)] text-[var(--color-warning-fg)]',
    info:    'bg-[var(--color-info-soft)] text-[var(--color-info-fg)]',
  }[intent];

  const deltaIsGood = (delta?.value ?? 0) > 0
    ? deltaPositiveMeans === 'good'
    : deltaPositiveMeans === 'bad';

  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={
        'surface-raised p-4 text-left flex items-start gap-3 transition-all duration-[var(--dur-fast)] ' +
        (onClick ? 'hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-sm)] cursor-pointer' : '')
      }
    >
      {Icon && (
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${intentBg}`}>
          <Icon className="w-5 h-5" aria-hidden />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="label-eyebrow truncate">{label}</p>
        <p className="text-2xl font-semibold tabular-nums text-[var(--color-fg)] mt-1 tracking-snug">
          {valor}
        </p>
        {(legenda || delta) && (
          <div className="flex items-center gap-2 mt-1">
            {delta && (
              <span className={
                'inline-flex items-center gap-0.5 text-2xs font-semibold tabular-nums ' +
                (delta.value === 0
                  ? 'text-[var(--color-fg-muted)]'
                  : deltaIsGood ? 'text-[var(--color-success-fg)]' : 'text-[var(--color-danger-fg)]')
              }>
                {delta.value > 0 ? <ArrowUp className="w-3 h-3" /> : delta.value < 0 ? <ArrowDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                {Math.abs(delta.value).toFixed(1)}%
              </span>
            )}
            {legenda && (
              <span className="text-2xs text-[var(--color-fg-subtle)] truncate">{legenda}</span>
            )}
          </div>
        )}
      </div>
    </Tag>
  );
}
```

**Aceite:** label uppercase tracking-wider · número grande tabular semibold · delta com cor semântica (inverte se subir é ruim, ex: custo) · ícone à esquerda com bg semântico · clicável vira `<button>` com hover state.

---

## Anexo — anti-patterns

- ❌ `<p>Carregando…</p>` — usar Skeleton
- ❌ `text-[10px]`, `text-[11px]` — usar `text-3xs` / `text-2xs` (após adicionar tokens)
- ❌ `bg-gray-100`, `text-slate-600` — usar `bg-[var(--color-surface-2)]`, `text-[var(--color-fg-muted)]`
- ❌ `text-emt-verde`, `bg-emt-verde` — usar `text-[var(--color-accent)]`, `bg-[var(--color-accent)]`
- ❌ `alert('Erro')` / `window.confirm(...)` — usar `useToast()` + `<ConfirmDialog>`
- ❌ `font-bold` em texto — usar `font-semibold`
- ❌ `<input>` cru em form novo — usar `<Input>` (que aplica focus ring premium)
- ❌ Modal/Drawer custom — usar `shadcn/dialog` + `shadcn/sheet`
- ❌ Inline styles estáticos (`style={{ padding: 16 }}`) — usar Tailwind classes
- ❌ `<table>` HTML cru — usar `<DataTable>` ou TanStack direto

---

## Anexo — proibições de acessibilidade

- ❌ Input sem `<label htmlFor={id}>` (ou `aria-label`)
- ❌ Botão icon-only sem `aria-label` ou `<span className="sr-only">`
- ❌ Color contrast < 4.5:1 em texto normal (WCAG AA)
- ❌ Mudança de cor como única forma de comunicar erro (use ícone + texto também)
- ❌ Disabled sem `aria-disabled` (Radix faz automático, mas inputs nativos não)
- ❌ Modal sem trap focus (Radix faz automático via shadcn Dialog)
