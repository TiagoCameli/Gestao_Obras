import { useCallback, useMemo } from 'react';
import {
  createColumnHelper, type ColumnDef,
} from '@tanstack/react-table';
import {
  ChevronRight, ChevronDown, MoreVertical, Pencil, Trash2, Truck,
} from 'lucide-react';
import type { Frete, Obra, Insumo } from '../../types';
import { useAtualizarFrete } from '../../hooks/useFretes';
import { useToast } from '../ui/Toast';
import DataTable from '../ui/DataTable';
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
function fmtData(iso: string): string {
  if (!iso) return '—';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return iso;
}

const PAGE_SIZE_KEY = 'frete-list-page-size-v2';

export default function FreteListV2({
  fretes, obras: _obras, insumos, filtros, filtroSemChegada = false,
  onEdit, onDelete, onSelect, canEdit = true, canDelete = true,
}: Props) {
  const insumosMap = useMemo(() => new Map(insumos.map((i) => [i.id, i.nome])), [insumos]);
  const atualizarMutation = useAtualizarFrete();
  const { showToast } = useToast();

  const handleDataChegadaChange = useCallback((frete: Frete, novaData: string) => {
    atualizarMutation.mutate(
      { ...frete, dataChegada: novaData },
      {
        onSuccess: () => showToast({ kind: 'success', message: 'Data de chegada atualizada.' }),
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          showToast({ kind: 'error', message: `Falha ao salvar: ${msg}` });
        },
      },
    );
  }, [atualizarMutation, showToast]);

  // Filtros client-side
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
      enableSorting: false,
      enableHiding: false,
      size: 32,
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
    },
    ch.accessor('data', {
      header: 'Saída',
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">{fmtData(row.original.data)}</span>
      ),
      sortingFn: 'alphanumeric',
    }) as ColumnDef<Frete>,
    {
      id: 'dataChegada',
      header: 'Chegada',
      accessorFn: (f) => f.dataChegada || '',
      sortingFn: 'alphanumeric',
      cell: ({ row }) => {
        const f = row.original;
        if (!canEdit) {
          return f.dataChegada
            ? <span className="font-medium tabular-nums">{fmtData(f.dataChegada)}</span>
            : <span className="text-3xs text-[var(--color-fg-subtle)] italic">sem chegada</span>;
        }
        return (
          <input
            type="date"
            value={f.dataChegada || ''}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => handleDataChegadaChange(f, e.target.value)}
            className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded px-2 py-1 text-xs text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)] tabular-nums"
            title="Editar data de chegada"
          />
        );
      },
    },
    {
      id: 'origemDestino',
      header: 'Origem → Destino',
      accessorFn: (f) => `${f.origem ?? ''} → ${f.destino ?? ''}`,
      cell: ({ row }) => (
        <div className="flex flex-col leading-tight">
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
              <span className="text-3xs text-[var(--color-fg-subtle)] uppercase tracking-wide tabular-nums font-mono">{placa}</span>
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
      header: 'Valor Frete',
      cell: (info) => <span className="tabular-nums font-semibold">{fmtBRL(info.getValue() ?? 0)}</span>,
    }) as ColumnDef<Frete>,
    ch.accessor('valorMaterial', {
      header: 'Valor Material',
      cell: (info) => <span className="tabular-nums">{fmtBRL(info.getValue() ?? 0)}</span>,
    }) as ColumnDef<Frete>,
    {
      id: 'precoUnitMaterial',
      header: 'Preço Unit.',
      accessorFn: (f) => (f.pesoToneladas > 0 ? (f.valorMaterial ?? 0) / f.pesoToneladas : 0),
      cell: (info) => {
        const v = Number(info.getValue() ?? 0);
        return <span className="tabular-nums">{v > 0 ? `${fmtBRL(v)}/t` : '—'}</span>;
      },
    } as ColumnDef<Frete>,
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      enableHiding: false,
      size: 32,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="p-1 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              title="Ações"
              aria-label={`Ações do frete ${row.original.id}`}
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
    },
  ], [ch, insumosMap, canEdit, canDelete, onEdit, onDelete, handleDataChegadaChange]);

  // Totais (footer) — calcula sobre TODAS as linhas filtradas, não só a página
  const totals = useMemo(() => {
    return filtrados.reduce(
      (acc, f) => {
        acc.peso += f.pesoToneladas ?? 0;
        acc.valor += f.valorTotal ?? 0;
        acc.valorMaterial += f.valorMaterial ?? 0;
        return acc;
      },
      { peso: 0, valor: 0, valorMaterial: 0 },
    );
  }, [filtrados]);

  return (
    <DataTable<Frete>
      columns={columns}
      data={filtrados}
      defaultSorting={[{ id: 'data', desc: true }]}
      getRowId={(row) => row.id}
      persistPageSizeKey={PAGE_SIZE_KEY}
      onRowClick={onSelect}
      enableExpanding
      renderExpanded={(frete) => (
        <FreteRowExpanded frete={frete} insumos={insumos} canEdit={!!canEdit} />
      )}
      enableDensityToggle
      enableColumnVisibilityToggle
      itemLabel={{ singular: 'frete', plural: 'fretes' }}
      empty={{
        icon: Truck,
        title: 'Nenhum frete encontrado',
        description: 'Ajuste os filtros acima ou registre um novo frete.',
      }}
      renderFooter={() => {
        const precoMedio = totals.peso > 0 ? totals.valorMaterial / totals.peso : 0;
        return (
          <tr>
            <td colSpan={6} className="px-3 py-2 text-2xs label-eyebrow">Totais</td>
            <td className="px-3 py-2 text-sm tabular-nums font-semibold">
              {totals.peso.toLocaleString('pt-BR')} t
            </td>
            <td className="px-3 py-2 text-sm tabular-nums font-semibold text-[var(--color-fg)]">
              {fmtBRL(totals.valor)}
            </td>
            <td className="px-3 py-2 text-sm tabular-nums font-semibold text-[var(--color-fg)]">
              {fmtBRL(totals.valorMaterial)}
            </td>
            <td className="px-3 py-2 text-sm tabular-nums font-semibold text-[var(--color-fg)]">
              {precoMedio > 0 ? `${fmtBRL(precoMedio)}/t` : '—'}
            </td>
            <td />
          </tr>
        );
      }}
    />
  );
}
