// EntradaListV2 — lista de entradas de combustível.
// Usa @tanstack/react-table com sort por coluna, paginação e DropdownMenu shadcn.
// Remove o header bg-emt-verde brilhante do Audit item 10.
// Espelha o padrão de FreteListV2 (Fase B).

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getPaginationRowModel,
  createColumnHelper, flexRender,
  type ColumnDef, type SortingState,
} from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import type { EntradaCombustivel, Deposito, Insumo, Fornecedor } from '../../types';
import AnexosBadge from './AnexosBadge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../shadcn/dropdown-menu';
import { fmtDataHora as fmtData } from './v2/shared/formatters';

interface Props {
  entradas: EntradaCombustivel[];
  depositos: Deposito[];
  /** Passados diretamente pra evitar hook interno (padrão container). */
  combustiveis?: Insumo[];
  fornecedores?: Fornecedor[];
  onEdit: (e: EntradaCombustivel) => void;
  onDelete: (id: string) => void;
  onSelect?: (e: EntradaCombustivel) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const PAGE_SIZE_KEY = 'entrada-combustivel-list-page-size-v2';

function getInitialPageSize(): number {
  if (typeof window === 'undefined') return 25;
  const stored = window.localStorage.getItem(PAGE_SIZE_KEY);
  const n = stored ? parseInt(stored, 10) : 25;
  return [25, 50, 100].includes(n) ? n : 25;
}

export default function EntradaListV2({
  entradas,
  depositos,
  combustiveis = [],
  fornecedores = [],
  onEdit,
  onDelete,
  onSelect,
  canEdit = true,
  canDelete = true,
}: Props) {
  const depositosMap = useMemo(
    () => new Map(depositos.map((d) => [d.id, d.apelido || d.nome])),
    [depositos],
  );
  const combustMap = useMemo(
    () => new Map(combustiveis.map((c) => [c.id, c.nome])),
    [combustiveis],
  );
  const fornecedoresMap = useMemo(
    () => new Map(fornecedores.map((f) => [f.id, f.nome])),
    [fornecedores],
  );

  const totalLitros = useMemo(
    () => entradas.reduce((acc, e) => acc + e.quantidadeLitros, 0),
    [entradas],
  );
  const totalValor = useMemo(
    () => entradas.reduce((acc, e) => acc + e.valorTotal, 0),
    [entradas],
  );

  const ch = useMemo(() => createColumnHelper<EntradaCombustivel>(), []);

  const columns = useMemo<ColumnDef<EntradaCombustivel>[]>(() => [
    ch.accessor('dataHora', {
      header: 'Data/Hora',
      cell: ({ row }) => (
        <span className="font-medium tabular-nums whitespace-nowrap">{fmtData(row.original.dataHora)}</span>
      ),
      sortingFn: 'alphanumeric',
    }) as ColumnDef<EntradaCombustivel>,
    {
      id: 'tanque',
      header: 'Tanque',
      accessorFn: (e) => depositosMap.get(e.depositoId) ?? '—',
      cell: (info) => (
        <span className="text-[var(--color-fg-muted)] text-xs">{String(info.getValue())}</span>
      ),
    },
    {
      id: 'combustivel',
      header: 'Combustível',
      accessorFn: (e) => combustMap.get(e.tipoCombustivel) ?? e.tipoCombustivel,
      cell: (info) => (
        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)]">
          {String(info.getValue())}
        </span>
      ),
    },
    {
      id: 'fornecedor',
      header: 'Fornecedor',
      accessorFn: (e) => {
        // fornecedor pode ser ID ou texto livre
        return fornecedoresMap.get(e.fornecedor) ?? e.fornecedor ?? '—';
      },
      cell: (info) => (
        <span className="truncate max-w-[160px] block">{String(info.getValue())}</span>
      ),
    },
    ch.accessor('quantidadeLitros', {
      header: 'Litros',
      cell: (info) => (
        <span className="tabular-nums font-medium text-[var(--color-success,theme(colors.green.600))] text-right block">
          +{(info.getValue() ?? 0).toFixed(1)} L
        </span>
      ),
    }) as ColumnDef<EntradaCombustivel>,
    ch.accessor('valorTotal', {
      header: 'Valor',
      cell: (info) => (
        <span className="tabular-nums font-semibold text-right block">{fmtBRL(info.getValue() ?? 0)}</span>
      ),
    }) as ColumnDef<EntradaCombustivel>,
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
        if (!canEdit && !canDelete) return null;
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
              {canEdit && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(row.original); }}>
                  <Pencil className="w-3.5 h-3.5 mr-2" />
                  Editar
                </DropdownMenuItem>
              )}
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
  ], [ch, depositosMap, combustMap, fornecedoresMap, canEdit, canDelete, onEdit, onDelete]);

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
    const totalPages = Math.max(1, Math.ceil(entradas.length / pageSize));
    if (pageIndex >= totalPages) setPageIndex(0);
  }, [entradas.length, pageSize, pageIndex]);

  const table = useReactTable({
    data: entradas,
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

  if (entradas.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-8 text-center">
        <p className="text-[var(--color-fg-muted)] text-sm">Nenhuma entrada registrada.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-hidden">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/50 text-xs text-[var(--color-fg-muted)]">
        <span><span className="font-semibold text-[var(--color-fg)]">{entradas.length}</span> entrada{entradas.length !== 1 ? 's' : ''}</span>
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
                  data-entrada-id={row.original.id}
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
