import { useState, useMemo, useCallback } from 'react';
import type { Frete, Obra, Insumo } from '../../types';
import Button from '../ui/Button';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

// ── Ordenação por coluna ────────────────────────────────────────────
// Implementada client-side (a lista já vem inteira no client). Cada SortKey
// mapeia para um getter (string ou number). Ao clicar no header alterna:
//   none → asc → desc → none. Quando não há sort ativo cai no default
//   (data de saída desc) que o app sempre teve.
type SortKey =
  | 'data' | 'dataChegada' | 'origemDestino' | 'transportadora'
  | 'motorista' | 'placaCarreta' | 'material' | 'pesoToneladas'
  | 'kmRodados' | 'valorTkm' | 'valorTotal' | 'valorMaterial'
  | 'notaFiscal' | 'notaFiscal2';
type SortDir = 'asc' | 'desc';

function SortHeader({
  label, sortKey, currentKey, currentDir, onSort, align = 'left',
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey | null;
  currentDir: SortDir;
  onSort: (k: SortKey) => void;
  align?: 'left' | 'right' | 'center';
}) {
  const active = currentKey === sortKey;
  const Icon = !active ? ArrowUpDown : currentDir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      className={`px-4 py-3 text-white font-medium uppercase text-xs cursor-pointer select-none hover:bg-black/10 transition-colors text-${align}`}
      onClick={() => onSort(sortKey)}
      title={active ? `Ordenar (${currentDir === 'asc' ? 'asc' : 'desc'})` : 'Clique para ordenar'}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'flex-row-reverse' : align === 'center' ? 'justify-center' : ''}`}>
        {label}
        <Icon className={`h-3 w-3 ${active ? 'opacity-100' : 'opacity-50'}`} />
      </span>
    </th>
  );
}

function DataChegadaCell({ frete, onUpdate }: { frete: Frete; onUpdate: (frete: Frete, val: string) => void }) {
  const [editando, setEditando] = useState(false);

  const handleChange = useCallback((val: string) => {
    onUpdate(frete, val);
    if (!val) setEditando(false);
  }, [frete, onUpdate]);

  if (frete.dataChegada) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="date"
          className="border border-gray-200 rounded px-2 py-1 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emt-verde w-[130px]"
          value={frete.dataChegada}
          onChange={(e) => handleChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => handleChange('')}
          className="text-red-400 hover:text-red-600 text-lg leading-none px-1"
          title="Limpar data de chegada"
        >
          &times;
        </button>
      </div>
    );
  }

  if (editando) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="date"
          className="border border-gray-200 rounded px-2 py-1 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emt-verde w-[130px]"
          value=""
          onChange={(e) => handleChange(e.target.value)}
          autoFocus
          onBlur={() => setEditando(false)}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditando(true)}
      className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 border border-dashed border-blue-300 rounded hover:bg-blue-50"
    >
      Definir
    </button>
  );
}

interface FreteListProps {
  fretes: Frete[];
  obras: Obra[];
  insumos: Insumo[];
  filtros: { obraId: string; transportadora: string; motorista: string; insumoId: string; origem: string; destino: string; dataInicio: string; dataFim: string; notaFiscal: string };
  onEdit: (frete: Frete) => void;
  onDelete: (id: string) => void;
  onUpdateDataChegada?: (frete: Frete, dataChegada: string) => void;
  /** FF.6 — click numa row (fora dos botões) abre drawer detalhes. */
  onSelect?: (f: Frete) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export default function FreteList({
  fretes,
  obras: _obras,
  insumos,
  filtros,
  onEdit,
  onDelete,
  onUpdateDataChegada,
  onSelect,
  canEdit = true,
  canDelete = true,
}: FreteListProps) {
  const [pagina, setPagina] = useState(0);
  // 500/página por padrão (smoke test recomendou). Em telas pequenas a primeira
  // página ainda carrega rápido; rolar para baixo continua na mesma página.
  const porPagina = 500;

  // Sort state: null = default (data desc).
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = useCallback((k: SortKey) => {
    if (sortKey !== k) {
      setSortKey(k);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      // 3º clique volta pro default.
      setSortKey(null);
      setSortDir('asc');
    }
  }, [sortKey, sortDir]);

  const insumosMap = useMemo(() => new Map(insumos.map((i) => [i.id, i.nome])), [insumos]);

  const filtrados = useMemo(() => {
    const base = fretes.filter((f) => {
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
      return true;
    });

    // Default sort: data de saída desc.
    if (!sortKey) {
      return [...base].sort((a, b) => b.data.localeCompare(a.data));
    }

    // Sort customizado por coluna. getVal devolve o valor a comparar.
    const getVal = (f: Frete): string | number => {
      switch (sortKey) {
        case 'data': return f.data || '';
        case 'dataChegada': return f.dataChegada || '';
        case 'origemDestino': return `${f.origem ?? ''} → ${f.destino ?? ''}`;
        case 'transportadora': return f.transportadora || '';
        case 'motorista': return f.motorista || '';
        case 'placaCarreta': return f.placaCarreta || '';
        case 'material': return insumosMap.get(f.insumoId) || '';
        case 'pesoToneladas': return f.pesoToneladas ?? 0;
        case 'kmRodados': return f.kmRodados ?? 0;
        case 'valorTkm': return f.valorTkm ?? 0;
        case 'valorTotal': return f.valorTotal ?? 0;
        case 'valorMaterial': return f.valorMaterial ?? 0;
        case 'notaFiscal': return f.notaFiscal || '';
        case 'notaFiscal2': return f.notaFiscal2 || '';
        default: return '';
      }
    };

    return [...base].sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      let cmp: number;
      if (typeof va === 'number' && typeof vb === 'number') {
        cmp = va - vb;
      } else {
        cmp = String(va).localeCompare(String(vb), 'pt-BR', { numeric: true });
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [fretes, filtros, sortKey, sortDir, insumosMap]);

  // Reset page when filters/sort change — padrão "adjusting state in response
  // to change" do React 19 (https://react.dev/reference/react/useState#storing-information-from-previous-renders).
  // Comparamos uma chave estável; quando muda, resetamos a página DURANTE
  // o render (não em useEffect — evita 1 frame extra com a página antiga).
  const filtrosKey = JSON.stringify(filtros) + '|' + (sortKey ?? '') + '|' + sortDir;
  const [lastKey, setLastKey] = useState(filtrosKey);
  if (filtrosKey !== lastKey) {
    setLastKey(filtrosKey);
    setPagina(0);
  }

  // Clamp defensivo — se a página atual for além do total (ex: filtros
  // reduziram a lista), volta para 0.
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const paginaSegura = Math.min(pagina, totalPaginas - 1);
  const paginados = filtrados.slice(paginaSegura * porPagina, (paginaSegura + 1) * porPagina);

  const totalGeral = filtrados.reduce((sum, f) => sum + f.valorTotal, 0);
  const totalMaterial = filtrados.reduce((sum, f) => sum + (f.valorMaterial || 0), 0);

  if (filtrados.length === 0) {
    return (
      <div className="surface-raised p-8 text-center">
        <p className="text-[var(--color-fg-muted)]">Nenhum frete encontrado.</p>
      </div>
    );
  }

  return (
    <>
      <div className="surface-raised overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1550px]">
            <thead className="bg-[var(--color-accent)] text-[var(--color-fg-on-accent)]">
              <tr>
                <SortHeader label="Data de Saída"   sortKey="data"           currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Data de Chegada" sortKey="dataChegada"    currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Origem → Destino" sortKey="origemDestino" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Transportadora"  sortKey="transportadora" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Motorista"       sortKey="motorista"      currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Placa"           sortKey="placaCarreta"   currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Material"        sortKey="material"       currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="Peso (t)"        sortKey="pesoToneladas"  currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                <SortHeader label="KM"              sortKey="kmRodados"      currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                <SortHeader label="R$/TKM"          sortKey="valorTkm"       currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                <SortHeader label="Total"           sortKey="valorTotal"     currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                <SortHeader label="Preço Material"  sortKey="valorMaterial"  currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="right" />
                <SortHeader label="Nota Fiscal"     sortKey="notaFiscal"     currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortHeader label="NF 2"            sortKey="notaFiscal2"    currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <th className="text-center px-4 py-3 text-white font-medium uppercase text-xs">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] [&>tr:nth-child(even)]:bg-[var(--color-surface-2)]">
              {paginados.map((frete) => {
                const rowClickable = !!onSelect;
                return (
                <tr
                  key={frete.id}
                  className={`hover:bg-[var(--color-accent-soft)] transition-colors ${rowClickable ? 'cursor-pointer' : ''}`}
                  onClick={rowClickable ? (ev) => {
                    // Ignora cliques no input editável da DataChegada para não roubar foco/abrir drawer.
                    const target = ev.target as HTMLElement;
                    if (target.closest('input,button,a,select,textarea')) return;
                    onSelect!(frete);
                  } : undefined}
                >
                  <td className="px-4 py-3 text-gray-800 whitespace-nowrap">
                    {frete.data ? new Date(frete.data + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                  </td>
                  <td className="px-4 py-1 whitespace-nowrap">
                    {onUpdateDataChegada ? (
                      <DataChegadaCell frete={frete} onUpdate={onUpdateDataChegada} />
                    ) : (
                      <span className="text-gray-800">
                        {frete.dataChegada ? new Date(frete.dataChegada + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-800">
                    {frete.origem} → {frete.destino}
                  </td>
                  <td className="px-4 py-3 text-gray-800">{frete.transportadora}</td>
                  <td className="px-4 py-3 text-gray-800">{frete.motorista || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono">{frete.placaCarreta || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{insumosMap.get(frete.insumoId) || '-'}</td>
                  <td className="px-4 py-3 text-right text-gray-800">{frete.pesoToneladas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right text-gray-800">{frete.kmRodados.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}</td>
                  <td className="px-4 py-3 text-right text-gray-800">{frete.valorTkm.toLocaleString('pt-BR', { minimumFractionDigits: 4 })}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emt-verde whitespace-nowrap">
                    {frete.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-800 whitespace-nowrap">
                    {frete.valorMaterial ? frete.valorMaterial.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{frete.notaFiscal || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{frete.notaFiscal2 || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      {canEdit && (
                        <Button variant="ghost" className="text-xs px-2 py-1" onClick={() => onEdit(frete)}>
                          Editar
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          className="text-xs px-2 py-1 text-red-600 hover:bg-red-50"
                          onClick={() => onDelete(frete.id)}
                        >
                          Excluir
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td colSpan={10} className="px-4 py-3 text-right text-gray-700">
                  Total ({filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}):
                </td>
                <td className="px-4 py-3 text-right text-emt-verde whitespace-nowrap">
                  {totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="px-4 py-3 text-right text-emt-verde whitespace-nowrap">
                  {totalMaterial.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-500">
            {filtrados.length} frete{filtrados.length !== 1 ? 's' : ''} encontrado{filtrados.length !== 1 ? 's' : ''}
            {' '}· {porPagina} por página
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="text-xs"
              disabled={paginaSegura === 0}
              onClick={() => setPagina((p) => Math.max(0, p - 1))}
            >
              Anterior
            </Button>
            <span className="text-sm text-gray-600 flex items-center px-2">
              {paginaSegura + 1} / {totalPaginas}
            </span>
            <Button
              variant="secondary"
              className="text-xs"
              disabled={paginaSegura >= totalPaginas - 1}
              onClick={() => setPagina((p) => p + 1)}
            >
              Próximo
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
