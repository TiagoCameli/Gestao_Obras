/**
 * PILOT 02 — Lista de Fretes V2 (Premium)
 * ----------------------------------------
 * Refatora `src/components/frete/FreteListV2.tsx` (367 LOC).
 *
 * Melhorias visíveis vs versão atual:
 *  1. Bulk selection: checkbox por linha + toolbar "X selecionados" + bulk actions
 *  2. Density toggle: compact / normal / comfortable (afeta py- da linha)
 *  3. Sticky header (header fica fixo no scroll vertical)
 *  4. Paginação numerada (1 ... 4 5 6 ... 12), não só prev/next
 *  5. Filter bar integrada acima com chips de filtros ativos + "Limpar tudo"
 *  6. Loading state: skeleton rows (não <p>Carregando…</p>)
 *  7. Empty state estruturado (ícone + título + descrição + CTA)
 *  8. Hover reveals: ações (3 dots) só aparecem com opacity-100 ao hover na linha
 *  9. Footer com count + total da coluna Valor somado (R$)
 * 10. Column visibility toggle via dropdown
 *
 * Mock data inline — em produção plug nos hooks reais.
 */
import { Fragment, useMemo, useState } from 'react';
import {
  ArrowUpDown, ArrowUp, ArrowDown, ChevronRight, ChevronDown, ChevronLeft,
  MoreVertical, Pencil, Trash2, Search, X, Sliders, Plus, Eye, Download,
  ClipboardList, type LucideIcon,
} from 'lucide-react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getPaginationRowModel,
  getExpandedRowModel, createColumnHelper, flexRender,
  type ColumnDef, type ExpandedState, type SortingState, type RowSelectionState,
} from '@tanstack/react-table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuCheckboxItem, DropdownMenuSeparator, DropdownMenuLabel,
} from '../../components/shadcn/dropdown-menu';

/* ============================================================================
 * Tipos e mock data
 * ============================================================================ */
interface FreteMock {
  id: string;
  data: string;
  dataChegada?: string;
  origem: string;
  destino: string;
  transportadora: string;
  motorista: string;
  placaCarreta: string;
  insumoId: string;
  insumoNome: string;
  pesoToneladas: number;
  valorTotal: number;
  notaFiscal?: string;
  obra: string;
}

const MOCK_FRETES: FreteMock[] = [
  { id: '1', data: '2026-05-22', dataChegada: '2026-05-22', origem: 'Pedreira Iaras', destino: 'KM 88 BR-364', transportadora: 'Triunfo Transp.', motorista: 'João Silva', placaCarreta: 'BVK-2H49', insumoId: '1', insumoNome: 'Brita 1', pesoToneladas: 28.5, valorTotal: 1842.50, notaFiscal: 'NF-12345', obra: 'BR-364 Lote 9' },
  { id: '2', data: '2026-05-21', dataChegada: '2026-05-22', origem: 'Britador EMT', destino: 'KM 92 BR-364', transportadora: 'Areacre', motorista: 'Carlos Mendes', placaCarreta: 'KMT-9B12', insumoId: '2', insumoNome: 'Pó de pedra', pesoToneladas: 32.0, valorTotal: 2240.00, notaFiscal: 'NF-12346', obra: 'BR-364 Lote 9' },
  { id: '3', data: '2026-05-21', origem: 'Fornecedor X', destino: 'Canteiro PR-A', transportadora: 'Andrade Frota', motorista: 'Pedro Costa', placaCarreta: 'AND-4N72', insumoId: '3', insumoNome: 'CBUQ', pesoToneladas: 25.8, valorTotal: 3870.00, obra: 'BR-364 Lote 9' },
  { id: '4', data: '2026-05-20', dataChegada: '2026-05-20', origem: 'Pedreira Iaras', destino: 'KM 75 BR-364', transportadora: 'Triunfo Transp.', motorista: 'José Lima', placaCarreta: 'BVK-2H50', insumoId: '1', insumoNome: 'Brita 1', pesoToneladas: 29.2, valorTotal: 1898.00, notaFiscal: 'NF-12340', obra: 'BR-364 Lote 9' },
  { id: '5', data: '2026-05-20', dataChegada: '2026-05-20', origem: 'Britador EMT', destino: 'Estaleiro central', transportadora: 'EMT Frota', motorista: 'Antônio Rocha', placaCarreta: 'EMT-1234', insumoId: '4', insumoNome: 'Areia média', pesoToneladas: 24.0, valorTotal: 960.00, notaFiscal: 'NF-12341', obra: 'BR-364 Lote 9' },
  { id: '6', data: '2026-05-19', origem: 'Pedreira Iaras', destino: 'KM 88 BR-364', transportadora: 'Triunfo Transp.', motorista: 'João Silva', placaCarreta: 'BVK-2H49', insumoId: '1', insumoNome: 'Brita 1', pesoToneladas: 27.8, valorTotal: 1807.00, obra: 'BR-364 Lote 9' },
  { id: '7', data: '2026-05-19', dataChegada: '2026-05-19', origem: 'Fornecedor Y', destino: 'KM 102 BR-364', transportadora: 'Areacre', motorista: 'Marcos Oliveira', placaCarreta: 'KMT-9B13', insumoId: '5', insumoNome: 'Cimento CP-II', pesoToneladas: 12.0, valorTotal: 4800.00, notaFiscal: 'NF-12338', obra: 'BR-364 Lote 9' },
  { id: '8', data: '2026-05-18', dataChegada: '2026-05-18', origem: 'Britador EMT', destino: 'KM 92 BR-364', transportadora: 'EMT Frota', motorista: 'Luis Pereira', placaCarreta: 'EMT-1235', insumoId: '2', insumoNome: 'Pó de pedra', pesoToneladas: 31.5, valorTotal: 2205.00, notaFiscal: 'NF-12337', obra: 'BR-364 Lote 9' },
];

/* ============================================================================
 * Stubs (em produção viram componentes globais)
 * ============================================================================ */

function Button({
  children, variant = 'primary', size = 'md', onClick, type = 'button', disabled, className = '',
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}) {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-md transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)] disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = { sm: 'h-8 px-2.5 text-xs', md: 'h-9 px-3 text-sm', lg: 'h-10 px-4 text-sm' }[size];
  const variants = {
    primary: 'bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] hover:bg-[var(--color-accent-hover)] shadow-[var(--shadow-xs)]',
    secondary: 'bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)]',
    ghost: 'text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]',
    danger: 'bg-[var(--color-danger)] text-white hover:opacity-90',
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${sizes} ${variants} ${className}`}>
      {children}
    </button>
  );
}

function PageHeader({
  title, description, actions,
}: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--color-fg)]">{title}</h1>
        {description && <p className="text-sm text-[var(--color-fg-muted)] mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </header>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[var(--color-surface-2)] ${className}`} />;
}

function EmptyState({
  icon: Icon = ClipboardList, title, description, action,
}: { icon?: LucideIcon; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="surface-raised p-12 text-center">
      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center">
        <Icon className="w-6 h-6 text-[var(--color-fg-subtle)]" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-[var(--color-fg)]">{title}</p>
      {description && <p className="text-xs text-[var(--color-fg-muted)] mt-1 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function fmtBRL(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function fmtData(iso: string) {
  if (!iso) return '—';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

type Density = 'compact' | 'normal' | 'comfortable';

/* ============================================================================
 * Página
 * ============================================================================ */
export default function FreteListV2Premium() {
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<{ label: string; key: string }[]>([
    { label: 'Obra: BR-364 Lote 9', key: 'obra' },
    { label: 'Período: 18-22/05/2026', key: 'periodo' },
  ]);
  const [density, setDensity] = useState<Density>('normal');
  const [isLoading] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    notaFiscal: false,
  });

  const filtered = useMemo(() => {
    if (!search) return MOCK_FRETES;
    const q = search.toLowerCase();
    return MOCK_FRETES.filter((f) =>
      f.origem.toLowerCase().includes(q)
      || f.destino.toLowerCase().includes(q)
      || f.motorista.toLowerCase().includes(q)
      || f.transportadora.toLowerCase().includes(q)
      || f.insumoNome.toLowerCase().includes(q)
    );
  }, [search]);

  const ch = useMemo(() => createColumnHelper<FreteMock>(), []);

  const columns = useMemo<ColumnDef<FreteMock>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          aria-label="Selecionar todos"
          checked={table.getIsAllRowsSelected()}
          ref={(el) => { if (el) el.indeterminate = table.getIsSomeRowsSelected(); }}
          onChange={table.getToggleAllRowsSelectedHandler()}
          className="w-3.5 h-3.5 rounded border-[var(--color-border-strong)] text-[var(--color-accent)] focus:ring-[var(--color-ring)]"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          aria-label={`Selecionar frete ${row.original.id}`}
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          onClick={(e) => e.stopPropagation()}
          className="w-3.5 h-3.5 rounded border-[var(--color-border-strong)] text-[var(--color-accent)] focus:ring-[var(--color-ring)]"
        />
      ),
      size: 36,
    },
    {
      id: 'expander',
      header: '',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); row.toggleExpanded(); }}
          className="p-1 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
          aria-label={row.getIsExpanded() ? 'Recolher detalhes' : 'Expandir detalhes'}
        >
          {row.getIsExpanded() ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      ),
      size: 32,
    },
    ch.accessor('data', {
      header: 'Saída',
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">{fmtData(row.original.data)}</span>
      ),
    }) as ColumnDef<FreteMock>,
    {
      id: 'dataChegada',
      header: 'Chegada',
      accessorFn: (f) => f.dataChegada || '',
      cell: ({ row }) => row.original.dataChegada
        ? <span className="font-medium tabular-nums">{fmtData(row.original.dataChegada)}</span>
        : <span className="chip chip-warning">sem chegada</span>,
    },
    {
      id: 'origemDestino',
      header: 'Trecho',
      accessorFn: (f) => `${f.origem} → ${f.destino}`,
      cell: ({ row }) => (
        <div className="flex flex-col leading-tight min-w-0">
          <span className="font-medium text-[var(--color-fg)] truncate max-w-[200px]">{row.original.origem}</span>
          <span className="text-xs text-[var(--color-fg-muted)] truncate max-w-[200px]">→ {row.original.destino}</span>
        </div>
      ),
    },
    ch.accessor('transportadora', {
      header: 'Transportadora',
      cell: ({ row }) => (
        <div className="flex flex-col leading-tight">
          <span className="font-medium text-[var(--color-fg)]">{row.original.transportadora}</span>
          <span className="text-xs text-[var(--color-fg-muted)]">{row.original.motorista}</span>
          <span className="text-3xs text-[var(--color-fg-subtle)] uppercase tracking-wide tabular-nums font-mono mt-0.5">
            {row.original.placaCarreta}
          </span>
        </div>
      ),
    }) as ColumnDef<FreteMock>,
    ch.accessor('insumoNome', {
      header: 'Material',
      cell: (info) => <span className="text-sm truncate max-w-[120px]">{info.getValue()}</span>,
    }) as ColumnDef<FreteMock>,
    ch.accessor('pesoToneladas', {
      header: 'Peso',
      cell: (info) => <span className="tabular-nums text-sm">{info.getValue().toLocaleString('pt-BR')} <span className="text-2xs text-[var(--color-fg-subtle)]">t</span></span>,
    }) as ColumnDef<FreteMock>,
    ch.accessor('valorTotal', {
      header: 'Valor',
      cell: (info) => <span className="tabular-nums font-mono font-semibold text-[var(--color-fg)]">{fmtBRL(info.getValue())}</span>,
    }) as ColumnDef<FreteMock>,
    ch.accessor('notaFiscal', {
      header: 'NF',
      cell: (info) => info.getValue() ? <span className="text-xs font-mono text-[var(--color-fg-muted)]">{info.getValue()}</span> : <span className="text-xs text-[var(--color-fg-subtle)]">—</span>,
    }) as ColumnDef<FreteMock>,
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--dur-fast)] focus-within:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                aria-label={`Ações do frete ${row.original.id}`}
                className="p-1 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem><Eye className="w-3.5 h-3.5 mr-2" /> Ver detalhes</DropdownMenuItem>
              <DropdownMenuItem><Pencil className="w-3.5 h-3.5 mr-2" /> Editar</DropdownMenuItem>
              <DropdownMenuItem><Download className="w-3.5 h-3.5 mr-2" /> Baixar NF</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-[var(--color-danger)] focus:text-[var(--color-danger)]">
                <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
      size: 40,
    },
  ], [ch]);

  const [sorting, setSorting] = useState<SortingState>([{ id: 'data', desc: true }]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 25;

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, expanded, rowSelection, pagination: { pageIndex, pageSize }, columnVisibility },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function' ? updater({ pageIndex, pageSize }) : updater;
      setPageIndex(next.pageIndex);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowCanExpand: () => true,
    getRowId: (row) => row.id,
  });

  const selectedCount = Object.keys(rowSelection).length;
  const valorTotal = filtered.reduce((sum, f) => sum + f.valorTotal, 0);
  const pesoTotal = filtered.reduce((sum, f) => sum + f.pesoToneladas, 0);

  const densityPad = {
    compact: 'py-1.5',
    normal: 'py-2.5',
    comfortable: 'py-3.5',
  }[density];

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 max-w-[1400px] mx-auto">

      <PageHeader
        title="Fretes"
        description="Fretes registrados na operação. Filtros, ordenação e ações em massa."
        actions={
          <>
            <Button variant="secondary" size="md"><Download className="w-4 h-4" /> Exportar</Button>
            <Button variant="primary" size="md"><Plus className="w-4 h-4" /> Novo frete</Button>
          </>
        }
      />

      {/* Filter Bar */}
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-fg-subtle)]" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por trecho, motorista, transportadora…"
              className="w-full h-9 pl-9 pr-3 text-sm rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus-visible:border-[var(--color-accent)] transition-colors"
            />
          </div>

          <Button variant="secondary" size="md"><Sliders className="w-4 h-4" /> Filtros</Button>

          {/* Density toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-9 px-3 inline-flex items-center gap-1.5 text-sm rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]">
                Densidade: <span className="font-medium text-[var(--color-fg)]">{density}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(['compact', 'normal', 'comfortable'] as Density[]).map((d) => (
                <DropdownMenuItem key={d} onClick={() => setDensity(d)}>
                  {d === density && '✓ '}{d}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Column visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-9 px-3 inline-flex items-center gap-1.5 text-sm rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]" aria-label="Colunas visíveis">
                <Eye className="w-4 h-4" /> Colunas
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Colunas visíveis</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table.getAllColumns().filter(c => c.getCanHide()).map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={col.getIsVisible()}
                  onCheckedChange={(v) => col.toggleVisibility(!!v)}
                >
                  {String(col.columnDef.header || col.id)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Chips de filtros ativos */}
        {activeFilters.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {activeFilters.map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFilters(prev => prev.filter(x => x.key !== f.key))}
                className="chip chip-accent group hover:opacity-80 transition-opacity"
                type="button"
              >
                {f.label}
                <X className="w-3 h-3" aria-label="Remover filtro" />
              </button>
            ))}
            {activeFilters.length > 1 && (
              <button
                onClick={() => setActiveFilters([])}
                className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] underline underline-offset-2 ml-1"
              >
                Limpar tudo
              </button>
            )}
          </div>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="surface-raised overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-2)]">
              <tr>{Array.from({ length: 9 }).map((_, i) => <th key={i} className="px-3 py-2.5"><Skeleton className="h-3 w-16" /></th>)}</tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-t border-[var(--color-border)]">
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="px-3 py-3"><Skeleton className="h-4" /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty */}
      {!isLoading && filtered.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="Nenhum frete encontrado"
          description="Ajuste os filtros acima ou registre um novo frete."
          action={<Button variant="primary"><Plus className="w-4 h-4" /> Novo frete</Button>}
        />
      )}

      {/* Table */}
      {!isLoading && filtered.length > 0 && (
        <div className="surface-raised overflow-hidden">
          {/* Bulk actions toolbar */}
          {selectedCount > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--color-accent-soft)] border-b border-[var(--color-accent)]/20 animate-in slide-in-from-top-2 duration-[var(--dur-base)]">
              <span className="text-sm font-medium text-[var(--color-accent-fg)]">
                {selectedCount} selecionado{selectedCount > 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm"><Download className="w-3.5 h-3.5" /> Exportar selecionados</Button>
                <Button variant="ghost" size="sm" className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]">
                  <Trash2 className="w-3.5 h-3.5" /> Excluir
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setRowSelection({})}>Cancelar</Button>
              </div>
            </div>
          )}

          {/* Sticky-header table */}
          <div className="overflow-auto max-h-[calc(100vh-340px)]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-[var(--color-surface-2)]/95 backdrop-blur-sm">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((h) => {
                      const canSort = h.column.getCanSort();
                      const sortDir = h.column.getIsSorted();
                      const Icon = !sortDir ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
                      return (
                        <th
                          key={h.id}
                          onClick={canSort ? h.column.getToggleSortingHandler() : undefined}
                          className={`px-3 py-2.5 text-left text-2xs uppercase tracking-wider font-semibold text-[var(--color-fg-muted)] ${canSort ? 'cursor-pointer hover:text-[var(--color-fg)] select-none' : ''}`}
                          style={{ width: h.column.id === 'select' || h.column.id === 'expander' || h.column.id === 'actions' ? h.getSize() : undefined }}
                        >
                          {h.isPlaceholder ? null : (
                            <span className="inline-flex items-center gap-1">
                              {flexRender(h.column.columnDef.header, h.getContext())}
                              {canSort && <Icon className={`w-3 h-3 ${sortDir ? 'opacity-100 text-[var(--color-accent)]' : 'opacity-40'}`} aria-hidden />}
                            </span>
                          )}
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
                      className={`group border-t border-[var(--color-border)] cursor-pointer transition-colors duration-[var(--dur-fast)] hover:bg-[var(--color-surface-2)]/60 ${row.getIsSelected() ? 'bg-[var(--color-accent-soft)]/40' : ''}`}
                      onClick={() => row.toggleExpanded()}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className={`px-3 ${densityPad} align-middle`}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                    {row.getIsExpanded() && (
                      <tr className="bg-[var(--color-surface-2)]/30">
                        <td colSpan={row.getVisibleCells().length} className="px-6 py-4 border-t border-[var(--color-border)]">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <Field label="Obra" value={row.original.obra} />
                            <Field label="Material" value={row.original.insumoNome} />
                            <Field label="Peso" value={`${row.original.pesoToneladas} t`} />
                            <Field label="Valor total" value={fmtBRL(row.original.valorTotal)} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
              <tfoot className="bg-[var(--color-surface-2)]/50 border-t-2 border-[var(--color-border-strong)]">
                <tr>
                  <td colSpan={5} className="px-3 py-2 text-xs label-eyebrow">Totais</td>
                  <td className="px-3 py-2 text-xs label-eyebrow">{filtered.length} fretes</td>
                  <td className="px-3 py-2 text-sm tabular-nums font-semibold">{pesoTotal.toLocaleString('pt-BR')} t</td>
                  <td className="px-3 py-2 text-sm tabular-nums font-mono font-semibold text-[var(--color-fg)]">{fmtBRL(valorTotal)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pagination numerada */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--color-border)] bg-[var(--color-surface-2)]/30 text-xs">
            <span className="text-[var(--color-fg-muted)]">
              Mostrando <span className="font-medium text-[var(--color-fg)] tabular-nums">{Math.min(pageSize, filtered.length)}</span> de <span className="tabular-nums font-medium text-[var(--color-fg)]">{filtered.length}</span> fretes
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="h-7 w-7 inline-flex items-center justify-center rounded border border-[var(--color-border)] disabled:opacity-40 hover:bg-[var(--color-surface-1)] transition-colors"
                aria-label="Página anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              {Array.from({ length: Math.min(5, table.getPageCount()) }).map((_, i) => {
                const isActive = pageIndex === i;
                return (
                  <button
                    key={i}
                    onClick={() => setPageIndex(i)}
                    className={`h-7 min-w-7 px-2 inline-flex items-center justify-center rounded text-xs tabular-nums font-medium transition-colors ${
                      isActive
                        ? 'bg-[var(--color-accent)] text-[var(--color-fg-on-accent)]'
                        : 'border border-[var(--color-border)] hover:bg-[var(--color-surface-1)] text-[var(--color-fg-muted)]'
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="h-7 w-7 inline-flex items-center justify-center rounded border border-[var(--color-border)] disabled:opacity-40 hover:bg-[var(--color-surface-1)] transition-colors"
                aria-label="Próxima página"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label-eyebrow mb-0.5">{label}</p>
      <p className="text-sm text-[var(--color-fg)]">{value}</p>
    </div>
  );
}
