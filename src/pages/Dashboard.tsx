import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const CORES_BARRAS = [
  '#1e40af', '#7c3aed', '#059669', '#d97706', '#dc2626',
  '#0891b2', '#be185d', '#4f46e5', '#ca8a04', '#16a34a',
  '#9333ea', '#e11d48', '#0d9488', '#ea580c', '#2563eb',
];
import { formatCurrency } from '../utils/formatters';
import type { Abastecimento, SaidaMaterial } from '../types';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { useObras } from '../hooks/useObras';
import { useAbastecimentos } from '../hooks/useAbastecimentos';
import { useSaidasMaterial } from '../hooks/useSaidasMaterial';
import { useInsumos } from '../hooks/useInsumos';
import { useEtapas } from '../hooks/useEtapas';

function getEtapaIds(a: Abastecimento): string[] {
  if (a.alocacoes && a.alocacoes.length > 0) return a.alocacoes.map((al) => al.etapaId);
  if (a.etapaId) return [a.etapaId];
  return [];
}

function valorProporcionalAbastecimento(a: Abastecimento, etapaIds: Set<string>): number {
  const alocs = a.alocacoes && a.alocacoes.length > 0
    ? a.alocacoes
    : a.etapaId ? [{ etapaId: a.etapaId, percentual: 100 }] : [];
  const totalPct = alocs
    .filter((al) => etapaIds.has(al.etapaId))
    .reduce((sum, al) => sum + al.percentual, 0);
  return a.valorTotal * (totalPct / 100);
}

function valorProporcionalSaida(s: SaidaMaterial, etapaIds: Set<string>): number {
  const totalPct = s.alocacoes
    .filter((al) => etapaIds.has(al.etapaId))
    .reduce((sum, al) => sum + al.percentual, 0);
  return s.valorTotal * (totalPct / 100);
}

export default function Dashboard() {
  const { temAcao } = useAuth();
  const canFilter = temAcao('filtros_dashboard');
  const { data: obras = [], isLoading: loadingObras } = useObras();
  const { data: etapas = [] } = useEtapas();
  const { data: abastecimentos = [] } = useAbastecimentos();
  const { data: saidasMaterial = [] } = useSaidasMaterial();
  const { data: insumos = [] } = useInsumos();

  // ALL hooks must be called before any early return
  const [filtroObraId, setFiltroObraId] = useState('');
  const [filtroEtapaIds, setFiltroEtapaIds] = useState<string[]>([]);
  const [etapasDropdownOpen, setEtapasDropdownOpen] = useState(false);

  const etapaIdsSet = useMemo(() => new Set(filtroEtapaIds), [filtroEtapaIds]);
  const etapasDaObra = useMemo(
    () => (filtroObraId ? etapas.filter((e) => e.obraId === filtroObraId) : []),
    [etapas, filtroObraId]
  );

  const insumosMap = useMemo(() => new Map(insumos.map((i) => [i.id, i.nome])), [insumos]);
  const etapasMap = useMemo(() => new Map(etapas.map((e) => [e.id, e.nome])), [etapas]);

  const abastFiltrados = useMemo(() => {
    let dados = abastecimentos;
    if (filtroObraId) dados = dados.filter((a) => a.obraId === filtroObraId);
    if (filtroEtapaIds.length > 0) {
      dados = dados.filter((a) => getEtapaIds(a).some((id) => etapaIdsSet.has(id)));
    }
    return dados;
  }, [abastecimentos, filtroObraId, filtroEtapaIds, etapaIdsSet]);

  const saidasFiltradas = useMemo(() => {
    let dados = saidasMaterial;
    if (filtroObraId) dados = dados.filter((s) => s.obraId === filtroObraId);
    if (filtroEtapaIds.length > 0) {
      dados = dados.filter((s) => s.alocacoes.some((al) => etapaIdsSet.has(al.etapaId)));
    }
    return dados;
  }, [saidasMaterial, filtroObraId, filtroEtapaIds, etapaIdsSet]);

  const totalCombustivel = useMemo(() => {
    if (filtroEtapaIds.length > 0) {
      return abastFiltrados.reduce((sum, a) => sum + valorProporcionalAbastecimento(a, etapaIdsSet), 0);
    }
    return abastFiltrados.reduce((sum, a) => sum + a.valorTotal, 0);
  }, [abastFiltrados, filtroEtapaIds, etapaIdsSet]);

  const totalInsumos = useMemo(() => {
    if (filtroEtapaIds.length > 0) {
      return saidasFiltradas.reduce((sum, s) => sum + valorProporcionalSaida(s, etapaIdsSet), 0);
    }
    return saidasFiltradas.reduce((sum, s) => sum + s.valorTotal, 0);
  }, [saidasFiltradas, filtroEtapaIds, etapaIdsSet]);

  const gastoTotal = totalCombustivel + totalInsumos;

  const chartData = useMemo(() => {
    const gastoMap = new Map<string, number>();
    const usaProporcional = filtroEtapaIds.length > 0;

    for (const a of abastFiltrados) {
      const nome = insumosMap.get(a.tipoCombustivel) || a.tipoCombustivel || 'Combustivel';
      const valor = usaProporcional ? valorProporcionalAbastecimento(a, etapaIdsSet) : a.valorTotal;
      gastoMap.set(nome, (gastoMap.get(nome) || 0) + valor);
    }

    for (const s of saidasFiltradas) {
      const nome = insumosMap.get(s.insumoId) || 'Material';
      const valor = usaProporcional ? valorProporcionalSaida(s, etapaIdsSet) : s.valorTotal;
      gastoMap.set(nome, (gastoMap.get(nome) || 0) + valor);
    }

    return Array.from(gastoMap.entries())
      .map(([nome, valor]) => ({ nome, valor: parseFloat(valor.toFixed(2)) }))
      .filter((d) => d.valor > 0)
      .sort((a, b) => b.valor - a.valor);
  }, [abastFiltrados, saidasFiltradas, insumosMap, filtroEtapaIds, etapaIdsSet]);

  // Safe to do early return now — all hooks have been called
  if (loadingObras) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  const emAndamento = obras.filter((o) => o.status === 'em_andamento').length;
  const concluidas = obras.filter((o) => o.status === 'concluida').length;
  const temFiltro = filtroObraId !== '' || filtroEtapaIds.length > 0;

  function toggleEtapa(id: string) {
    setFiltroEtapaIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function limparFiltros() {
    setFiltroObraId('');
    setFiltroEtapaIds([]);
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Dashboard</h1>

      {/* Filtros */}
      {canFilter && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Filtros</h3>
            {temFiltro && (
              <Button variant="ghost" onClick={limparFiltros} className="text-xs">
                Limpar filtros
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Obra"
              id="filtro-obra-dash"
              value={filtroObraId}
              onChange={(e) => {
                setFiltroObraId(e.target.value);
                setFiltroEtapaIds([]);
                setEtapasDropdownOpen(false);
              }}
              options={obras.map((o) => ({ value: o.id, label: o.nome }))}
              placeholder="Todas"
            />
            {filtroObraId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Etapas
                </label>
                <div className="relative">
                  <button
                    type="button"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-left bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                    onClick={() => setEtapasDropdownOpen(!etapasDropdownOpen)}
                  >
                    <span className={filtroEtapaIds.length === 0 ? 'text-gray-500' : 'text-gray-800'}>
                      {filtroEtapaIds.length === 0
                        ? 'Todas'
                        : `${filtroEtapaIds.length} etapa${filtroEtapaIds.length > 1 ? 's' : ''} selecionada${filtroEtapaIds.length > 1 ? 's' : ''}`}
                    </span>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${etapasDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {etapasDropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {etapasDaObra.map((e) => (
                        <label
                          key={e.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={filtroEtapaIds.includes(e.id)}
                            onChange={() => toggleEtapa(e.id)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{e.nome}</span>
                        </label>
                      ))}
                      {etapasDaObra.length === 0 && (
                        <p className="px-3 py-2 text-sm text-gray-400">Nenhuma etapa nesta obra</p>
                      )}
                    </div>
                  )}
                </div>
                {filtroEtapaIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {filtroEtapaIds.map((id) => (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full"
                      >
                        {etapasMap.get(id) || id}
                        <button
                          type="button"
                          onClick={() => toggleEtapa(id)}
                          className="hover:text-blue-600"
                        >
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-medium text-gray-500">Total de Obras</h2>
          <p className="text-3xl font-bold text-blue-800 mt-2">{obras.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-medium text-gray-500">Em Andamento</h2>
          <p className="text-3xl font-bold text-yellow-600 mt-2">{emAndamento}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-medium text-gray-500">Concluidas</h2>
          <p className="text-3xl font-bold text-green-600 mt-2">{concluidas}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-medium text-gray-500">
            Gasto Total
          </h2>
          <p className="text-3xl font-bold text-orange-600 mt-2">
            {formatCurrency(gastoTotal)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Combustivel + Insumos
          </p>
        </div>
      </div>

      {/* Grafico de gastos por tipo */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Gastos por Tipo de Insumo e Combustivel (R$)
          </h3>
          <div style={{ height: Math.max(200, chartData.length * 40 + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" fontSize={12} />
                <YAxis
                  dataKey="nome"
                  type="category"
                  fontSize={12}
                  width={140}
                  tick={{ fill: '#374151' }}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  labelStyle={{ fontWeight: 'bold' }}
                />
                <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={CORES_BARRAS[i % CORES_BARRAS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
