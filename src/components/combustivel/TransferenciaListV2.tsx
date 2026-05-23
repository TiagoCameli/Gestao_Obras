// TransferenciaListV2 — lista de transferências entre tanques.
// Usa @tanstack/react-table com sort por coluna, paginação e DropdownMenu shadcn.
// Remove o header bg-emt-verde brilhante do Audit item 10.
// Espelha o padrão de FreteListV2 (Fase B).
// Nota: transferências não têm edição no padrão atual — só exclusão.

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getPaginationRowModel,
  createColumnHelper, flexRender,
  type ColumnDef, type SortingState,
} from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown, MoreVertical, Trash2, ArrowRight } from 'lucide-react';
import type { TransferenciaCombustivel, Deposito, Insumo } from '../../types';
import AnexosBadge from './AnexosBadge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../shadcn/dropdown-menu';
import { fmtDataHora as fmtData } from './v2/shared/formatters';

interface Props {
  transferencias: TransferenciaCombustivel[];
  depositos: Deposito[];
  /** HF.7 — Pra resolver tipoCombustivel (id) → nome do insumo. */
  insumos?: Insumo[];
  onDelete: (id: string) => void;
  onSelect?: (t: TransferenciaCombustivel) => void;
  canDelete?: boolean;
}

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const PAGE_SIZE_KEY = 'transferencia-combustivel-list-page-size-v2';

function getInitialPageSize(): number {
  if (typeof window === 'undefined') return 25;
  const stored = window.localStorage.getItem(PAGE_SIZE_KEY);
  const n = stored ? parseInt(stored, 10) : 25;
  return [25, 50, 100].includes(n) ? n : 25;
}

export default function TransferenciaListV2({
  transferencias,
  depositos,
  insumos = [],
  onDelete,
  onSelect,
  canDelete = true,
}: Props) {
  const depositosMap = useMemo(
    () => new Map(depositos.map((d) => [d.id, d.apelido || d.nome])),
    [depositos],
  );
  const insumosMap = useMemo(
    () => new Map(insumos.map((i) => [i.id, i.nome])),
    [insumos],
  );

  const totalLitros = useMemo(
    () => transferencias.reduce((acc, t) => acc + t.quantidadeLitros, 0),
    [transferencias],
  );
  const totalValor = useMemo(
    () => transferencias.reduce((acc, t) => acc + t.valorTotal, 0),
    [transferencias],
  );

  const ch = useMemo(() => createColumnHelper<TransferenciaCombustivel>(), []);

  const columns = useMemo<ColumnDef<TransferenciaCombustivel>[]>(() => [
    ch.accessor('dataHora', {
      header: 'Data/Hora',
      cell: ({ row }) => (
        <span className="font-medium tabular-nums whitespace-nowrap">{fmtData(row.original.dataHora)}</span>
      ),
      sortingFn: 'alphanumeric',
    }) as ColumnDef<TransferenciaCombustivel>,
    {
      id: 'origemDestino',
      header: 'Origem → Destino',
      accessorFn: (t) => {
        const orig = depositosMap.get(t.depositoOrigemId) ?? '—';
        const dest = depositosMap.get(t.depositoDestinoId) ?? '—';
        return `${orig} → ${dest}`;
      },
      cell: ({ row }) => {
        const orig = depositosMap.get(row.original.depositoOrigemId) ?? '—';
        const dest = depositosMap.get(row.original.depositoDestinoId) ?? '—';
        return (
          <span className="inline-flex items-center gap-1.5 text-[var(--color-fg)]">
            <span className="font-medium truncate max-w-[120px]">{orig}</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0 text-[var(--color-fg-muted)]" />
            <span className="truncate max-w-[120px] text-[var(--color-fg-muted)]">{dest}</span>
          </span>
        );
      },
    },
    {
      id: 'combustivel',
      header: 'Combustível',
      accessorFn: (t) => insumosMap.get(t.tipoCombustivel ?? '') || t.tipoCombustivel || '—',
      cell: (info) => {
        const val = String(info.getValue());
        if (val === '—') return <span className="text-[var(--color-fg-muted)] italic">—</span>;
        return (
          <span className="inline-block px-2 py-0.5 text-[10px] rounded-full uppercase tracking-wide bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)] font-semibold">
            {val}
          </span>
        );
      },
    } as ColumnDef<TransferenciaCombustivel>,
    ch.accessor('quantidadeLitros', {
      header: 'Litros',
      cell: (info) => (
        <span className="tabular-nums text-right block">
          {(info.getValue() ?? 0).toFixed(1)} L
        </span>
      ),
    }) as ColumnDef<TransferenciaCombustivel>,
    ch.accessor('valorTotal', {
      header: 'Valor',
      cell: (info) => (
        <span className="tabular-nums font-semibold text-right block">{fmtBRL(info.getValue() ?? 0)}</span>
      ),
    }) as ColumnDef<TransferenciaCombustivel>,
    {
      id: 'anexos',
      header: '',
      cell: ({ row }) => (
        <AnexosBadge fotoUrls={row.original.fotoUrls} arquivoUrls={row.original.arquivoUrls} />
      ),
      size: 40,
      enableSorting: false,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        if (!canDelete) return null;
        return (
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
              {canDelete && (
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); onDelete(row.original.id); }}
                  className="text-[var(--color-danger)] focus:text-[var(--color-danger)]"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  Excluir
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      size: 32,
      enableSorting: false,
    },
  ], [ch, depositosMap, insumosMap, canDelete, onDelete]);

  const [sorting, setSorting] = useState<SortingState>([{ id: 'dataHora', desc: true }]);
  const [pageSize, setPageSize] = useState<number>(getInitialPageSize);
  const [pageIndex, setPageIndex] = useState<number>(0);

  const persistPageSize = useCallback((n: number) => {
    setPageSize(n);
    setPageIndex(0);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PAGE_SIZE_KEY, String(n));
    }
  }, []);

  // Clamp pageIndex when data shrinks
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(transferencias.length / pageSize));
    if (pageIndex >= totalPages) setPageIndex(0);
  }, [transferencias.length, pageSize, pageIndex]);

  const table = useReactTable({
    data: transferencias,
    columns,
    state: { sorting, pagination: { pageIndex, pageSize } },
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function'
        ? updater({ pageIndex, pageSize })
        : updater;
      setPageIndex(next.pageIndex);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  if (transferencias.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-8 text-center">
        <p className="text-[var(--color-fg-muted)] text-sm">Nenhuma transferência registrada.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-hidden">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/50 text-xs text-[var(--color-fg-muted)]">
        <span><span className="font-semibold text-[var(--color-fg)]">{transferencias.length}</span> transferência{transferencias.length !== 1 ? 's' : ''}</span>
        <span>·</span>
        <span><span className="font-semibold text-[var(--color-fg)]">{totalLitros.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</span> L</span>
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
                      className={`px-3 py-2.5 text-left text-[10px] uppercase tracking-wide font-semibold text-[var(--color-fg-muted)] ${canSort ? 'cursor-pointer hover:bg-[var(--color-surface-2)] select-none' : ''}`}
                      style={{ width: h.getSize() === 150 ? undefined : h.getSize() }}
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
                  data-transferencia-id={row.original.id}
                  onClick={() => onSelect?.(row.original)}
                  className={`hover:bg-[var(--color-surface-1)] border-t border-[var(--color-border)] ${onSelect ? 'cursor-pointer' : ''}`}
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
