import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { Abastecimento, Deposito, EntradaCombustivel, TransferenciaCombustivel, EtapaObra, Obra, TipoConsumidorSaida } from '../../types';
import { useInsumos } from '../../hooks/useInsumos';
import { useEquipamentos } from '../../hooks/useEquipamentos';
// Hook novo Fase 3 — fonte canônica de saídas pós-Fase 2.
import { useSaidasCombustivel } from '../../hooks/useSaidasCombustivel';
import { formatCurrency } from '../../utils/formatters';

const card = 'bg-white dark:bg-slate-800 rounded-xl shadow-md px-6 py-5';
const sectionTitle = 'text-base font-bold text-gray-700 dark:text-slate-300 uppercase tracking-wide mb-4';
const COLORS = ['#059669', '#1e40af', '#dc2626', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];

interface DashboardProps {
  abastecimentos: Abastecimento[];
  entradas: EntradaCombustivel[];
  todasEntradas: EntradaCombustivel[];
  todosAbastecimentos: Abastecimento[];
  transferencias: TransferenciaCombustivel[];
  obras: Obra[];
  etapas: EtapaObra[];
  depositos: Deposito[];
}

export default function CombustivelDashboard({
  abastecimentos: _abastLegacy,        // ignorado — substituído por useSaidasCombustivel + filtro
  todasEntradas,
  todosAbastecimentos: _todosAbastLegacy,  // idem
  transferencias,
  obras,
  etapas,
  depositos,
}: DashboardProps) {
  const obrasMap = new Map(obras.map((o) => [o.id, o.nome]));
  const etapasMap = new Map(etapas.map((e) => [e.id, e.nome]));
  const { data: insumosData } = useInsumos();
  const insumosMap = new Map((insumosData ?? []).map((i) => [i.id, i.nome]));
  const { data: equipamentosData } = useEquipamentos();
  const equipMap = new Map((equipamentosData ?? []).map((eq) => [eq.id, eq.nome]));

  // === Toggle "Tipo de Consumidor" (Fase 4 / Item 8) ===
  // Afeta TODOS os KPIs e gráficos abaixo. 'todos' = soma equipamento + carreta.
  type FiltroTipo = 'todos' | TipoConsumidorSaida;
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');

  // Lê saidas_combustivel direto (Fase 3) e converte pro shape legado
  // Abastecimento (mantém o resto do componente intocado). Filtro
  // aplicado tipo_consumidor → 'todos'/'equipamento_proprio'/'carreta_transportadora'.
  const { data: todasSaidas = [] } = useSaidasCombustivel();
  const todosAbastecimentos = useMemo<Abastecimento[]>(() => {
    return todasSaidas
      .filter((s) => filtroTipo === 'todos' || s.tipoConsumidor === filtroTipo)
      .map((s) => ({
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
      }));
  }, [todasSaidas, filtroTipo]);
  // Filtros adicionais (período/obra) já são aplicados upstream pelo
  // FrotaCombustivelContainer na prop `abastecimentos` legada — mas como
  // ignoramos essa prop, aplicamos diretamente aqui. Por enquanto sem
  // filtros de período/obra (Item 8 escopo: só toggle tipo). Se virar dor,
  // adiciona depois.
  const abastecimentos = todosAbastecimentos;

  // Counts por tipo pra exibir nos chips do toggle
  const countTodos = todasSaidas.length;
  const countEquip = useMemo(() => todasSaidas.filter((s) => s.tipoConsumidor === 'equipamento_proprio').length, [todasSaidas]);
  const countCarreta = useMemo(() => todasSaidas.filter((s) => s.tipoConsumidor === 'carreta_transportadora').length, [todasSaidas]);

  // === KPIs ===
  const totalValorSaidas = abastecimentos.reduce((s, a) => s + a.valorTotal, 0);
  const totalLitrosSaidas = abastecimentos.reduce((s, a) => s + a.quantidadeLitros, 0);
  const estoqueAtual = depositos.reduce((s, d) => s + d.nivelAtualLitros, 0);
  const precoMedioLitro = totalLitrosSaidas > 0 ? totalValorSaidas / totalLitrosSaidas : 0;
  const totalTransferencias = transferencias.length;

  // Saídas por origem
  const saidasTanque = abastecimentos.filter((a) => !a.origemCombustivel || a.origemCombustivel === 'tanque');
  const saidasDinheiro = abastecimentos.filter((a) => a.origemCombustivel === 'dinheiro');
  const saidasRequisicao = abastecimentos.filter((a) => a.origemCombustivel === 'requisicao');

  const valorTanque = saidasTanque.reduce((s, a) => s + a.valorTotal, 0);
  const litrosTanque = saidasTanque.reduce((s, a) => s + a.quantidadeLitros, 0);
  const valorDinheiro = saidasDinheiro.reduce((s, a) => s + a.valorTotal, 0);
  const litrosDinheiro = saidasDinheiro.reduce((s, a) => s + a.quantidadeLitros, 0);
  const valorRequisicao = saidasRequisicao.reduce((s, a) => s + a.valorTotal, 0);
  const litrosRequisicao = saidasRequisicao.reduce((s, a) => s + a.quantidadeLitros, 0);

  const requisicoesPendentes = saidasRequisicao.filter((a) => !a.pago);
  const valorPendente = requisicoesPendentes.reduce((s, a) => s + a.valorTotal, 0);
  const litrosPendente = requisicoesPendentes.reduce((s, a) => s + a.quantidadeLitros, 0);

  // Consumo médio diário (últimos 30 dias)
  const agora = new Date();
  const trintaDiasAtras = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);
  const saidasUlt30 = todosAbastecimentos.filter((a) => new Date(a.dataHora) >= trintaDiasAtras);
  const litrosUlt30 = saidasUlt30.reduce((s, a) => s + a.quantidadeLitros, 0);
  const consumoMedioDiario = litrosUlt30 / 30;
  const diasEstoque = consumoMedioDiario > 0 ? estoqueAtual / consumoMedioDiario : 0;

  // === Saldo por tanque com tipos ===
  const saldoPorTanqueTipo = new Map<string, Map<string, number>>();
  todasEntradas.forEach((e) => {
    if (!e.tipoCombustivel) return;
    if (!saldoPorTanqueTipo.has(e.depositoId)) saldoPorTanqueTipo.set(e.depositoId, new Map());
    const tipos = saldoPorTanqueTipo.get(e.depositoId)!;
    tipos.set(e.tipoCombustivel, (tipos.get(e.tipoCombustivel) || 0) + e.quantidadeLitros);
  });
  todosAbastecimentos.forEach((a) => {
    if (!a.tipoCombustivel || !a.depositoId) return;
    if (!saldoPorTanqueTipo.has(a.depositoId)) saldoPorTanqueTipo.set(a.depositoId, new Map());
    const tipos = saldoPorTanqueTipo.get(a.depositoId)!;
    tipos.set(a.tipoCombustivel, (tipos.get(a.tipoCombustivel) || 0) - a.quantidadeLitros);
  });

  // === Fluxo mensal (litros) ===
  const fluxoMensal = new Map<string, { entradas: number; saidas: number }>();
  todasEntradas.forEach((e) => {
    const d = new Date(e.dataHora);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const cur = fluxoMensal.get(key) || { entradas: 0, saidas: 0 };
    cur.entradas += e.quantidadeLitros;
    fluxoMensal.set(key, cur);
  });
  todosAbastecimentos.forEach((a) => {
    const d = new Date(a.dataHora);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const cur = fluxoMensal.get(key) || { entradas: 0, saidas: 0 };
    cur.saidas += a.quantidadeLitros;
    fluxoMensal.set(key, cur);
  });
  const chartFluxo = Array.from(fluxoMensal.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, d]) => {
      const [ano, m] = mes.split('-');
      return { mes: `${m}/${ano}`, entradas: Math.round(d.entradas), saidas: Math.round(d.saidas) };
    });

  // === Consumo mensal (R$) ===
  const consumoMensalR$ = new Map<string, number>();
  abastecimentos.forEach((a) => {
    const d = new Date(a.dataHora);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    consumoMensalR$.set(key, (consumoMensalR$.get(key) || 0) + a.valorTotal);
  });
  const chartMensal = Array.from(consumoMensalR$.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, valor]) => {
      const [ano, m] = mes.split('-');
      return { mes: `${m}/${ano}`, valor: Math.round(valor * 100) / 100 };
    });

  // === Consumo semanal (litros - últimas 12 semanas) ===
  function getWeekStart(d: Date): Date {
    const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = dt.getDay();
    const diff = day === 0 ? 6 : day - 1; // segunda = início
    dt.setDate(dt.getDate() - diff);
    return dt;
  }
  function fmtDMShort(d: Date): string {
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  const consumoSemanal = new Map<string, { litros: number; inicio: Date }>();
  abastecimentos.forEach((a) => {
    const dt = new Date(a.dataHora);
    if (isNaN(dt.getTime())) return;
    const inicio = getWeekStart(dt);
    const key = inicio.toISOString().slice(0, 10);
    const cur = consumoSemanal.get(key) || { litros: 0, inicio };
    cur.litros += a.quantidadeLitros;
    consumoSemanal.set(key, cur);
  });
  const chartSemanal = Array.from(consumoSemanal.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([, d]) => {
      const fim = new Date(d.inicio);
      fim.setDate(fim.getDate() + 6);
      return {
        semana: fmtDMShort(d.inicio),
        periodo: `${fmtDMShort(d.inicio)} a ${fmtDMShort(fim)}`,
        litros: Math.round(d.litros),
      };
    });

  // === Gasto por Obra (para bar chart horizontal) ===
  const gastoPorObra = new Map<string, { valor: number; litros: number }>();
  abastecimentos.forEach((a) => {
    const cur = gastoPorObra.get(a.obraId) || { valor: 0, litros: 0 };
    cur.valor += a.valorTotal;
    cur.litros += a.quantidadeLitros;
    gastoPorObra.set(a.obraId, cur);
  });
  const obraChartData = Array.from(gastoPorObra.entries())
    .map(([id, d]) => ({ nome: obrasMap.get(id) || 'Desconhecida', valor: Math.round(d.valor * 100) / 100, litros: Math.round(d.litros) }))
    .sort((a, b) => b.valor - a.valor);

  // === Gasto por Etapa (para bar chart) ===
  const gastoPorEtapa = new Map<string, { valor: number; litros: number; obraId: string }>();
  abastecimentos.forEach((a) => {
    if (!a.etapaId) return;
    const cur = gastoPorEtapa.get(a.etapaId) || { valor: 0, litros: 0, obraId: a.obraId };
    cur.valor += a.valorTotal;
    cur.litros += a.quantidadeLitros;
    gastoPorEtapa.set(a.etapaId, cur);
  });
  const etapaChartData = Array.from(gastoPorEtapa.entries())
    .map(([id, d]) => ({
      nome: etapasMap.get(id) || 'Desconhecida',
      obra: obrasMap.get(d.obraId) || '',
      valor: Math.round(d.valor * 100) / 100,
      litros: Math.round(d.litros),
    }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 10);

  // === Top equipamentos (agrupado por nome para unificar IDs duplicados) ===
  const porEquip = new Map<string, { litros: number; valor: number }>();
  todosAbastecimentos.forEach((a) => {
    if (!a.veiculo) return;
    const nome = equipMap.get(a.veiculo) || a.veiculo;
    const cur = porEquip.get(nome) || { litros: 0, valor: 0 };
    cur.litros += a.quantidadeLitros;
    cur.valor += a.valorTotal;
    porEquip.set(nome, cur);
  });
  const topEquip = Array.from(porEquip.entries())
    .map(([nome, d]) => ({ nome, litros: Math.round(d.litros), valor: Math.round(d.valor * 100) / 100 }))
    .sort((a, b) => b.litros - a.litros)
    .slice(0, 10);

  // === Distribuição por tipo combustível (pie) ===
  const porTipoComb = new Map<string, number>();
  todosAbastecimentos.forEach((a) => {
    if (!a.tipoCombustivel) return;
    porTipoComb.set(a.tipoCombustivel, (porTipoComb.get(a.tipoCombustivel) || 0) + a.quantidadeLitros);
  });
  const pieData = Array.from(porTipoComb.entries())
    .map(([id, litros]) => ({ name: insumosMap.get(id) || id, value: Math.round(litros) }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6">
      {/* ── Toggle Tipo de Consumidor (Fase 4 / Item 8) ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Tipo de Consumidor
        </span>
        {([
          { key: 'todos' as FiltroTipo, label: 'Todos', count: countTodos },
          { key: 'equipamento_proprio' as FiltroTipo, label: 'Equipamento', count: countEquip },
          { key: 'carreta_transportadora' as FiltroTipo, label: 'Carreta', count: countCarreta },
        ]).map((opt) => {
          const ativo = filtroTipo === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setFiltroTipo(opt.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                ativo
                  ? 'bg-emt-verde text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {opt.label}
              <span className="ml-1.5 opacity-70">({opt.count})</span>
            </button>
          );
        })}
      </div>

      {/* ── SEÇÃO 1: KPIs ── */}
      <p className={sectionTitle}>Resumo Geral</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard label="Total Saídas" value={formatCurrency(totalValorSaidas)} sub={`${totalLitrosSaidas.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L`} color="text-red-600 dark:text-red-400" />
        <KpiCard label="Preço Médio/Litro" value={formatCurrency(precoMedioLitro)} sub="Baseado em todas as saídas" color="text-amber-600 dark:text-amber-400" />
        <KpiCard label="Estoque Atual" value={`${estoqueAtual.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L`} sub={diasEstoque > 0 ? `~${Math.round(diasEstoque)} dias · ${totalTransferencias} transf.` : `${totalTransferencias} transferência${totalTransferencias !== 1 ? 's' : ''}`} color="text-blue-600 dark:text-blue-400" />
        <KpiCard label="Média Diária de Saídas" value={`${consumoMedioDiario.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L/dia`} sub={`${saidasUlt30.length} saída${saidasUlt30.length !== 1 ? 's' : ''} nos últimos 30 dias`} color="text-purple-600 dark:text-purple-400" />
      </div>

      {/* ── SEÇÃO 1.1: Consumo por Origem ── */}
      <p className={sectionTitle}>Consumo por Origem</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={card}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <p className="text-sm font-semibold text-gray-600 dark:text-slate-400">Tanque</p>
          </div>
          <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{formatCurrency(valorTanque)}</p>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {litrosTanque.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L · {saidasTanque.length} saída{saidasTanque.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className={card}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <p className="text-sm font-semibold text-gray-600 dark:text-slate-400">Dinheiro</p>
          </div>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(valorDinheiro)}</p>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {litrosDinheiro.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L · {saidasDinheiro.length} saída{saidasDinheiro.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className={card}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-violet-500" />
            <p className="text-sm font-semibold text-gray-600 dark:text-slate-400">Requisição</p>
          </div>
          <p className="text-xl font-bold text-violet-600 dark:text-violet-400">{formatCurrency(valorRequisicao)}</p>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {litrosRequisicao.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L · {saidasRequisicao.length} saída{saidasRequisicao.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className={card}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <p className="text-sm font-semibold text-gray-600 dark:text-slate-400">Requisições Pendentes</p>
          </div>
          <p className="text-xl font-bold text-red-600 dark:text-red-400">{formatCurrency(valorPendente)}</p>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            {litrosPendente.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L · {requisicoesPendentes.length} não paga{requisicoesPendentes.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* ── SEÇÃO 2: Tanques ── */}
      {depositos.length > 0 && (
        <>
          <p className={sectionTitle}>Nível dos Tanques</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {depositos.filter((d) => d.ativo).map((dep) => {
              const pct = dep.capacidadeLitros > 0 ? (dep.nivelAtualLitros / dep.capacidadeLitros) * 100 : 0;
              const cor = pct > 50 ? 'bg-green-500' : pct > 20 ? 'bg-yellow-500' : 'bg-red-500';
              const corTexto = pct > 50 ? 'text-green-700 dark:text-green-400' : pct > 20 ? 'text-yellow-700 dark:text-yellow-400' : 'text-red-700 dark:text-red-400';
              return (
                <div key={dep.id} className={card}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-base font-semibold text-gray-800 dark:text-slate-200">{dep.nome}</p>
                    </div>
                    <span className={`text-2xl font-bold ${corTexto}`}>{Math.round(pct)}%</span>
                  </div>
                  <div className="bg-gray-200 dark:bg-slate-600 rounded-full h-4 mb-2">
                    <div className={`h-4 rounded-full transition-all ${cor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-slate-400">
                    {dep.nivelAtualLitros.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} / {dep.capacidadeLitros.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── SEÇÃO 3: Fluxo + Consumo Mensal ── */}
      <p className={sectionTitle}>Evolução Temporal</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Fluxo Entradas vs Saídas */}
        {chartFluxo.length > 0 && (
          <div className={card}>
            <h3 className="text-base font-semibold text-gray-700 dark:text-slate-300 mb-4">Entradas vs Saídas (Litros/mês)</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartFluxo} barGap={0}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="mes" fontSize={13} tick={{ fill: '#6b7280' }} />
                  <YAxis fontSize={13} tick={{ fill: '#6b7280' }} />
                  <Tooltip
                    formatter={(value) => `${Number(value).toLocaleString('pt-BR')} L`}
                    labelStyle={{ fontWeight: 'bold', fontSize: 14 }}
                    contentStyle={{ fontSize: 14, padding: '8px 12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 14, paddingTop: 8 }} />
                  <Bar dataKey="entradas" name="Entradas" fill="#059669" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="saidas" name="Saídas" fill="#dc2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Gasto mensal R$ */}
        {chartMensal.length > 0 && (
          <div className={card}>
            <h3 className="text-base font-semibold text-gray-700 dark:text-slate-300 mb-4">Gasto Mensal com Combustível (R$)</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartMensal}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="mes" fontSize={13} tick={{ fill: '#6b7280' }} />
                  <YAxis fontSize={13} tick={{ fill: '#6b7280' }} />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                    labelStyle={{ fontWeight: 'bold', fontSize: 14 }}
                    contentStyle={{ fontSize: 14, padding: '8px 12px' }}
                  />
                  <Line type="monotone" dataKey="valor" name="Gasto (R$)" stroke="#1e40af" strokeWidth={3} dot={{ r: 5, fill: '#1e40af' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Consumo semanal */}
      {chartSemanal.length > 0 && (
        <div className={card}>
          <h3 className="text-base font-semibold text-gray-700 dark:text-slate-300 mb-1">Consumo Semanal (Litros)</h3>
          <p className="text-sm text-gray-400 dark:text-slate-500 mb-4">Últimas 12 semanas — semana iniciando em (seg)</p>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartSemanal} margin={{ top: 20, right: 10, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis
                  dataKey="semana"
                  fontSize={14}
                  interval={0}
                  tick={{ fill: '#9ca3af', fontWeight: 500 }}
                  tickLine={false}
                  axisLine={{ stroke: '#d1d5db' }}
                />
                <YAxis fontSize={13} tick={{ fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <Tooltip
                  labelFormatter={(_, payload) => {
                    const item = payload?.[0]?.payload;
                    return item?.periodo || '';
                  }}
                  formatter={(value) => [`${Number(value).toLocaleString('pt-BR')} L`, 'Consumo']}
                  labelStyle={{ fontWeight: 'bold', fontSize: 15 }}
                  contentStyle={{ fontSize: 14, padding: '10px 14px', borderRadius: 8 }}
                />
                <Bar dataKey="litros" name="Litros" radius={[6, 6, 0, 0]} label={{ position: 'top', fontSize: 12, fill: '#9ca3af', formatter: (v) => Number(v) > 0 ? `${(Number(v) / 1000).toFixed(1)}k` : '' }}>
                  {chartSemanal.map((_, i) => (
                    <Cell key={i} fill={i === chartSemanal.length - 1 ? '#7c3aed' : '#8b5cf6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── SEÇÃO 4: Distribuição — Obra e Etapa lado a lado, Tipo + Top equip abaixo ── */}
      <p className={sectionTitle}>Distribuição de Consumo</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gasto por Obra */}
        <div className={card}>
          <h3 className="text-base font-semibold text-gray-700 dark:text-slate-300 mb-4">Por Obra</h3>
          {obraChartData.length === 0 ? (
            <p className="text-gray-400 text-base">Sem dados</p>
          ) : (
            <div className="space-y-4">
              {obraChartData.map((item, i) => {
                const maxVal = obraChartData[0]?.valor || 1;
                const pct = (item.valor / maxVal) * 100;
                return (
                  <div key={item.nome}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-sm font-medium text-gray-700 dark:text-slate-300 truncate mr-3">{item.nome}</span>
                      <span className="text-sm font-semibold text-gray-600 dark:text-slate-400 whitespace-nowrap">
                        {formatCurrency(item.valor)} · {item.litros.toLocaleString('pt-BR')} L
                      </span>
                    </div>
                    <div className="bg-gray-100 dark:bg-slate-700 rounded-full h-3">
                      <div className="h-3 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Gasto por Etapa */}
        <div className={card}>
          <h3 className="text-base font-semibold text-gray-700 dark:text-slate-300 mb-4">Por Etapa (Top 10)</h3>
          {etapaChartData.length === 0 ? (
            <p className="text-gray-400 text-base">Sem dados</p>
          ) : (
            <div className="space-y-4">
              {etapaChartData.map((item, i) => {
                const maxVal = etapaChartData[0]?.valor || 1;
                const pct = (item.valor / maxVal) * 100;
                return (
                  <div key={item.nome + item.obra}>
                    <div className="flex justify-between items-center mb-1.5">
                      <div className="truncate mr-3">
                        <span className="text-sm font-medium text-gray-700 dark:text-slate-300">{item.nome}</span>
                        {item.obra && <span className="text-xs text-gray-400 ml-1.5">({item.obra})</span>}
                      </div>
                      <span className="text-sm font-semibold text-gray-600 dark:text-slate-400 whitespace-nowrap">{formatCurrency(item.valor)}</span>
                    </div>
                    <div className="bg-gray-100 dark:bg-slate-700 rounded-full h-3">
                      <div className="h-3 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Tipo combustível + Top equipamentos lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Distribuição por tipo de combustível - Pie */}
        <div className={card}>
          <h3 className="text-base font-semibold text-gray-700 dark:text-slate-300 mb-4">Por Tipo de Combustível</h3>
          {pieData.length === 0 ? (
            <p className="text-gray-400 text-base">Sem dados</p>
          ) : (
            <div className="flex items-center gap-6">
              <div className="w-52 h-52 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={90} innerRadius={45} paddingAngle={2}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => `${Number(value).toLocaleString('pt-BR')} L`} contentStyle={{ fontSize: 14 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3 flex-1 min-w-0">
                {pieData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-sm font-medium text-gray-700 dark:text-slate-300 truncate">{item.name}</span>
                    <span className="text-sm font-semibold text-gray-500 dark:text-slate-400 ml-auto whitespace-nowrap">{item.value.toLocaleString('pt-BR')} L</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Top Equipamentos */}
        <div className={card}>
          <h3 className="text-base font-semibold text-gray-700 dark:text-slate-300 mb-4">Top 10 Equipamentos por Consumo</h3>
          {topEquip.length === 0 ? (
            <p className="text-gray-400 text-base">Sem dados</p>
          ) : (
            <div className="space-y-3">
              {topEquip.map((item, i) => {
                const maxL = topEquip[0]?.litros || 1;
                const pct = (item.litros / maxL) * 100;
                return (
                  <div key={item.nome}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-slate-300 truncate mr-3">
                        <span className="text-sm text-gray-400 mr-1.5">{i + 1}.</span>{item.nome}
                      </span>
                      <span className="text-sm font-semibold text-gray-500 dark:text-slate-400 whitespace-nowrap">
                        {item.litros.toLocaleString('pt-BR')} L · {formatCurrency(item.valor)}
                      </span>
                    </div>
                    <div className="bg-gray-100 dark:bg-slate-700 rounded-full h-3">
                      <div className="h-3 rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── SEÇÃO 6: Tabela detalhada por equipamento ── */}
      <ConsumoPorEquipamento
        todosAbastecimentos={todosAbastecimentos}
        obras={obras}
        etapas={etapas}
        equipMap={equipMap}
        insumosMap={insumosMap}
      />
    </div>
  );
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className={`${card} flex flex-col`}>
      <p className="text-sm text-gray-500 dark:text-slate-400 leading-tight">{label}</p>
      <p className={`text-xl font-bold ${color} mt-1.5`}>{value}</p>
      <p className="text-xs text-gray-400 dark:text-slate-500 mt-auto pt-1">{sub}</p>
    </div>
  );
}

function ConsumoPorEquipamento({
  todosAbastecimentos,
  obras,
  etapas: allEtapas,
  equipMap,
  insumosMap,
}: {
  todosAbastecimentos: Abastecimento[];
  obras: Obra[];
  etapas: EtapaObra[];
  equipMap: Map<string, string>;
  insumosMap: Map<string, string>;
}) {
  const [filtroObraId, setFiltroObraId] = useState('');
  const [filtroEtapaId, setFiltroEtapaId] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');

  const etapasDisponiveis = filtroObraId ? allEtapas.filter((e) => e.obraId === filtroObraId) : [];

  const filtrados = todosAbastecimentos.filter((a) => {
    if (filtroObraId && a.obraId !== filtroObraId) return false;
    if (filtroEtapaId && a.etapaId !== filtroEtapaId) return false;
    if (filtroDataInicio && new Date(a.dataHora) < new Date(filtroDataInicio)) return false;
    if (filtroDataFim && new Date(a.dataHora) > new Date(filtroDataFim + 'T23:59:59')) return false;
    return true;
  });

  const porEquipamento = new Map<string, { litros: number; valor: number; tipos: Map<string, number> }>();
  filtrados.forEach((a) => {
    if (!a.veiculo) return;
    // Agrupar pelo nome do equipamento para unificar IDs duplicados
    const nome = equipMap.get(a.veiculo) || a.veiculo;
    if (!porEquipamento.has(nome)) porEquipamento.set(nome, { litros: 0, valor: 0, tipos: new Map() });
    const eq = porEquipamento.get(nome)!;
    eq.litros += a.quantidadeLitros;
    eq.valor += a.valorTotal;
    eq.tipos.set(a.tipoCombustivel, (eq.tipos.get(a.tipoCombustivel) || 0) + a.quantidadeLitros);
  });

  const lista = Array.from(porEquipamento.entries())
    .map(([nome, d]) => ({ eqId: nome, nome, ...d }))
    .sort((a, b) => b.valor - a.valor);

  const temFiltro = filtroObraId || filtroEtapaId || filtroDataInicio || filtroDataFim;
  const selectCls = 'border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emt-verde bg-white dark:bg-slate-700 dark:text-slate-200';

  return (
    <div className={card}>
      <p className={sectionTitle}>Detalhamento por Equipamento</p>
      <div className="flex flex-wrap items-end gap-4 mb-5">
        <div>
          <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1">Obra</label>
          <select className={selectCls} value={filtroObraId} onChange={(e) => { setFiltroObraId(e.target.value); setFiltroEtapaId(''); }}>
            <option value="">Todas</option>
            {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1">Etapa</label>
          <select className={selectCls} value={filtroEtapaId} onChange={(e) => setFiltroEtapaId(e.target.value)} disabled={!filtroObraId}>
            <option value="">Todas</option>
            {etapasDisponiveis.map((et) => <option key={et.id} value={et.id}>{et.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1">De</label>
          <input type="date" className={selectCls} value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1">Até</label>
          <input type="date" className={selectCls} value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)} />
        </div>
        {temFiltro && (
          <button
            className="px-4 py-2 text-base text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            onClick={() => { setFiltroObraId(''); setFiltroEtapaId(''); setFiltroDataInicio(''); setFiltroDataFim(''); }}
          >
            Limpar
          </button>
        )}
      </div>
      {lista.length === 0 ? (
        <p className="text-gray-400 text-base">Sem dados</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-base">
            <thead className="bg-gray-50 dark:bg-slate-700 border-b dark:border-slate-600">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Equipamento</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Combustíveis</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Litros</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {lista.map((item) => (
                <tr key={item.eqId} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3 font-medium text-gray-700 dark:text-slate-300">{item.nome}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from(item.tipos.entries()).map(([tipoId, litros]) => (
                        <span key={tipoId} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-sm font-medium bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300">
                          {insumosMap.get(tipoId) || tipoId}: {litros.toFixed(0)}L
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-red-700 dark:text-red-400">{item.litros.toFixed(0)} L</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(item.valor)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 dark:border-slate-600">
              <tr className="font-bold text-base">
                <td className="px-4 py-3 text-gray-700 dark:text-slate-300" colSpan={2}>Total</td>
                <td className="px-4 py-3 text-right text-red-700 dark:text-red-400">{lista.reduce((s, i) => s + i.litros, 0).toFixed(0)} L</td>
                <td className="px-4 py-3 text-right">{formatCurrency(lista.reduce((s, i) => s + i.valor, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
