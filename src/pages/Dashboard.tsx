import { useMemo, useState } from 'react';
import { useUrlState, useUrlStateList } from '../hooks/useUrlState';
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
  '#3AA368', '#F7B155', '#6AA2FF', '#A78BFA', '#5EEAD4',
  '#FB923C', '#67E8F9', '#F472B6', '#F97066', '#C084FC',
  '#34D399', '#FCD34D', '#7DD3FC', '#FDBA74', '#2DD4BF',
];
import { formatCurrency } from '../utils/formatters';
import type { Abastecimento, SaidaMaterial } from '../types';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { useObras } from '../hooks/useObras';
// Substitui useAbastecimentos (compat shim) na Fase 5 — adapter inline mantém shape antigo.
import { useSaidasCombustivel } from '../hooks/useSaidasCombustivel';
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
  const { data: saidasCombustivel = [] } = useSaidasCombustivel();
  // Adapter inline pra preservar helpers/uso downstream (tipo Abastecimento
  // será removido na Fase 5; quando isso acontecer, este arquivo refatora
  // pra usar SaidaCombustivel direto).
  const abastecimentos: Abastecimento[] = useMemo(
    () => saidasCombustivel.map((s) => ({
      id: s.id,
      dataHora: s.data,
      tipoCombustivel: s.tipoCombustivel ?? '',
      quantidadeLitros: s.litros,
      valorTotal: s.valorTotal,
      obraId: s.obraId ?? '',
      etapaId: s.etapaId ?? '',
      alocacoes: s.alocacoes ?? [],
      depositoId: s.tanqueId ?? '',
      equipamentoId: (s.equipamentoId === 'desconhecido' ? '' : (s.equipamentoId ?? '')),
      veiculo: '',
      fotosUrls: s.fotoUrls ?? [],
      observacoes: s.observacoes ?? '',
      criadoPor: s.createdBy ?? '',
      origemCombustivel: s.origem,
      fornecedor: '',
      pago: s.pago ?? false,
      dataPagamento: s.pagoEm ?? '',
      pagoPor: '',
    })),
    [saidasCombustivel]
  );
  const { data: saidasMaterial = [] } = useSaidasMaterial();
  const { data: insumos = [] } = useInsumos();

  // ALL hooks must be called before any early return
  const [filtroObraId, setFiltroObraId] = useUrlState('obra');
  const [filtroEtapaIds, setFiltroEtapaIds] = useUrlStateList('etapas');
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
        <p className="text-[var(--color-fg-subtle)]">Carregando...</p>
      </div>
    );
  }

  const emAndamento = obras.filter((o) => o.status === 'em_andamento').length;
  const concluidas = obras.filter((o) => o.status === 'concluida').length;
  const temFiltro = filtroObraId !== '' || filtroEtapaIds.length > 0;

  function toggleEtapa(id: string) {
    setFiltroEtapaIds(
      filtroEtapaIds.includes(id)
        ? filtroEtapaIds.filter((x) => x !== id)
        : [...filtroEtapaIds, id]
    );
  }

  function limparFiltros() {
    setFiltroObraId('');
    setFiltroEtapaIds([]);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-[28px] font-semibold text-[var(--color-fg)] tracking-tight">Dashboard</h1>
        <p className="text-sm text-[var(--color-fg-muted)] mt-1">Visão consolidada de obras e gastos.</p>
      </div>

      {/* Filtros */}
      {canFilter && (
        <div className="card-premium p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[var(--color-fg-muted)] uppercase tracking-wider">Filtros</h3>
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
                <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
                  Etapas
                </label>
                <div className="relative">
                  <button
                    type="button"
                    className="w-full h-[42px] rounded-lg px-3 text-sm text-left bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)] flex items-center justify-between"
                    onClick={() => setEtapasDropdownOpen(!etapasDropdownOpen)}
                  >
                    <span className={filtroEtapaIds.length === 0 ? 'text-[var(--color-fg-subtle)]' : 'text-[var(--color-fg)]'}>
                      {filtroEtapaIds.length === 0
                        ? 'Todas'
                        : `${filtroEtapaIds.length} etapa${filtroEtapaIds.length > 1 ? 's' : ''} selecionada${filtroEtapaIds.length > 1 ? 's' : ''}`}
                    </span>
                    <svg className={`w-4 h-4 text-[var(--color-fg-subtle)] transition-transform ${etapasDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {etapasDropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg shadow-[var(--shadow-lg)] max-h-48 overflow-y-auto py-1">
                      {etapasDaObra.map((e) => (
                        <label
                          key={e.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-[var(--color-surface-2)] cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={filtroEtapaIds.includes(e.id)}
                            onChange={() => toggleEtapa(e.id)}
                            className="h-4 w-4 rounded accent-[var(--color-accent)]"
                          />
                          <span className="text-sm text-[var(--color-fg)]">{e.nome}</span>
                        </label>
                      ))}
                      {etapasDaObra.length === 0 && (
                        <p className="px-3 py-2 text-sm text-[var(--color-fg-subtle)]">Nenhuma etapa nesta obra</p>
                      )}
                    </div>
                  )}
                </div>
                {filtroEtapaIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {filtroEtapaIds.map((id) => (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)] text-xs px-2 py-0.5 rounded-full"
                      >
                        {etapasMap.get(id) || id}
                        <button
                          type="button"
                          onClick={() => toggleEtapa(id)}
                          className="hover:text-[var(--color-accent)]"
                        >
                          ×
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

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card-premium p-5">
          <h2 className="text-xs font-medium text-[var(--color-fg-muted)] uppercase tracking-wider">Total de Obras</h2>
          <p className="text-3xl font-semibold text-[var(--color-fg)] mt-2 tracking-tight tabular-nums">{obras.length}</p>
        </div>
        <div className="card-premium p-5">
          <h2 className="text-xs font-medium text-[var(--color-fg-muted)] uppercase tracking-wider">Em Andamento</h2>
          <p className="text-3xl font-semibold text-[var(--color-warning-fg)] mt-2 tracking-tight tabular-nums">{emAndamento}</p>
        </div>
        <div className="card-premium p-5">
          <h2 className="text-xs font-medium text-[var(--color-fg-muted)] uppercase tracking-wider">Concluídas</h2>
          <p className="text-3xl font-semibold text-[var(--color-accent)] mt-2 tracking-tight tabular-nums">{concluidas}</p>
        </div>
        <div className="card-premium p-5">
          <h2 className="text-xs font-medium text-[var(--color-fg-muted)] uppercase tracking-wider">
            Gasto Total
          </h2>
          <p className="text-3xl font-semibold text-[var(--color-fg)] mt-2 tracking-tight tabular-nums">
            {formatCurrency(gastoTotal)}
          </p>
          <p className="text-xs text-[var(--color-fg-subtle)] mt-1">
            Combustível + Insumos
          </p>
        </div>
      </div>

      {/* Grafico de gastos por tipo */}
      {chartData.length > 0 && (
        <div className="card-premium p-6 mt-6">
          <h3 className="text-sm font-semibold text-[var(--color-fg)] mb-4">
            Gastos por Tipo de Insumo e Combustível (R$)
          </h3>
          <div style={{ height: Math.max(200, chartData.length * 40 + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" fontSize={11} tick={{ fill: 'var(--color-fg-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} />
                <YAxis
                  dataKey="nome"
                  type="category"
                  fontSize={11}
                  width={140}
                  tick={{ fill: 'var(--color-fg-muted)' }}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  cursor={{ fill: 'color-mix(in srgb, var(--color-fg) 8%, transparent)' }}
                  contentStyle={{
                    background: 'var(--color-surface-1)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-fg)',
                    boxShadow: 'var(--shadow-lg)',
                  }}
                  labelStyle={{ color: 'var(--color-fg)', fontWeight: 600 }}
                  itemStyle={{ color: 'var(--color-fg-muted)' }}
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
