import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUrlState } from '../hooks/useUrlState';
import type { Obra } from '../types';
import { useObras } from '../hooks/useObras';
import { useEtapas } from '../hooks/useEtapas';
import { supabase } from '../lib/supabase';
import { formatCurrency, formatDate } from '../utils/formatters';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { exportarOrcamentoPDF, exportarOrcamentoExcel } from '../utils/obrasExport';

const STATUS_LABELS: Record<Obra['status'], string> = {
  planejamento: 'Planejamento',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  pausada: 'Pausada',
};

const STATUS_COLORS: Record<Obra['status'], string> = {
  planejamento: 'bg-emt-verde-claro text-emt-verde-escuro',
  em_andamento: 'bg-yellow-100 text-yellow-800',
  concluida: 'bg-green-100 text-green-800',
  pausada: 'bg-gray-100 text-gray-800',
};

type ContractItemRow = {
  id: string;
  obra_id: string;
  code: string | null;
  name: string;
  unit: string | null;
  contracted_qty: number | null;
  unit_price: number | null;
  type: string | null;
};

type ContractItemUI = {
  id: string;
  obraId: string;
  code: string;
  name: string;
  unit: string;
  contractedQty: number;
  unitPrice: number;
  type: 'etapa' | 'subetapa' | 'item';
};

function useAllContractItems() {
  return useQuery({
    queryKey: ['rodotracker_contract_items', '__all_for_obras_page'],
    queryFn: async (): Promise<ContractItemUI[]> => {
      const { data, error } = await supabase
        .from('rodotracker_contract_items')
        .select('id, obra_id, code, name, unit, contracted_qty, unit_price, type');
      if (error) throw error;
      return ((data ?? []) as ContractItemRow[]).map((r) => ({
        id: r.id,
        obraId: r.obra_id,
        code: r.code ?? '',
        name: r.name,
        unit: r.unit ?? '',
        contractedQty: Number(r.contracted_qty) || 0,
        unitPrice: Number(r.unit_price) || 0,
        type: ((r.type ?? 'item') as ContractItemUI['type']),
      }));
    },
    staleTime: 30_000,
  });
}

const TYPE_BADGE: Record<ContractItemUI['type'], string> = {
  etapa: 'bg-emt-verde-claro text-emt-verde-escuro',
  subetapa: 'bg-blue-100 text-blue-800',
  item: 'bg-gray-100 text-gray-700',
};

const TYPE_LABEL: Record<ContractItemUI['type'], string> = {
  etapa: 'Etapa',
  subetapa: 'Subetapa',
  item: 'Item',
};

export default function ObrasPage() {
  const { data: obras = [], isLoading: loadingObras } = useObras();
  const { data: legacyEtapas = [], isLoading: loadingEtapas } = useEtapas();
  const { data: contractItems = [], isLoading: loadingItems } = useAllContractItems();

  const isLoading = loadingObras || loadingEtapas || loadingItems;

  // Total contratado por obra (a partir dos contract_items, só linhas tipo "item").
  const totalPorObra = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of contractItems) {
      if (it.type !== 'item') continue;
      map.set(it.obraId, (map.get(it.obraId) ?? 0) + it.contractedQty * it.unitPrice);
    }
    return map;
  }, [contractItems]);

  // Search & filter
  const [busca, setBusca] = useUrlState('busca');
  const [filtroStatus, setFiltroStatus] = useUrlState('status');

  const obrasFiltradas = useMemo(() => {
    let resultado = obras;
    if (busca) {
      const termo = busca.toLowerCase();
      resultado = resultado.filter(
        (o) =>
          o.nome.toLowerCase().includes(termo) ||
          o.endereco.toLowerCase().includes(termo) ||
          o.responsavel.toLowerCase().includes(termo)
      );
    }
    if (filtroStatus) {
      resultado = resultado.filter((o) => o.status === filtroStatus);
    }
    return resultado;
  }, [obras, busca, filtroStatus]);

  // Expand state
  const [expandedRaw, setExpandedRaw] = useUrlState('expanded');
  const expandedId = expandedRaw || null;
  const setExpandedId = (id: string | null) => setExpandedRaw(id ?? '');
  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[var(--color-fg-subtle)] text-sm">Carregando obras...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight text-[var(--color-fg)]">Obras</h1>
          <p className="text-xs text-[var(--color-fg-muted)] mt-1">
            Visualização consolidada (somente leitura). Para cadastrar/editar obras, use Cadastros → Obras.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="secondary"
            className="text-sm"
            onClick={() => exportarOrcamentoPDF(obrasFiltradas, legacyEtapas)}
          >
            Exportar PDF
          </Button>
          <Button
            variant="secondary"
            className="text-sm"
            onClick={() => exportarOrcamentoExcel(obrasFiltradas, legacyEtapas)}
          >
            Exportar Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="md:col-span-2">
          <Input
            id="buscaObra"
            label=""
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, endereço ou responsável..."
          />
        </div>
        <Select
          id="filtroStatus"
          label=""
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          options={[
            { value: 'planejamento', label: 'Planejamento' },
            { value: 'em_andamento', label: 'Em Andamento' },
            { value: 'concluida', label: 'Concluída' },
            { value: 'pausada', label: 'Pausada' },
          ]}
          placeholder="Todos os status"
        />
      </div>

      {obrasFiltradas.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <p className="text-gray-500">
              {obras.length === 0
                ? 'Nenhuma obra cadastrada ainda. Cadastre em Cadastros → Obras.'
                : 'Nenhuma obra encontrada com os filtros aplicados.'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {obrasFiltradas.map((obra) => {
            const itensObra = contractItems.filter((c) => c.obraId === obra.id);
            const etapasLegacy = legacyEtapas.filter((e) => e.obraId === obra.id);
            const totalLista = itensObra.length + etapasLegacy.length;
            const totalContrato = totalPorObra.get(obra.id);
            const valorExibido =
              totalContrato !== undefined && totalContrato > 0 ? totalContrato : obra.orcamento;
            const isExpanded = expandedId === obra.id;

            return (
              <Card key={obra.id} className="p-0 overflow-hidden">
                <div
                  className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleExpand(obra.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-lg font-semibold text-gray-800">
                          {obra.nome}
                        </h2>
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[obra.status]}`}
                        >
                          {STATUS_LABELS[obra.status]}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">{obra.endereco}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right mr-2">
                        <p className="text-lg font-bold text-emt-verde-escuro">
                          {formatCurrency(valorExibido)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {totalLista} {totalLista === 1 ? 'item' : 'itens'}
                        </p>
                      </div>
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500">Responsável</p>
                        <p className="text-sm font-medium text-gray-700">
                          {obra.responsavel || '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Início</p>
                        <p className="text-sm font-medium text-gray-700">
                          {formatDate(obra.dataInicio)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Previsão de término</p>
                        <p className="text-sm font-medium text-gray-700">
                          {formatDate(obra.dataPrevisaoFim)}
                        </p>
                      </div>
                    </div>

                    {itensObra.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-2">
                          Itens do contrato (Medição) — {itensObra.length}
                        </p>
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <table className="w-full text-xs">
                            <thead className="bg-emt-verde text-white">
                              <tr>
                                <th className="text-left px-3 py-1.5 font-medium uppercase text-xs">Tipo</th>
                                <th className="text-left px-3 py-1.5 font-medium uppercase text-xs">Código</th>
                                <th className="text-left px-3 py-1.5 font-medium uppercase text-xs">Nome</th>
                                <th className="text-left px-3 py-1.5 font-medium uppercase text-xs">Un.</th>
                                <th className="text-right px-3 py-1.5 font-medium uppercase text-xs">Qtd</th>
                                <th className="text-right px-3 py-1.5 font-medium uppercase text-xs">Valor unit.</th>
                                <th className="text-right px-3 py-1.5 font-medium uppercase text-xs">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                              {itensObra.map((it) => (
                                <tr key={it.id}>
                                  <td className="px-3 py-1.5">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${TYPE_BADGE[it.type]}`}>
                                      {TYPE_LABEL[it.type]}
                                    </span>
                                  </td>
                                  <td className="px-3 py-1.5 text-gray-500 font-mono">{it.code || '-'}</td>
                                  <td className="px-3 py-1.5 text-gray-700 font-medium">{it.name}</td>
                                  <td className="px-3 py-1.5 text-gray-600">{it.unit || '-'}</td>
                                  <td className="px-3 py-1.5 text-right text-gray-600 tabular-nums">
                                    {it.type === 'item' ? it.contractedQty.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '-'}
                                  </td>
                                  <td className="px-3 py-1.5 text-right text-gray-600 tabular-nums">
                                    {it.type === 'item' ? formatCurrency(it.unitPrice) : '-'}
                                  </td>
                                  <td className="px-3 py-1.5 text-right font-semibold text-gray-700 tabular-nums">
                                    {it.type === 'item' ? formatCurrency(it.contractedQty * it.unitPrice) : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {etapasLegacy.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-2">
                          Etapas (Cadastros legado) — {etapasLegacy.length}
                        </p>
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <table className="w-full text-xs">
                            <thead className="bg-emt-verde text-white">
                              <tr>
                                <th className="text-left px-3 py-1.5 font-medium uppercase text-xs">#</th>
                                <th className="text-left px-3 py-1.5 font-medium uppercase text-xs">Etapa</th>
                                <th className="text-left px-3 py-1.5 font-medium uppercase text-xs">Unidade</th>
                                <th className="text-right px-3 py-1.5 font-medium uppercase text-xs">Qtd</th>
                                <th className="text-right px-3 py-1.5 font-medium uppercase text-xs">Valor unit.</th>
                                <th className="text-right px-3 py-1.5 font-medium uppercase text-xs">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                              {etapasLegacy.map((etapa, i) => (
                                <tr key={etapa.id}>
                                  <td className="px-3 py-1.5 text-gray-400 font-mono">{i + 1}.</td>
                                  <td className="px-3 py-1.5 text-gray-700 font-medium">{etapa.nome}</td>
                                  <td className="px-3 py-1.5 text-gray-600">{etapa.unidade || '-'}</td>
                                  <td className="px-3 py-1.5 text-right text-gray-600 tabular-nums">{etapa.quantidade ?? '-'}</td>
                                  <td className="px-3 py-1.5 text-right text-gray-600 tabular-nums">{etapa.valorUnitario != null ? formatCurrency(etapa.valorUnitario) : '-'}</td>
                                  <td className="px-3 py-1.5 text-right font-semibold text-gray-700 tabular-nums">{etapa.quantidade != null && etapa.valorUnitario != null ? formatCurrency(etapa.quantidade * etapa.valorUnitario) : '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {itensObra.length === 0 && etapasLegacy.length === 0 && (
                      <p className="text-xs text-gray-500 italic">
                        Esta obra ainda não tem etapas, subetapas ou itens. Cadastre em Cadastros → Etapas de obra ou no contrato da Medição.
                      </p>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

