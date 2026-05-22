# Combustível — Polish & Stack Alignment Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar 5 itens MÉDIA do audit combustível (items 8, 9, 10, 12, 13) — polish visual + alinhamento com stack shadcn (data-table1, Sheet, Dialog, useToast/ConfirmDialog).

**Architecture:** Migrações pontuais. (a) Storage bucket ganha limites no servidor. (b) Substituir `alert/window.confirm/window.prompt` por `useToast`/`ConfirmDialog` já existentes. (c) Substituir header verde brilhante + zebra de marca pelos tokens do design system em 2 listas. (d) Migrar 3 listas operacionais pra `@tanstack/react-table` com sort/pagination/expand-row (espelha Fase B Frete). (e) Trocar Drawer/Modal custom por Sheet/Dialog shadcn nas mesmas telas.

**Tech Stack:** React 19, TypeScript, `@tanstack/react-table ^8.21` (já instalado), shadcn components (sheet, dialog — já adicionados em Fase B Frete), `useToast` + `ConfirmDialog` (já em `src/components/ui/`), Supabase storage.

**Branch:** `feat/combustivel-polish-stack-align` (baseada em main).

**Audit fonte:** `/Users/tiagocameli/projects/Gestao_Obras/combustivel-audit.md` — itens 8, 9, 10, 12, 13.

**Out of scope:** Item 11 (RHF+Zod migration dos 3 forms) — vai em plano separado (`2026-05-22-combustivel-forms-rhf-zod.md`).

---

## File Structure

**Migrations SQL novas:**
- `supabase/migrations/20260522120000_tighten_storage_abastecimento_fotos.sql` — MP.1

**TS modificados:**

| Arquivo | Tasks que tocam |
|---|---|
| `src/components/frota/combustivel/FrotaCombustivelContainer.tsx` | MP.2 (toast/confirm) + MP.5 (Sheet/Dialog) |
| `src/components/combustivel/v2/anomalias/AnomaliaDrawer.tsx` | MP.2 |
| `src/components/combustivel/v2/relatorios/RawExportModal.tsx` | MP.2 |
| `src/components/combustivel/v2/relatorios/PorObraModal.tsx` | MP.2 |
| `src/components/combustivel/v2/relatorios/MensalConsolidadoModal.tsx` | MP.2 |
| `src/components/combustivel/v2/relatorios/PorEquipamentoModal.tsx` | MP.2 |
| `src/components/combustivel/v2/lixeira/LixeiraTab.tsx` | MP.2 |
| `src/components/combustivel/EntradaList.tsx` | MP.3 + MP.4 |
| `src/components/combustivel/TransferenciaList.tsx` | MP.3 + MP.4 |
| `src/components/combustivel/SaidaCombustivelList.tsx` | MP.4 |
| `src/components/combustivel/SaidaDetalhesDrawer.tsx` | MP.5 |
| `src/components/combustivel/EntradaDetalhesDrawer.tsx` | MP.5 |
| `src/components/combustivel/TransferenciaDetalhesDrawer.tsx` | MP.5 |
| `src/components/frota/combustivel/TanqueDetalhesDrawer.tsx` | MP.5 |

**TS novos:**
- `src/components/combustivel/SaidaCombustivelListV2.tsx` (MP.4) — data-table replacement
- `src/components/combustivel/EntradaListV2.tsx` (MP.4)
- `src/components/combustivel/TransferenciaListV2.tsx` (MP.4)

---

## Task MP.0: Branch setup

**Files:** none

- [ ] **Step 1: Branch**

```bash
cd /Users/tiagocameli/projects/Gestao_Obras
git checkout main
git pull origin main
git checkout -b feat/combustivel-polish-stack-align
git branch --show-current
```

Expected: `feat/combustivel-polish-stack-align`.

---

## Task MP.1: Storage bucket `abastecimento-fotos` ganha limites no servidor

**Audit item 8.** Bucket sem `file_size_limit` nem `allowed_mime_types` — POST direto via API aceita qualquer arquivo. A migration Bloco 1.5 cobriu 3 buckets mas omitiu esse.

**Files:**
- Create: `supabase/migrations/20260522120000_tighten_storage_abastecimento_fotos.sql`

- [ ] **Step 1: Criar migration**

Write `supabase/migrations/20260522120000_tighten_storage_abastecimento_fotos.sql`:

```sql
-- MP.1 — Combustível: limites de tamanho e MIME no bucket abastecimento-fotos.
--
-- Audit item 8: bucket criado sem file_size_limit nem allowed_mime_types.
-- A migration tighten_storage_bucket_limits (Bloco 1.5) cobriu 3 outros
-- buckets mas omitiu abastecimento-fotos. POST direto via Storage API
-- aceitaria qualquer MIME e tamanho. Limit aplicado: 20 MB + lista MIME
-- alinhada ao apontamento-fotos (que tem o uso mais permissivo — fotos
-- de máquina + documentos NF + planilhas).

UPDATE storage.buckets
SET file_size_limit = 20971520,  -- 20 MB
    allowed_mime_types = ARRAY[
      'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/csv', 'text/plain'
    ]
WHERE id = 'abastecimento-fotos';
```

- [ ] **Step 2: Apply via MCP**

Via `mcp__plugin_supabase_supabase__apply_migration`:
- name: `tighten_storage_abastecimento_fotos`
- query: SQL above

- [ ] **Step 3: Verify**

Via `execute_sql`:
```sql
SELECT id, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'abastecimento-fotos';
```

Expected: `file_size_limit = 20971520`, `allowed_mime_types` contém 12 entradas.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260522120000_tighten_storage_abastecimento_fotos.sql
git commit -m "fix(combustivel): file_size_limit + MIME allowlist em abastecimento-fotos

Audit item 8 (MEDIUM): bucket aceitava qualquer MIME e qualquer tamanho.
A migration tighten_storage_bucket_limits (Bloco 1.5) omitiu este bucket.

Limit: 20 MB. MIME allowlist: imagens (jpeg/png/webp/heic), PDF, planilhas
Office, docs Word, CSV, TXT — alinhado ao apontamento-fotos."
```

---

## Task MP.2: Substituir `alert/confirm/prompt` por `useToast` + `ConfirmDialog`

**Audit item 9.** 14+ ocorrências de `alert()`, `window.confirm()`, `window.prompt()` espalhados pelo módulo combustível. O sistema já tem `useToast` em `src/components/ui/Toast.tsx` (kinds: `'success' | 'error' | 'info'`) e `ConfirmDialog` em `src/components/ui/ConfirmDialog.tsx`. Migrar tudo.

**Files:** 7 arquivos modificados (lista abaixo).

### Step A: FrotaCombustivelContainer.tsx — 3 ocorrências (foco principal)

- [ ] **Step A.1: Read e mapear ocorrências**

```bash
grep -n "alert(\|window.confirm\|window.prompt" src/components/frota/combustivel/FrotaCombustivelContainer.tsx
```

Esperado: 3 alerts (linhas ~230, ~235, ~429) + 1 confirm (linha ~239) + 1 prompt (linha ~429).

- [ ] **Step A.2: Add imports**

No topo do arquivo, garantir que existem:
```tsx
import { useToast } from '../../ui/Toast';
import ConfirmDialog from '../../ui/ConfirmDialog';
```

E adicionar state pra confirm/prompt modais (logo após outros `useState`):

```tsx
const { showToast } = useToast();
const [confirmState, setConfirmState] = useState<{
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
} | null>(null);
const [promptState, setPromptState] = useState<{
  open: boolean;
  title: string;
  placeholder: string;
  onConfirm: (value: string) => void;
} | null>(null);
const [promptValue, setPromptValue] = useState('');
```

- [ ] **Step A.3: Refatorar `pedirSenha` (cerca da linha 200-240)**

Encontrar o trecho que faz `alert(opts.successMessage)` e `alert(msg)`. Substituir:

```tsx
// Trocar:
alert(opts.successMessage);
// Por:
showToast({ kind: 'success', message: opts.successMessage });

// Trocar:
alert(msg);
// Por:
showToast({ kind: 'error', message: msg });
```

Para o `window.confirm()`:

```tsx
// Trocar este pattern:
if (opts?.confirmMessage && !window.confirm(opts.confirmMessage)) {
  return;
}
// ... resto do código

// Por (transformação assíncrona via state):
if (opts?.confirmMessage) {
  setConfirmState({
    open: true,
    title: 'Confirmar ação',
    message: opts.confirmMessage,
    onConfirm: () => {
      setConfirmState(null);
      // ... resto do código original aqui
    }
  });
  return;
}
// ... resto do código original
```

> NOTA: Essa refatoração transforma fluxo sync em assíncrono. Extrair o "resto do código" pra função local `executarAcao()` e chamar do `onConfirm` ou direto se sem confirm.

- [ ] **Step A.4: Refatorar `window.prompt` (linha ~429)**

Encontrar:
```tsx
const motivo = window.prompt('Por que essa anomalia está OK? (opcional)');
if (motivo === null) return; // cancelado
// ... usa motivo
```

Substituir por state-driven dialog. Adicionar handler:

```tsx
function pedirMotivoAnomalia(onConfirm: (motivo: string) => void) {
  setPromptValue('');
  setPromptState({
    open: true,
    title: 'Por que essa anomalia está OK?',
    placeholder: 'Motivo (opcional)',
    onConfirm,
  });
}
```

E na chamada original:
```tsx
// Trocar:
const motivo = window.prompt('Por que essa anomalia está OK? (opcional)');
if (motivo === null) return;
processarAnomalia(motivo);

// Por:
pedirMotivoAnomalia((motivo) => {
  setPromptState(null);
  processarAnomalia(motivo);
});
```

- [ ] **Step A.5: Renderizar ConfirmDialog + PromptDialog no JSX**

No bottom do componente, antes do `</div>` final:

```tsx
{confirmState && (
  <ConfirmDialog
    open={confirmState.open}
    title={confirmState.title}
    message={confirmState.message}
    onConfirm={confirmState.onConfirm}
    onCancel={() => setConfirmState(null)}
  />
)}
{promptState && (
  <Dialog open={promptState.open} onOpenChange={(o) => !o && setPromptState(null)}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{promptState.title}</DialogTitle>
      </DialogHeader>
      <input
        type="text"
        value={promptValue}
        onChange={(e) => setPromptValue(e.target.value)}
        placeholder={promptState.placeholder}
        className="w-full h-10 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] text-[var(--color-fg)]"
        autoFocus
      />
      <DialogFooter>
        <Button variant="ghost" onClick={() => setPromptState(null)}>Cancelar</Button>
        <Button variant="primary" onClick={() => promptState.onConfirm(promptValue)}>
          Confirmar
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)}
```

Importar:
```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../shadcn/dialog';
import Button from '../../ui/Button';
```

- [ ] **Step A.6: Build + TS check**

```bash
npx tsc -b 2>&1 | tail -5
npm run build 2>&1 | tail -3
```

Expected: zero errors.

### Step B: AnomaliaDrawer + 4 Relatórios Modals (5 arquivos, 1 alert cada)

Todas seguem padrão similar: `alert('Falha ao ...')` → `showToast({ kind: 'error', message: 'Falha ao ...' })`.

- [ ] **Step B.1: AnomaliaDrawer.tsx**

`src/components/combustivel/v2/anomalias/AnomaliaDrawer.tsx:178`:

```tsx
// Trocar:
alert('Falha ao atribuir equipamento. Tente novamente.');
// Por:
showToast({ kind: 'error', message: 'Falha ao atribuir equipamento. Tente novamente.' });
```

Garantir `import { useToast } from '../../../ui/Toast'` e `const { showToast } = useToast()` no corpo.

- [ ] **Step B.2: RawExportModal.tsx, PorObraModal.tsx, MensalConsolidadoModal.tsx, PorEquipamentoModal.tsx**

Cada um tem 1 `alert('Falha ao gerar o relatório. Tente novamente.')`. Mesma substituição.

```tsx
// Trocar em cada:
alert('Falha ao gerar o relatório. Tente novamente.');
// Por:
showToast({ kind: 'error', message: 'Falha ao gerar o relatório. Tente novamente.' });
```

Garantir `useToast` importado e `showToast` no corpo.

### Step C: LixeiraTab.tsx — 4 ocorrências (alert + confirm + alert + alert)

- [ ] **Step C.1: Mapear**

```bash
grep -n "alert(\|window.confirm" src/components/combustivel/v2/lixeira/LixeiraTab.tsx
```

Esperado: linhas ~90, ~93, ~99, ~102.

- [ ] **Step C.2: Replace**

```tsx
// Linha ~90 (alert sem permissão):
alert('Sem permissão para restaurar itens da lixeira.');
// Por:
showToast({ kind: 'error', message: 'Sem permissão para restaurar itens da lixeira.' });
return;

// Linha ~93 (confirm restaurar):
if (!window.confirm('Restaurar este registro?')) return;
// Por: usar ConfirmDialog state-driven (similar ao FrotaCombustivelContainer)

// Linha ~99 (alert sucesso):
alert('Registro restaurado.');
// Por:
showToast({ kind: 'success', message: 'Registro restaurado.' });

// Linha ~102 (alert erro):
alert('Falha ao restaurar. Tente novamente.');
// Por:
showToast({ kind: 'error', message: 'Falha ao restaurar. Tente novamente.' });
```

Setup similar de `confirmState` + `<ConfirmDialog>` no JSX.

- [ ] **Step D.1: Build + TS**

```bash
npx tsc -b 2>&1 | tail -5
npm run build 2>&1 | tail -3
```

Expected: zero errors.

- [ ] **Step D.2: Smoke verification — sem `alert`/`window.confirm`/`window.prompt` em combustível**

```bash
grep -rn "alert(\|window.confirm\|window.prompt" src/components/combustivel src/components/frota/combustivel 2>&1 | grep -v "// " | head -10
```

Expected: vazio (zero ocorrências em código ativo). Comentários `//` podem permanecer.

- [ ] **Step D.3: Commit**

```bash
git add src/components/frota/combustivel/FrotaCombustivelContainer.tsx \
        src/components/combustivel/v2/anomalias/AnomaliaDrawer.tsx \
        src/components/combustivel/v2/relatorios/RawExportModal.tsx \
        src/components/combustivel/v2/relatorios/PorObraModal.tsx \
        src/components/combustivel/v2/relatorios/MensalConsolidadoModal.tsx \
        src/components/combustivel/v2/relatorios/PorEquipamentoModal.tsx \
        src/components/combustivel/v2/lixeira/LixeiraTab.tsx
git commit -m "refactor(combustivel): substitui alert/confirm/prompt por useToast + ConfirmDialog

Audit item 9 (MEDIUM): 14+ ocorrências de alert()/window.confirm()/
window.prompt() — ponto mais amador do módulo (visual datado, bloca
event loop, sem dismissal por ESC).

Refactor:
- alert(...) → showToast({ kind, message })
- window.confirm(...) → ConfirmDialog state-driven
- window.prompt(...) → Dialog shadcn com input

Arquivos: FrotaCombustivelContainer (3 ocorrências), AnomaliaDrawer (1),
4 Relatórios Modals (1 cada = 4), LixeiraTab (4). Total: 13 substituições."
```

---

## Task MP.3: Substituir header verde brilhante em EntradaList + TransferenciaList

**Audit item 10.** `EntradaList.tsx:56` e `TransferenciaList.tsx:44` usam `<thead className="bg-emt-verde text-white">` + zebra `bg-emt-cinza-claro` + hover `bg-emt-verde-claro`. Visual datado tipo 2012. Trocar por tokens do design system.

**Files:**
- Modify: `src/components/combustivel/EntradaList.tsx`
- Modify: `src/components/combustivel/TransferenciaList.tsx`

> **Nota:** Item MP.4 (próxima task) reescreve essas listas inteiras com `@tanstack/react-table`. Se MP.4 vai substituir, MP.3 fica redundante. **Decisão:** fazer MP.3 só pra `SaidaCombustivelList.tsx` que não vai pra v2 (MP.4 só toca Entrada+Transferencia)? Errado — MP.4 toca as 3.
>
> **Decisão final:** **PULAR MP.3** — MP.4 já elimina o problema porque cria listas novas usando tokens corretos desde o início. Manter MP.3 só seria duplicar trabalho.

- [ ] **Step 1: Marcar MP.3 como subsumida por MP.4**

```bash
echo "MP.3 (header verde) subsumida pela reescrita em MP.4." >> docs/superpowers/plans/notes-mp3-mp4.txt
git add docs/superpowers/plans/notes-mp3-mp4.txt
git commit -m "docs(plan): MP.3 subsumida por MP.4 — listas reescritas com tokens corretos"
```

Continuar pra MP.4.

---

## Task MP.4: Listas operacionais migram pra `@tanstack/react-table` + tokens corretos

**Audit item 12.** 3 listas operacionais (`SaidaCombustivelList`, `EntradaList`, `TransferenciaList`) usam `<table>` + `map()` inline. Sem paginação, sort por coluna, expand-row. Com 500+ rows fica lento.

**Files:**
- Create: `src/components/combustivel/SaidaCombustivelListV2.tsx`
- Create: `src/components/combustivel/EntradaListV2.tsx`
- Create: `src/components/combustivel/TransferenciaListV2.tsx`
- Modify: `src/components/frota/combustivel/FrotaCombustivelContainer.tsx` (trocar imports)
- Delete (após smoke): `src/components/combustivel/SaidaCombustivelList.tsx`, `EntradaList.tsx`, `TransferenciaList.tsx`

> Espelha o padrão da `FreteListV2.tsx` que foi criada em Fase B. Pattern: `useReactTable` + `createColumnHelper` + sortable headers + paginação localStorage + DropdownMenu pra ações.

### Step 1: SaidaCombustivelListV2

- [ ] **Step 1.1: Create file**

Create `src/components/combustivel/SaidaCombustivelListV2.tsx` (~250 LOC). Conteúdo:

```tsx
// MP.4 — Reescrita de SaidaCombustivelList com @tanstack/react-table.
// Substitui <table> + map() inline. Pattern espelha FreteListV2 (Fase B).
//
// Features:
// - Sort por coluna (Data, Litros, Valor)
// - Paginação 25/50/100 persiste localStorage
// - DropdownMenu pra ações (Editar/Excluir) — visual consistente
// - data-saida-id em cada row pra targeting E2E determinístico

import { Fragment, useCallback, useMemo, useState } from 'react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getPaginationRowModel,
  createColumnHelper, flexRender,
  type ColumnDef, type SortingState,
} from '@tanstack/react-table';
import {
  ArrowUpDown, ArrowUp, ArrowDown, MoreVertical, Pencil, Trash2,
  Settings2, Truck, AlertCircle,
} from 'lucide-react';
import type { SaidaCombustivel, Equipamento, Obra, Insumo } from '../../types';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../shadcn/dropdown-menu';

interface Props {
  saidas: SaidaCombustivel[];
  equipamentos: Equipamento[];
  obras: Obra[];
  insumos: Insumo[];
  onEdit: (saida: SaidaCombustivel) => void;
  onDelete: (id: string) => void;
  onSelect?: (s: SaidaCombustivel) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtData(iso: string): string {
  if (!iso) return '—';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return iso;
}

const PAGE_SIZE_KEY = 'saida-combustivel-list-page-size-v2';

function getInitialPageSize(): number {
  if (typeof window === 'undefined') return 25;
  const stored = window.localStorage.getItem(PAGE_SIZE_KEY);
  const n = stored ? parseInt(stored, 10) : 25;
  return [25, 50, 100].includes(n) ? n : 25;
}

export default function SaidaCombustivelListV2({
  saidas, equipamentos, obras, insumos,
  onEdit, onDelete, onSelect,
  canEdit = true, canDelete = true,
}: Props) {
  const equipamentosMap = useMemo(() => new Map(equipamentos.map((e) => [e.id, e])), [equipamentos]);
  const obrasMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);
  const insumosMap = useMemo(() => new Map(insumos.map((i) => [i.id, i.nome])), [insumos]);
  const ch = useMemo(() => createColumnHelper<SaidaCombustivel>(), []);

  const columns = useMemo<ColumnDef<SaidaCombustivel>[]>(() => [
    ch.accessor('data', {
      header: 'Data',
      cell: (info) => <span className="font-medium tabular-nums">{fmtData(info.getValue())}</span>,
      sortingFn: 'alphanumeric',
    }) as ColumnDef<SaidaCombustivel>,
    {
      id: 'consumidor',
      header: 'Consumidor',
      cell: ({ row }) => {
        const s = row.original;
        const tipo = s.tipoConsumidor;
        const Icon = tipo === 'equipamento_proprio' ? Settings2
                    : tipo === 'carreta_transportadora' ? Truck
                    : AlertCircle;
        const label = tipo === 'equipamento_proprio'
          ? (equipamentosMap.get(s.equipamentoId ?? '')?.nome || s.equipamentoId || '—')
          : (s.transportadora || s.placa || '—');
        return (
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-[var(--color-fg-muted)] shrink-0" />
            <span className="truncate">{label}</span>
          </div>
        );
      },
    },
    {
      id: 'obra',
      header: 'Obra',
      accessorFn: (s) => obrasMap.get(s.obraId ?? '') || '—',
      cell: (info) => <span className="truncate max-w-[180px]">{String(info.getValue())}</span>,
    },
    {
      id: 'combustivel',
      header: 'Combustível',
      accessorFn: (s) => insumosMap.get(s.tipoCombustivel) || s.tipoCombustivel,
      cell: (info) => (
        <span className="inline-block px-2 py-0.5 text-[10px] rounded-full uppercase tracking-wide bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)] font-semibold">
          {String(info.getValue())}
        </span>
      ),
    },
    ch.accessor('litros', {
      header: 'Litros',
      cell: (info) => <span className="tabular-nums">{(info.getValue() ?? 0).toLocaleString('pt-BR')} L</span>,
    }) as ColumnDef<SaidaCombustivel>,
    ch.accessor('valorTotal', {
      header: 'Valor',
      cell: (info) => <span className="tabular-nums font-semibold">{fmtBRL(info.getValue() ?? 0)}</span>,
    }) as ColumnDef<SaidaCombustivel>,
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="p-1 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              title="Ações"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canEdit && (
              <DropdownMenuItem onClick={() => onEdit(row.original)}>
                <Pencil className="w-3.5 h-3.5 mr-2" />
                Editar
              </DropdownMenuItem>
            )}
            {canDelete && (
              <DropdownMenuItem
                onClick={() => onDelete(row.original.id)}
                className="text-[var(--color-danger)] focus:text-[var(--color-danger)]"
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" />
                Excluir
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      size: 32,
    },
  ], [ch, equipamentosMap, obrasMap, insumosMap, canEdit, canDelete, onEdit, onDelete]);

  const [sorting, setSorting] = useState<SortingState>([{ id: 'data', desc: true }]);
  const [pageSize, setPageSize] = useState<number>(getInitialPageSize);
  const [pageIndex, setPageIndex] = useState(0);

  const persistPageSize = useCallback((n: number) => {
    setPageSize(n);
    setPageIndex(0);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PAGE_SIZE_KEY, String(n));
    }
  }, []);

  const table = useReactTable({
    data: saidas,
    columns,
    state: { sorting, pagination: { pageIndex, pageSize } },
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function' ? updater({ pageIndex, pageSize }) : updater;
      setPageIndex(next.pageIndex);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const totalLitros = useMemo(() => saidas.reduce((s, x) => s + (x.litros ?? 0), 0), [saidas]);
  const totalValor = useMemo(() => saidas.reduce((s, x) => s + (x.valorTotal ?? 0), 0), [saidas]);

  if (saidas.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-8 text-center">
        <p className="text-sm text-[var(--color-fg-muted)]">Nenhuma saída encontrada.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-hidden">
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-3 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/50 text-xs text-[var(--color-fg-muted)]">
        <span>{saidas.length} saída(s)</span>
        <span>·</span>
        <span>{totalLitros.toLocaleString('pt-BR')} L</span>
        <span>·</span>
        <span className="font-semibold text-[var(--color-fg)]">{fmtBRL(totalValor)}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="bg-[var(--color-surface-2)]/80">
                {hg.headers.map((h) => {
                  const canSort = h.column.getCanSort();
                  const sortDir = h.column.getIsSorted();
                  const Icon = !sortDir ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
                  return (
                    <th
                      key={h.id}
                      onClick={canSort ? h.column.getToggleSortingHandler() : undefined}
                      className={`px-3 py-2.5 text-left text-[10px] uppercase tracking-wide font-semibold text-[var(--color-fg-muted)] ${canSort ? 'cursor-pointer hover:bg-[var(--color-surface-2)]' : ''}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {canSort && <Icon className={`w-3 h-3 ${sortDir ? 'opacity-100' : 'opacity-40'}`} />}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <Fragment key={row.id}>
                <tr
                  data-saida-id={row.original.id}
                  onClick={() => onSelect?.(row.original)}
                  className="hover:bg-[var(--color-surface-1)] cursor-pointer border-t border-[var(--color-border)]"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-[var(--color-border)] bg-[var(--color-surface-2)]/30 text-xs text-[var(--color-fg-muted)]">
        <div>
          Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => persistPageSize(parseInt(e.target.value, 10))}
            className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded px-2 py-1 text-xs"
          >
            <option value={25}>25/pg</option>
            <option value={50}>50/pg</option>
            <option value={100}>100/pg</option>
          </select>
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="px-2 py-1 border border-[var(--color-border)] rounded disabled:opacity-40 hover:bg-[var(--color-surface-1)]"
          >
            ← Anterior
          </button>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="px-2 py-1 border border-[var(--color-border)] rounded disabled:opacity-40 hover:bg-[var(--color-surface-1)]"
          >
            Próxima →
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 1.2: Verify props match consumer**

```bash
grep -n "SaidaCombustivelList\b\|<SaidaCombustivelList\b" src/components/frota/combustivel/FrotaCombustivelContainer.tsx | head -5
```

Confirmar quais props o componente recebe atualmente. Ajustar `Props` interface acima se necessário.

### Step 2: EntradaListV2

- [ ] **Step 2.1: Create file**

Create `src/components/combustivel/EntradaListV2.tsx`. Mesma estrutura do `SaidaCombustivelListV2`, adaptando colunas pra Entrada: `Data | Fornecedor | Combustível | Litros | Valor Total | Ações`.

Use `EntradaCombustivel` type. Reuse `Insumo`, `Fornecedor`.

```tsx
import type { EntradaCombustivel, Insumo, Fornecedor } from '../../types';

interface Props {
  entradas: EntradaCombustivel[];
  insumos: Insumo[];
  fornecedores: Fornecedor[];
  onEdit: (e: EntradaCombustivel) => void;
  onDelete: (id: string) => void;
  onSelect?: (e: EntradaCombustivel) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

// PAGE_SIZE_KEY = 'entrada-combustivel-list-page-size-v2';
```

Colunas (adaptar do template acima):

```tsx
ch.accessor('dataHora', {
  header: 'Data',
  cell: (info) => <span className="font-medium tabular-nums">{fmtData(info.getValue())}</span>,
  sortingFn: 'alphanumeric',
}) as ColumnDef<EntradaCombustivel>,
{
  id: 'fornecedor',
  header: 'Fornecedor',
  accessorFn: (e) => fornecedoresMap.get(e.fornecedor) || e.fornecedor || '—',
  cell: (info) => <span className="truncate max-w-[200px]">{String(info.getValue())}</span>,
},
{
  id: 'combustivel',
  header: 'Combustível',
  accessorFn: (e) => insumosMap.get(e.tipoCombustivel) || e.tipoCombustivel,
  cell: (info) => (
    <span className="inline-block px-2 py-0.5 text-[10px] rounded-full uppercase tracking-wide bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)] font-semibold">
      {String(info.getValue())}
    </span>
  ),
},
ch.accessor('quantidadeLitros', {
  header: 'Litros',
  cell: (info) => <span className="tabular-nums">{(info.getValue() ?? 0).toLocaleString('pt-BR')} L</span>,
}),
ch.accessor('valorTotal', {
  header: 'Valor',
  cell: (info) => <span className="tabular-nums font-semibold">{fmtBRL(info.getValue() ?? 0)}</span>,
}),
{
  id: 'actions',
  // mesma estrutura do SaidaCombustivelListV2
},
```

Summary line: `${entradas.length} entrada(s) · ${totalLitros} L · ${fmtBRL(totalValor)}`.

`data-entrada-id` na `<tr>`.

### Step 3: TransferenciaListV2

- [ ] **Step 3.1: Create file**

Create `src/components/combustivel/TransferenciaListV2.tsx`. Mesma estrutura. Colunas: `Data | Origem | Destino | Litros | Valor | Ações`.

```tsx
import type { TransferenciaCombustivel, Deposito } from '../../types';

interface Props {
  transferencias: TransferenciaCombustivel[];
  depositos: Deposito[];
  onDelete: (id: string) => void;
  onSelect?: (t: TransferenciaCombustivel) => void;
  canDelete?: boolean;
}

// PAGE_SIZE_KEY = 'transferencia-combustivel-list-page-size-v2';
```

Colunas:

```tsx
ch.accessor('dataHora', {
  header: 'Data',
  cell: (info) => <span className="font-medium tabular-nums">{fmtData(info.getValue())}</span>,
  sortingFn: 'alphanumeric',
}),
{
  id: 'origem_destino',
  header: 'Origem → Destino',
  cell: ({ row }) => (
    <div className="flex items-center gap-2">
      <span className="truncate max-w-[120px]">{depositosMap.get(row.original.depositoOrigemId) || '—'}</span>
      <ArrowRight className="w-3 h-3 text-[var(--color-fg-muted)]" />
      <span className="truncate max-w-[120px]">{depositosMap.get(row.original.depositoDestinoId) || '—'}</span>
    </div>
  ),
},
ch.accessor('quantidadeLitros', {
  header: 'Litros',
  cell: (info) => <span className="tabular-nums">{(info.getValue() ?? 0).toLocaleString('pt-BR')} L</span>,
}),
ch.accessor('valorTotal', {
  header: 'Valor',
  cell: (info) => <span className="tabular-nums font-semibold">{fmtBRL(info.getValue() ?? 0)}</span>,
}),
{
  id: 'actions',
  // Transferências não têm Edit — apenas Delete
},
```

Importar `ArrowRight` do lucide-react.

### Step 4: Swap em `FrotaCombustivelContainer.tsx`

- [ ] **Step 4.1: Modify imports**

```bash
grep -n "import.*SaidaCombustivelList\|import.*EntradaList\|import.*TransferenciaList" src/components/frota/combustivel/FrotaCombustivelContainer.tsx
```

Trocar 3 imports:
```tsx
import SaidaCombustivelListV2 from '../../combustivel/SaidaCombustivelListV2';
import EntradaListV2 from '../../combustivel/EntradaListV2';
import TransferenciaListV2 from '../../combustivel/TransferenciaListV2';
```

E nas chamadas JSX `<SaidaCombustivelList ...>` → `<SaidaCombustivelListV2 ...>`. Idem para Entrada e Transferencia.

Conferir props — pode ser que props mudem (ex: passei `equipamentos` ao invés de `equipamentosMap`). Adaptar.

- [ ] **Step 4.2: TypeScript + build**

```bash
npx tsc -b 2>&1 | tail -10
npm run build 2>&1 | tail -5
```

Expected: zero errors. Se a interface de props divergiu, ajustar.

### Step 5: Smoke + delete legacy

- [ ] **Step 5.1: npm run dev e verificar abas Saídas, Entradas, Transferências**

```bash
npm run dev
```

Abrir `localhost:5173/combustivel` em browser, ir nas 3 abas. Confirmar:
- Lista renderiza
- Sort por coluna funciona
- Paginação funciona (com >25 rows)
- DropdownMenu Editar/Excluir aparece e funciona
- Summary line no topo mostra total de litros + valor

Encerrar o dev server.

- [ ] **Step 5.2: Deletar legacy**

```bash
git rm src/components/combustivel/SaidaCombustivelList.tsx
git rm src/components/combustivel/EntradaList.tsx
git rm src/components/combustivel/TransferenciaList.tsx
```

- [ ] **Step 5.3: Commit**

```bash
git add src/components/combustivel/SaidaCombustivelListV2.tsx \
        src/components/combustivel/EntradaListV2.tsx \
        src/components/combustivel/TransferenciaListV2.tsx \
        src/components/frota/combustivel/FrotaCombustivelContainer.tsx
git commit -m "feat(combustivel): listas operacionais usam @tanstack/react-table (Audit item 12)

Reescreve SaidaCombustivelList, EntradaList e TransferenciaList como
v2 usando data-table pattern (espelha FreteListV2 da Fase B Frete):
- Sort por coluna nativo (asc/desc/none)
- Paginação client-side 25/50/100 (persiste localStorage)
- DropdownMenu shadcn pra Editar/Excluir
- Summary line no topo (total registros + litros + valor)
- data-{saida|entrada|transferencia}-id pra E2E targeting
- Tokens de design (sem mais bg-emt-verde brilhante)

Auditoria item 12 + também resolve item 10 (header verde) e parte do 13."
```

---

## Task MP.5: Drawers de detalhe usam Sheet shadcn

**Audit item 13.** 4 drawers customs em `src/components/ui/Drawer.tsx`. Espelha o que fizemos pro `FreteDetalhesDrawer` em Fase B.

**Files:**
- Modify: `src/components/combustivel/SaidaDetalhesDrawer.tsx`
- Modify: `src/components/combustivel/EntradaDetalhesDrawer.tsx`
- Modify: `src/components/combustivel/TransferenciaDetalhesDrawer.tsx`
- Modify: `src/components/frota/combustivel/TanqueDetalhesDrawer.tsx`

> Pattern: substituir wrapper `<Drawer open onClose ... footer={...}>` por `<Sheet open onOpenChange><SheetContent side="right">`. Header → `<SheetHeader>` + `<SheetTitle>` + `<SheetDescription>`. Footer → `<SheetFooter>`. Conteúdo interno fica IGUAL.

### Step 1: SaidaDetalhesDrawer

- [ ] **Step 1.1: Modificar imports**

Trocar:
```tsx
import Drawer from '../ui/Drawer';
```

Por:
```tsx
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '../shadcn/sheet';
```

- [ ] **Step 1.2: Trocar wrapper**

Encontrar o `return` (geralmente bottom do arquivo) com `<Drawer open={open} onClose={onClose} title=...>`. Trocar por:

```tsx
return (
  <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
    <SheetContent
      side="right"
      className="w-full data-[side=right]:sm:max-w-[900px] bg-[var(--color-surface-1)] text-[var(--color-fg)] border-l border-[var(--color-border)] overflow-y-auto"
    >
      <SheetHeader>
        <SheetTitle>{tituloVar}</SheetTitle>
        <SheetDescription>{subtituloVar}</SheetDescription>
      </SheetHeader>

      <div className="mt-4">
        {/* conteúdo atual aqui */}
      </div>

      <SheetFooter className="mt-6">
        {/* footer atual aqui */}
      </SheetFooter>
    </SheetContent>
  </Sheet>
);
```

> NOTA: o conteúdo interno fica EXATAMENTE igual (tabs, KPIs, Fields, anexos). Só o wrapper externo + header/footer mudam.

- [ ] **Step 1.3: Caso `null` (saída não disponível)**

Se houver fallback `if (!saida) return <Drawer>...</Drawer>`:

```tsx
if (!saida) {
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full data-[side=right]:sm:max-w-[900px] bg-[var(--color-surface-1)] text-[var(--color-fg)] border-l border-[var(--color-border)]"
      >
        <SheetHeader>
          <SheetTitle>Saída</SheetTitle>
          <SheetDescription>Detalhes</SheetDescription>
        </SheetHeader>
        <div className="text-sm text-[var(--color-fg-muted)] italic mt-4">Saída não disponível.</div>
      </SheetContent>
    </Sheet>
  );
}
```

### Step 2: EntradaDetalhesDrawer

- [ ] **Step 2.1: Replicar pattern do Step 1**

Mesmo padrão. Conteúdo interno (Fields da entrada) fica igual.

### Step 3: TransferenciaDetalhesDrawer

- [ ] **Step 3.1: Replicar pattern do Step 1**

Mesmo padrão. Conteúdo interno (Origem → Destino, anexos) fica igual.

### Step 4: TanqueDetalhesDrawer

- [ ] **Step 4.1: Replicar pattern do Step 1**

Mesmo padrão. Conteúdo interno (TanqueVisual, histórico, F11 fuel type) fica igual.

### Step 5: Build + smoke

- [ ] **Step 5.1: TypeScript + build**

```bash
npx tsc -b 2>&1 | tail -5
npm run build 2>&1 | tail -3
```

Expected: zero errors.

- [ ] **Step 5.2: Smoke manual**

```bash
npm run dev
```

Abrir cada um dos 4 drawers em `/combustivel`:
- Clicar uma saída → drawer abre via Sheet (anima da direita)
- Esc fecha
- Click fora fecha
- Edit/Excluir no footer funcionam

Encerrar dev server.

- [ ] **Step 5.3: Commit**

```bash
git add src/components/combustivel/SaidaDetalhesDrawer.tsx \
        src/components/combustivel/EntradaDetalhesDrawer.tsx \
        src/components/combustivel/TransferenciaDetalhesDrawer.tsx \
        src/components/frota/combustivel/TanqueDetalhesDrawer.tsx
git commit -m "refactor(combustivel): drawers usam Sheet shadcn (Audit item 13)

4 drawers de detalhe (Saída, Entrada, Transferência, Tanque) migram
do wrapper custom Drawer pra Sheet/SheetContent/etc shadcn. Conteúdo
interno preservado integralmente (tabs, KPIs, Fields, anexos, etc.).

Largura uniforme (900px) + tokens dark-mode (--color-surface-1,
--color-fg, --color-border) — mesmo padrão de FreteDetalhesDrawer
da Fase B Frete.

O wrapper custom em src/components/ui/Drawer.tsx continua usado por
outras 5+ telas — fica pra migração futura."
```

---

## Task MP.6: Final — build + security review + deploy + push

**Files:** none (operacional)

- [ ] **Step 1: Build + testes passam**

```bash
cd /Users/tiagocameli/projects/Gestao_Obras
npm run build 2>&1 | tail -5
npm test 2>&1 | tail -10
```

Expected: `✓ built`, todos os testes passando.

- [ ] **Step 2: `/security-review`**

No Claude Code:
```
/security-review
```

Esperado: `NO_FINDINGS`. Mudanças são UI polish + DB storage tighten — não introduzem nova superfície de ataque.

- [ ] **Step 3: Preview deploy**

```bash
npx --yes vercel deploy 2>&1 | tail -5
```

- [ ] **Step 4: Smoke test manual**

Roteiro:
- `/combustivel` → Saídas → conferir nova lista com sort/paginação
- Click ⋮ Editar → form abre normal
- Click ⋮ Excluir → ConfirmDialog (não window.confirm)
- Aba Entradas → idem
- Aba Transferências → idem
- Click numa saída → Sheet abre da direita com tokens dark-mode
- Aba Anomalias → atribuir/marcar OK → toast/dialog não alert/prompt
- Aba Lixeira → restaurar → ConfirmDialog
- Aba Relatórios → gerar PDF → se falhar, toast vermelho (não alert)

- [ ] **Step 5: Promote prod (com confirmação)**

Pedir confirmação ao user. Se aprovado:
```bash
npx --yes vercel --prod 2>&1 | tail -5
```

- [ ] **Step 6: Merge na main + push**

```bash
git checkout main
git pull origin main
git merge --no-ff feat/combustivel-polish-stack-align -m "Merge branch 'feat/combustivel-polish-stack-align'

Fecha 5 itens MEDIUM do audit combustível:
- Item 8 (storage limits)
- Item 9 (alert/confirm/prompt → useToast/ConfirmDialog)
- Item 10 (subsumido por item 12)
- Item 12 (3 listas → @tanstack/react-table)
- Item 13 (4 drawers → Sheet shadcn)

Audit: combustivel-audit.md
Plan: docs/superpowers/plans/2026-05-22-combustivel-polish-stack-align.md"
git push origin main 2>&1 | tail -3
```

---

## Critérios de Aceitação

- ✅ `npm test` passa
- ✅ `npm run build` passa
- ✅ Bucket `abastecimento-fotos` tem `file_size_limit=20971520` e `allowed_mime_types` com 12 entradas
- ✅ Zero ocorrências de `alert(`, `window.confirm`, `window.prompt` em código ativo do módulo combustível
- ✅ 3 listas operacionais usam `useReactTable` com sort por coluna + paginação localStorage
- ✅ 4 drawers usam Sheet shadcn com largura 900px + tokens dark-mode
- ✅ `/security-review` retorna NO_FINDINGS
- ✅ Manual smoke test no preview confirma todas as telas funcionais
