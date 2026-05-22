// SaidaCombustivelListV2 — lista unificada de saídas de combustível.
// Usa @tanstack/react-table com sort por coluna, paginação e DropdownMenu shadcn.
// Espelha o padrão de FreteListV2 (Fase B).

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getPaginationRowModel,
  createColumnHelper, flexRender,
  type ColumnDef, type SortingState,
} from '@tanstack/react-table';
import {
  ArrowUpDown, ArrowUp, ArrowDown,
  MoreVertical, Pencil, Trash2,
  Settings2, Truck, AlertCircle,
} from 'lucide-react';
import type {
  SaidaCombustivel,
  OrigemCombustivel,
  Obra,
  Deposito,
  Equipamento,
  Fornecedor,
  Insumo,
} from '../../types';
import AnexosBadge from './AnexosBadge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../shadcn/dropdown-menu';

interface Props {
  saidas: SaidaCombustivel[];
  obras: Obra[];
  depositos: Deposito[];
  equipamentos: Equipamento[];
  transportadoras: Fornecedor[];
  combustiveis: Insumo[];
  onEdit?: (s: SaidaCombustivel) => void;
  onDelete?: (id: string) => void;
  onSelect?: (s: SaidaCombustivel) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

const ORIGEM_LABEL: Record<OrigemCombustivel, string> = {
  tanque: 'Tanque',
  dinheiro: 'Dinheiro',
  requisicao: 'Requisição',
};

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtData(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const PAGE_SIZE_KEY = 'saida-combustivel-list-page-size-v2';

function getInitialPageSize(): number {
  if (typeof window === 'undefined') return 25;
  const stored = window.localStorage.getItem(PAGE_SIZE_KEY);
  const n = stored ? parseInt(stored, 10) : 25;
  return [25, 50, 100].includes(n) ? n : 25;
}

export default function SaidaCombustivelListV2({
  saidas,
  obras,
  depositos,
  equipamentos,
  transportadoras,
  combustiveis,
  onEdit,
  onDelete,
  onSelect,
  canEdit = true,
  canDelete = true,
}: Props) {
  // Maps pra resolver nomes
  const obrasMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);
  const tanquesMap = useMemo(() => new Map(depositos.map((d) => [d.id, d.apelido || d.nome])), [depositos]);
  const equipMap = useMemo(
    () => new Map(equipamentos.map((e) => [e.id, { nome: e.nome, codigo: e.codigoPatrimonio }])),
    [equipamentos],
  );
  const transpMap = useMemo(() => new Map(transportadoras.map((t) => [t.id, t.nome])), [transportadoras]);
  const combustMap = useMemo(() => new Map(combustiveis.map((c) => [c.id, c.nome])), [combustiveis]);

  const totalLitros = useMemo(() => saidas.reduce((acc, s) => acc + s.litros, 0), [saidas]);
  const totalValor = useMemo(() => saidas.reduce((acc, s) => acc + s.valorTotal, 0), [saidas]);

  const ch = useMemo(() => createColumnHelper<SaidaCombustivel>(), []);

  const columns = useMemo<ColumnDef<SaidaCombustivel>[]>(() => [
    ch.accessor('data', {
      header: 'Data',
      cell: ({ row }) => (
        <span className="font-medium tabular-nums whitespace-nowrap">{fmtData(row.original.data)}</span>
      ),
      sortingFn: 'alphanumeric',
    }) as ColumnDef<SaidaCombustivel>,
    {
      id: 'consumidor',
      header: 'Consumidor',
      accessorFn: (s) => {
        if (s.tipoConsumidor === 'equipamento_proprio') {
          if (s.equipamentoId === 'desconhecido') return 'Sentinel';
          const eq = s.equipamentoId ? equipMap.get(s.equipamentoId) : null;
          return eq?.codigo ? `${eq.codigo} — ${eq.nome}` : (eq?.nome ?? '?');
        }
        const transpNome = s.transportadoraId ? (transpMap.get(s.transportadoraId) ?? '?') : '?';
        return s.placa ? `${transpNome} · ${s.placa}` : transpNome;
      },
      cell: ({ row }) => {
        const s = row.original;
        if (s.tipoConsumidor === 'equipamento_proprio') {
          if (s.equipamentoId === 'desconhecido') {
            return (
              <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="text-xs">Sentinel (legado)</span>
              </span>
            );
          }
          const eq = s.equipamentoId ? equipMap.get(s.equipamentoId) : null;
          return (
            <span className="inline-flex items-center gap-1.5 text-[var(--color-fg)]">
              <Settings2 className="w-3.5 h-3.5 shrink-0 text-[var(--color-fg-muted)]" />
              <span>{eq?.codigo ? `${eq.codigo} — ${eq.nome}` : (eq?.nome ?? '?')}</span>
            </span>
          );
        }
        const transpNome = s.transportadoraId ? (transpMap.get(s.transportadoraId) ?? '?') : '?';
        return (
          <span className="inline-flex items-center gap-1.5 text-[var(--color-fg)]">
            <Truck className="w-3.5 h-3.5 shrink-0 text-[var(--color-fg-muted)]" />
            <span>
              {transpNome}
              {s.placa && (
                <span className="text-[var(--color-fg-muted)]"> · {s.placa}</span>
              )}
            </span>
          </span>
        );
      },
    },
    {
      id: 'origem',
      header: 'Origem',
      accessorFn: (s) => ORIGEM_LABEL[s.origem],
      cell: (info) => (
        <span className="text-[var(--color-fg-muted)] text-xs">{String(info.getValue())}</span>
      ),
    },
    {
      id: 'tanque',
      header: 'Tanque',
      accessorFn: (s) => s.tanqueId ? (tanquesMap.get(s.tanqueId) ?? '—') : '—',
      cell: (info) => (
        <span className="text-[var(--color-fg-muted)] text-xs">{String(info.getValue())}</span>
      ),
    },
    {
      id: 'obra',
      header: 'Obra',
      accessorFn: (s) => s.obraId ? (obrasMap.get(s.obraId) ?? '—') : '—',
      cell: (info) => (
        <span className="truncate max-w-[140px] block text-[var(--color-fg-muted)] text-xs">{String(info.getValue())}</span>
      ),
    },
    {
      id: 'combustivel',
      header: 'Combustível',
      accessorFn: (s) => combustMap.get(s.tipoCombustivel) ?? s.tipoCombustivel,
      cell: (info) => (
        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)]">
          {String(info.getValue())}
        </span>
      ),
    },
    ch.accessor('litros', {
      header: 'Litros',
      cell: (info) => (
        <span className="tabular-nums text-right block">{(info.getValue() ?? 0).toLocaleString('pt-BR')} L</span>
      ),
    }) as ColumnDef<SaidaCombustivel>,
    ch.accessor('valorTotal', {
      header: 'Valor',
      cell: (info) => (
        <span className="tabular-nums font-semibold text-right block">{fmtBRL(info.getValue() ?? 0)}</span>
      ),
    }) as ColumnDef<SaidaCombustivel>,
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
              {canEdit && onEdit && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(row.original); }}>
                  <Pencil className="w-3.5 h-3.5 mr-2" />
                  Editar
                </DropdownMenuItem>
              )}
              {canDelete && onDelete && (
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
  ], [ch, obrasMap, tanquesMap, equipMap, transpMap, combustMap, canEdit, canDelete, onEdit, onDelete]);

  const [sorting, setSorting] = useState<SortingState>([{ id: 'data', desc: true }]);
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
    const totalPages = Math.max(1, Math.ceil(saidas.length / pageSize));
    if (pageIndex >= totalPages) setPageIndex(0);
  }, [saidas.length, pageSize, pageIndex]);

  const table = useReactTable({
    data: saidas,
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

  if (saidas.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] p-8 text-center">
        <p className="text-[var(--color-fg-muted)] text-sm">Nenhuma saída para os filtros atuais.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-hidden">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/50 text-xs text-[var(--color-fg-muted)]">
        <span><span className="font-semibold text-[var(--color-fg)]">{saidas.length}</span> saída{saidas.length !== 1 ? 's' : ''}</span>
        <span>·</span>
        <span><span className="font-semibold text-[var(--color-fg)]">{totalLitros.toLocaleString('pt-BR')}</span> L</span>
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
                  data-saida-id={row.original.id}
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
