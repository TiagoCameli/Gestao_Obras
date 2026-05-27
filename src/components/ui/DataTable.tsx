/**
 * DataTable — wrapper genérico sobre @tanstack/react-table v8.
 *
 * Premium features (vs map+table cru):
 *   - Sort por coluna (TanStack)
 *   - Paginação numerada (1..N) com persistência opcional em localStorage
 *   - Bulk selection (checkbox por linha + toolbar com slot bulkActions)
 *   - Column visibility toggle (DropdownMenu shadcn)
 *   - Density toggle (compact / normal / comfortable)
 *   - Sticky header com max-h responsivo
 *   - Row expansion opcional (renderExpanded)
 *   - Click na linha (onRowClick)
 *   - Footer com totalizações (renderFooter)
 *   - Loading state via Skeleton rows
 *   - Empty state via <EmptyState> (props empty)
 *
 * Caller passa columns (ColumnDef[]) + data + handlers. DataTable assume
 * o controle de estado interno (sorting, pagination, selection, expansion,
 * density, columnVisibility) — caller só observa via bulkActions.
 *
 * Variant: 'card' (default — surface-raised wrapper) ou 'flat' (sem wrap).
 */
import {
  useCallback, useEffect, useMemo, useState, Fragment,
  type ReactNode,
} from 'react';
import {
  ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight,
  Eye, Sliders, type LucideIcon,
} from 'lucide-react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getPaginationRowModel,
  getExpandedRowModel, flexRender,
  type ColumnDef, type ExpandedState, type SortingState,
  type RowSelectionState, type VisibilityState, type Row,
} from '@tanstack/react-table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuCheckboxItem, DropdownMenuSeparator, DropdownMenuLabel,
} from '../shadcn/dropdown-menu';
import EmptyState from './EmptyState';

type Density = 'compact' | 'normal' | 'comfortable';

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];

  isLoading?: boolean;

  /** Empty state — quando data está vazio (não em loading). */
  empty?: {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: ReactNode;
  };

  /** Ordenação inicial. */
  defaultSorting?: SortingState;

  /** Identificador da linha — necessário pra selection/expansion estáveis. */
  getRowId?: (row: T, index: number) => string;

  /** Paginação. */
  pageSize?: number;
  pageSizeOptions?: number[];
  /** Chave do localStorage pra persistir pageSize. Sem isso, vai resetar a 25. */
  persistPageSizeKey?: string;

  /** Bulk selection. */
  enableSelection?: boolean;
  /** Render do toolbar de ações em massa. Aparece só quando selectedRows.length>0. */
  bulkActions?: (selectedRows: T[], clearSelection: () => void) => ReactNode;

  /** Density toggle. */
  defaultDensity?: Density;
  enableDensityToggle?: boolean;

  /** Column visibility toggle. */
  defaultColumnVisibility?: VisibilityState;
  enableColumnVisibilityToggle?: boolean;

  /** Expansão de linha. */
  enableExpanding?: boolean;
  renderExpanded?: (row: T) => ReactNode;

  /** Click na linha — abre detalhe etc. Click em <button>/<a> NÃO propaga (usar e.stopPropagation no caller se precisar). */
  onRowClick?: (row: T) => void;

  /** Render do footer/totalização. Recebe TODAS as rows filtradas (não só a página). */
  renderFooter?: (rows: T[]) => ReactNode;

  /** Wrapper visual. */
  variant?: 'card' | 'flat';

  className?: string;

  /** Label pra contagem no footer ("fretes", "equipamentos"). Default: "registros". */
  itemLabel?: { singular: string; plural: string };
}

const densityPad: Record<Density, string> = {
  compact: 'py-1.5',
  normal: 'py-2.5',
  comfortable: 'py-3.5',
};

function readPersistedPageSize(key: string | undefined, fallback: number, options: number[]): number {
  if (!key || typeof window === 'undefined') return fallback;
  const stored = window.localStorage.getItem(key);
  const n = stored ? parseInt(stored, 10) : fallback;
  return options.includes(n) ? n : fallback;
}

export default function DataTable<T>({
  columns,
  data,
  isLoading = false,
  empty,
  defaultSorting = [],
  getRowId,
  pageSize: pageSizeProp = 25,
  pageSizeOptions = [25, 50, 100],
  persistPageSizeKey,
  enableSelection = false,
  bulkActions,
  defaultDensity = 'normal',
  enableDensityToggle = false,
  defaultColumnVisibility = {},
  enableColumnVisibilityToggle = false,
  enableExpanding = false,
  renderExpanded,
  onRowClick,
  renderFooter,
  variant = 'card',
  className = '',
  itemLabel = { singular: 'registro', plural: 'registros' },
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>(defaultSorting);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(defaultColumnVisibility);
  const [density, setDensity] = useState<Density>(defaultDensity);

  const [pageSize, setPageSize] = useState<number>(
    () => readPersistedPageSize(persistPageSizeKey, pageSizeProp, pageSizeOptions),
  );
  const [pageIndex, setPageIndex] = useState<number>(0);

  const persistPageSize = useCallback((n: number) => {
    setPageSize(n);
    setPageIndex(0);
    if (persistPageSizeKey && typeof window !== 'undefined') {
      window.localStorage.setItem(persistPageSizeKey, String(n));
    }
  }, [persistPageSizeKey]);

  // Reset pageIndex quando data muda e remove página fora de range
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
    if (pageIndex >= totalPages) setPageIndex(0);
  }, [data.length, pageSize, pageIndex]);

  // Injeta coluna de seleção no início se enableSelection
  const finalColumns = useMemo<ColumnDef<T>[]>(() => {
    if (!enableSelection) return columns;
    const selCol: ColumnDef<T> = {
      id: '__select',
      enableSorting: false,
      enableHiding: false,
      size: 36,
      header: ({ table }) => (
        <input
          type="checkbox"
          aria-label="Selecionar todos"
          checked={table.getIsAllRowsSelected()}
          ref={(el) => { if (el) el.indeterminate = table.getIsSomeRowsSelected(); }}
          onChange={table.getToggleAllRowsSelectedHandler()}
          className="w-3.5 h-3.5 rounded border-[var(--color-border-strong)] text-[var(--color-accent)] focus:ring-[var(--color-ring)] cursor-pointer"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          aria-label="Selecionar linha"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          onClick={(e) => e.stopPropagation()}
          className="w-3.5 h-3.5 rounded border-[var(--color-border-strong)] text-[var(--color-accent)] focus:ring-[var(--color-ring)] cursor-pointer"
        />
      ),
    };
    return [selCol, ...columns];
  }, [enableSelection, columns]);

  const table = useReactTable({
    data,
    columns: finalColumns,
    state: { sorting, expanded, rowSelection, columnVisibility, pagination: { pageIndex, pageSize } },
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
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: enableExpanding ? getExpandedRowModel() : undefined,
    getRowCanExpand: enableExpanding ? () => true : undefined,
    getRowId: getRowId ? (row, index) => getRowId(row, index) : undefined,
    enableRowSelection: enableSelection,
  });

  const selectedRows = useMemo(
    () => table.getSelectedRowModel().rows.map((r) => r.original),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rowSelection, data],
  );
  const clearSelection = useCallback(() => setRowSelection({}), []);
  const selectedCount = selectedRows.length;

  const showToolbar = (enableDensityToggle || enableColumnVisibilityToggle || (enableSelection && selectedCount > 0));
  const wrapperClass = variant === 'card'
    ? `surface-raised overflow-hidden ${className}`
    : className;

  // Loading
  if (isLoading) {
    const cols = finalColumns.length;
    return (
      <div className={wrapperClass}>
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface-2)]">
            <tr>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="px-3 py-2.5">
                  <div className="h-3 rounded bg-[var(--color-surface-3)] animate-pulse" style={{ width: '60%' }} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-t border-[var(--color-border)]">
                {Array.from({ length: cols }).map((_, j) => (
                  <td key={j} className="px-3 py-3">
                    <div className="h-4 rounded bg-[var(--color-surface-2)] animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Empty (after loading)
  if (!isLoading && data.length === 0 && empty) {
    return (
      <EmptyState
        icon={empty.icon}
        title={empty.title}
        description={empty.description}
        action={empty.action}
        className={className}
      />
    );
  }

  return (
    <div className={wrapperClass}>
      {/* Toolbar topo (density + columns + bulk actions) */}
      {showToolbar && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/40 flex-wrap">
          <div className="flex items-center gap-2">
            {enableSelection && selectedCount > 0 && (
              <>
                <span className="text-sm font-medium text-[var(--color-fg)]">
                  {selectedCount} selecionado{selectedCount > 1 ? 's' : ''}
                </span>
                {bulkActions && (
                  <div className="flex items-center gap-1">
                    {bulkActions(selectedRows, clearSelection)}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            {enableDensityToggle && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="h-7 px-2 inline-flex items-center gap-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
                    aria-label="Alterar densidade"
                  >
                    <Sliders className="w-3 h-3" /> {density}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Densidade</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {(['compact', 'normal', 'comfortable'] as Density[]).map((d) => (
                    <DropdownMenuItem key={d} onClick={() => setDensity(d)}>
                      {d === density && '✓ '}{d}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {enableColumnVisibilityToggle && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="h-7 px-2 inline-flex items-center gap-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
                    aria-label="Colunas visíveis"
                  >
                    <Eye className="w-3 h-3" /> Colunas
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
                      {(typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id)}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      )}

      {/* Tabela com sticky-header */}
      <div className="overflow-auto max-h-[calc(100vh-340px)]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--color-surface-2)]/95 backdrop-blur-sm">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const canSort = h.column.getCanSort();
                  const sortDir = h.column.getIsSorted();
                  const SortIcon = !sortDir ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
                  // Suporte a alignment via columnDef.meta.align (default 'left')
                  const align = (h.column.columnDef.meta as { align?: 'left' | 'right' | 'center' } | undefined)?.align ?? 'left';
                  const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
                  const flexAlignCls = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : '';
                  return (
                    <th
                      key={h.id}
                      onClick={canSort ? h.column.getToggleSortingHandler() : undefined}
                      className={
                        `px-3 py-2.5 ${alignCls} text-2xs uppercase tracking-wider font-semibold text-[var(--color-fg-muted)] ` +
                        (canSort ? 'cursor-pointer hover:text-[var(--color-fg)] select-none ' : '')
                      }
                      style={{ width: h.getSize() !== 150 ? h.getSize() : undefined }}
                    >
                      {h.isPlaceholder ? null : (
                        <span className={`inline-flex items-center gap-1 ${flexAlignCls}`}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {canSort && (
                            <SortIcon
                              className={`w-3 h-3 ${sortDir ? 'opacity-100 text-[var(--color-accent)]' : 'opacity-40'}`}
                              aria-hidden
                            />
                          )}
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
              <RowItem<T>
                key={row.id}
                row={row}
                density={density}
                onRowClick={onRowClick}
                enableExpanding={enableExpanding}
                renderExpanded={renderExpanded}
              />
            ))}
          </tbody>
          {renderFooter && (
            <tfoot className="bg-[var(--color-surface-2)]/50 border-t-2 border-[var(--color-border-strong)]">
              {renderFooter(data)}
            </tfoot>
          )}
        </table>
      </div>

      {/* Paginação numerada */}
      <Pagination
        table={table}
        pageSize={pageSize}
        pageSizeOptions={pageSizeOptions}
        onPageSizeChange={persistPageSize}
        totalCount={data.length}
        itemLabel={itemLabel}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- */

function RowItem<T>({
  row, density, onRowClick, enableExpanding, renderExpanded,
}: {
  row: Row<T>;
  density: Density;
  onRowClick?: (row: T) => void;
  enableExpanding: boolean;
  renderExpanded?: (row: T) => ReactNode;
}) {
  const handleClick = () => {
    if (enableExpanding && !onRowClick) {
      row.toggleExpanded();
    } else if (onRowClick) {
      onRowClick(row.original);
    }
  };
  return (
    <Fragment>
      <tr
        onClick={handleClick}
        className={
          'group border-t border-[var(--color-border)] transition-colors duration-[var(--dur-fast)] ' +
          (onRowClick || enableExpanding ? 'cursor-pointer hover:bg-[var(--color-surface-2)]/60 ' : '') +
          (row.getIsSelected() ? 'bg-[var(--color-accent-soft)]/40 ' : '')
        }
      >
        {row.getVisibleCells().map((cell) => {
          const align = (cell.column.columnDef.meta as { align?: 'left' | 'right' | 'center' } | undefined)?.align ?? 'left';
          const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : '';
          return (
            <td key={cell.id} className={`px-3 ${densityPad[density]} align-middle ${alignCls}`}>
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </td>
          );
        })}
      </tr>
      {enableExpanding && row.getIsExpanded() && renderExpanded && (
        <tr className="bg-[var(--color-surface-2)]/30">
          <td colSpan={row.getVisibleCells().length} className="px-6 py-4 border-t border-[var(--color-border)]">
            {renderExpanded(row.original)}
          </td>
        </tr>
      )}
    </Fragment>
  );
}

function Pagination<T>({
  table, pageSize, pageSizeOptions, onPageSizeChange, totalCount, itemLabel,
}: {
  table: ReturnType<typeof useReactTable<T>>;
  pageSize: number;
  pageSizeOptions: number[];
  onPageSizeChange: (n: number) => void;
  totalCount: number;
  itemLabel: { singular: string; plural: string };
}) {
  const pageIndex = table.getState().pagination.pageIndex;
  const totalPages = table.getPageCount();
  const showingFrom = totalCount === 0 ? 0 : pageIndex * pageSize + 1;
  const showingTo = Math.min((pageIndex + 1) * pageSize, totalCount);
  const label = totalCount === 1 ? itemLabel.singular : itemLabel.plural;

  // Renderiza window de até 5 números, centrado na página atual quando possível
  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i);
    let start = Math.max(0, pageIndex - 2);
    const end = Math.min(totalPages, start + 5);
    start = Math.max(0, end - 5);
    return Array.from({ length: end - start }, (_, i) => start + i);
  }, [pageIndex, totalPages]);

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-[var(--color-border)] bg-[var(--color-surface-2)]/30 text-xs flex-wrap">
      <span className="text-[var(--color-fg-muted)]">
        Mostrando <span className="font-medium text-[var(--color-fg)] tabular-nums">{showingFrom}-{showingTo}</span>
        {' '}de <span className="tabular-nums font-medium text-[var(--color-fg)]">{totalCount}</span> {label}
      </span>
      <div className="flex items-center gap-1">
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}
          className="h-7 px-2 rounded border border-[var(--color-border)] bg-[var(--color-surface-1)] text-xs text-[var(--color-fg)] cursor-pointer"
          aria-label="Linhas por página"
        >
          {pageSizeOptions.map((n) => (
            <option key={n} value={n}>{n}/pg</option>
          ))}
        </select>
        <button
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          className="h-7 w-7 inline-flex items-center justify-center rounded border border-[var(--color-border)] disabled:opacity-40 hover:bg-[var(--color-surface-1)] transition-colors"
          aria-label="Página anterior"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        {pageNumbers.map((i) => {
          const isActive = pageIndex === i;
          return (
            <button
              key={i}
              onClick={() => table.setPageIndex(i)}
              className={
                'h-7 min-w-7 px-2 inline-flex items-center justify-center rounded text-xs tabular-nums font-medium transition-colors ' +
                (isActive
                  ? 'bg-[var(--color-accent)] text-[var(--color-fg-on-accent)]'
                  : 'border border-[var(--color-border)] hover:bg-[var(--color-surface-1)] text-[var(--color-fg-muted)]')
              }
              aria-label={`Página ${i + 1}`}
              aria-current={isActive ? 'page' : undefined}
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
  );
}
