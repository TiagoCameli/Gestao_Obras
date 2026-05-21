import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getPaginationRowModel,
  getExpandedRowModel, createColumnHelper, flexRender,
  type ColumnDef, type ExpandedState, type SortingState,
} from '@tanstack/react-table';
import {
  ArrowUpDown, ArrowUp, ArrowDown, ChevronRight, ChevronDown,
  MoreVertical, Pencil, Trash2,
} from 'lucide-react';
import type { Frete, Obra, Insumo } from '../../types';
import FreteRowExpanded from './FreteRowExpanded';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../shadcn/dropdown-menu';

interface Props {
  fretes: Frete[];
  obras: Obra[];
  insumos: Insumo[];
  filtros: { obraId: string; transportadora: string; motorista: string; insumoId: string; origem: string; destino: string; dataInicio: string; dataFim: string; notaFiscal: string };
  filtroSemChegada?: boolean;
  onEdit: (frete: Frete) => void;
  onDelete: (id: string) => void;
  onSelect?: (f: Frete) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtData(iso: string): { dia: string; hora?: string } {
  if (!iso) return { dia: '—' };
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { dia: `${m[3]}/${m[2]}` };
  return { dia: iso };
}

const PAGE_SIZE_KEY = 'frete-list-page-size-v2';

function getInitialPageSize(): number {
  if (typeof window === 'undefined') return 25;
  const stored = window.localStorage.getItem(PAGE_SIZE_KEY);
  const n = stored ? parseInt(stored, 10) : 25;
  return [25, 50, 100].includes(n) ? n : 25;
}

export default function FreteListV2({
  fretes, obras: _obras, insumos, filtros, filtroSemChegada = false,
  onEdit, onDelete, onSelect, canEdit = true, canDelete = true,
}: Props) {
  const insumosMap = useMemo(() => new Map(insumos.map((i) => [i.id, i.nome])), [insumos]);

  // Filtros client-side (mesma lógica do FreteList v1)
  const filtrados = useMemo(() => {
    return fretes.filter((f) => {
      if (filtros.obraId && f.obraId !== filtros.obraId) return false;
      if (filtros.transportadora && f.transportadora !== filtros.transportadora) return false;
      if (filtros.motorista) {
        const q = filtros.motorista.toLowerCase();
        if (!f.motorista?.toLowerCase().includes(q)) return false;
      }
      if (filtros.insumoId && f.insumoId !== filtros.insumoId) return false;
      if (filtros.origem && f.origem?.trim() !== filtros.origem) return false;
      if (filtros.destino && f.destino?.trim() !== filtros.destino) return false;
      if (filtros.dataInicio && f.data < filtros.dataInicio) return false;
      if (filtros.dataFim && f.data > filtros.dataFim) return false;
      if (filtros.notaFiscal) {
        const q = filtros.notaFiscal.toLowerCase();
        if (!f.notaFiscal?.toLowerCase().includes(q)) return false;
      }
      if (filtroSemChegada && f.dataChegada) return false;
      return true;
    });
  }, [fretes, filtros, filtroSemChegada]);

  const ch = useMemo(() => createColumnHelper<Frete>(), []);

  const columns = useMemo<ColumnDef<Frete>[]>(() => [
    {
      id: 'expander',
      header: '',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); row.toggleExpanded(); }}
          className="p-1 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          title={row.getIsExpanded() ? 'Recolher' : 'Expandir'}
        >
          {row.getIsExpanded() ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      ),
      size: 32,
    },
    ch.accessor('data', {
      header: 'Data',
      cell: ({ row }) => {
        const { dia } = fmtData(row.original.data);
        const chegada = row.original.dataChegada ? fmtData(row.original.dataChegada).dia : null;
        return (
          <div className="flex flex-col">
            <span className="font-medium">{dia}</span>
            {chegada ? (
              <span className="text-[10px] text-[var(--color-fg-muted)] uppercase tracking-wide">chegou {chegada}</span>
            ) : (
              <span className="text-[10px] text-[var(--color-fg-subtle)] italic">sem chegada</span>
            )}
          </div>
        );
      },
      sortingFn: 'alphanumeric',
    }) as ColumnDef<Frete>,
    {
      id: 'origemDestino',
      header: 'Origem → Destino',
      accessorFn: (f) => `${f.origem ?? ''} → ${f.destino ?? ''}`,
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium truncate max-w-[200px]">{row.original.origem || '—'}</span>
          <span className="text-xs text-[var(--color-fg-muted)] truncate max-w-[200px]">→ {row.original.destino || '—'}</span>
        </div>
      ),
    },
    ch.accessor('transportadora', {
      header: 'Transportadora',
      cell: ({ row }) => {
        const motorista = row.original.motorista?.trim();
        const placa = row.original.placaCarreta?.trim();
        return (
          <div className="flex flex-col leading-tight">
            <span className="font-medium">{row.original.transportadora || '—'}</span>
            {motorista && (
              <span className="text-xs text-[var(--color-fg-muted)]">{motorista}</span>
            )}
            {placa && (
              <span className="text-[10px] text-[var(--color-fg-subtle)] uppercase tracking-wide tabular-nums">{placa}</span>
            )}
          </div>
        );
      },
    }) as ColumnDef<Frete>,
    {
      id: 'material',
      header: 'Material',
      accessorFn: (f) => insumosMap.get(f.insumoId) || f.insumoId,
      cell: (info) => <span className="truncate max-w-[120px]">{String(info.getValue())}</span>,
    },
    ch.accessor('pesoToneladas', {
      header: 'Peso (t)',
      cell: (info) => <span className="tabular-nums">{(info.getValue() ?? 0).toLocaleString('pt-BR')} t</span>,
    }) as ColumnDef<Frete>,
    ch.accessor('valorTotal', {
      header: 'Valor',
      cell: (info) => <span className="tabular-nums font-semibold">{fmtBRL(info.getValue() ?? 0)}</span>,
    }) as ColumnDef<Frete>,
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
  ], [ch, insumosMap, canEdit, canDelete, onEdit, onDelete]);

  const [sorting, setSorting] = useState<SortingState>([{ id: 'data', desc: true }]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [pageSize, setPageSize] = useState<number>(getInitialPageSize);
  const [pageIndex, setPageIndex] = useState<number>(0);

  const persistPageSize = useCallback((n: number) => {
    setPageSize(n);
    setPageIndex(0);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PAGE_SIZE_KEY, String(n));
    }
  }, []);

  // Clamp pageIndex when filtros reduce the list
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filtrados.length / pageSize));
    if (pageIndex >= totalPages) {
      setPageIndex(0);
    }
  }, [filtrados.length, pageSize, pageIndex]);

  const table = useReactTable({
    data: filtrados,
    columns,
    state: { sorting, expanded, pagination: { pageIndex, pageSize } },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function'
        ? updater({ pageIndex, pageSize })
        : updater;
      setPageIndex(next.pageIndex);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowCanExpand: () => true,
  });

  if (filtrados.length === 0) {
    return (
      <div className="surface-raised p-8 text-center">
        <p className="text-[var(--color-fg-muted)]">Nenhum frete encontrado.</p>
      </div>
    );
  }

  return (
    <div className="surface-raised overflow-hidden">
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
                  data-frete-id={row.original.id}
                  onClick={() => onSelect?.(row.original)}
                  className="hover:bg-[var(--color-surface-1)] cursor-pointer border-t border-[var(--color-border)]"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                {row.getIsExpanded() && (
                  <tr>
                    <td colSpan={row.getVisibleCells().length} className="p-0">
                      <FreteRowExpanded
                        frete={row.original}
                        insumos={insumos}
                        canEdit={!!canEdit}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-3 py-2 border-t border-[var(--color-border)] bg-[var(--color-surface-2)]/30 text-xs text-[var(--color-fg-muted)]">
        <div>
          {filtrados.length} fretes · Página {table.getState().pagination.pageIndex + 1} de {table.getPageCount()}
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
