import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  Line,
  ComposedChart,
} from 'recharts';
import {
  Truck,
  Package,
  Activity,
  TrendingUp,
  CheckCircle2,
  Clock,
  Wallet,
  Mountain,
} from 'lucide-react';
import type { Frete, PagamentoFrete } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import type { CrossFilters, CrossDim } from './crossFilterTypes';

const PALETTE = [
  '#F7B155',
  '#3AA368',
  '#6AA2FF',
  '#A78BFA',
  '#FB923C',
  '#5EEAD4',
  '#F472B6',
  '#FCD34D',
  '#67E8F9',
  '#F97066',
];

const METODO_LABELS: Record<string, string> = {
  pix: 'Pix',
  boleto: 'Boleto',
  cheque: 'Cheque',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência',
  combustivel: 'Combustível',
};

interface Props {
  fretesBase: Frete[];
  pagamentosBase: PagamentoFrete[];
  obrasMap: Map<string, string>;
  insumosMap: Map<string, string>;
  crossFilters: CrossFilters;
  onToggle: (dim: CrossDim, value: string) => void;
  applyCrossFretes: (items: Frete[], except?: CrossDim) => Frete[];
  applyCrossPag: (items: PagamentoFrete[], except?: CrossDim) => PagamentoFrete[];
}

const TOOLTIP_STYLE = {
  background: 'var(--color-surface-1)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--color-fg)',
  boxShadow: 'var(--shadow-lg)',
  fontSize: 12,
};

// Helper de cor com dim — quando há seleção naquela dim, dimme os não-selecionados
function fillFor(palette: string, isSelected: boolean, hasSelection: boolean): string {
  if (!hasSelection) return palette;
  return isSelected ? palette : `${palette}40`; // 40 = ~25% alpha em hex8
}

export default function FreteAnalyticsOverview({
  fretesBase,
  pagamentosBase,
  obrasMap,
  insumosMap,
  crossFilters,
  onToggle,
  applyCrossFretes,
  applyCrossPag,
}: Props) {
  // Para KPIs e qualquer chart sem dimensão "própria", aplicamos todos
  // os cross-filters.
  const fretesAll = useMemo(() => applyCrossFretes(fretesBase), [fretesBase, applyCrossFretes]);

  // ── KPIs ──────────────────────────────────────────────────────────
  const totalFretes = fretesAll.reduce((s, f) => s + f.valorTotal, 0);
  const totalToneladas = fretesAll.reduce((s, f) => s + (f.pesoToneladas || 0), 0);
  const totalKm = fretesAll.reduce((s, f) => s + (f.kmRodados || 0), 0);
  const custoMedioPorTon = totalToneladas > 0 ? totalFretes / totalToneladas : 0;
  const custoMedioPorKm = totalKm > 0 ? totalFretes / totalKm : 0;
  const fretesEntregues = fretesAll.filter((f) => !!f.dataChegada).length;
  const fretesTransito = fretesAll.length - fretesEntregues;
  const pctEntregues = fretesAll.length > 0 ? (fretesEntregues / fretesAll.length) * 100 : 0;

  // ── Evolução mensal (own dim: 'mes') ───────────────────────────────
  const fretesPorMes = useMemo(() => applyCrossFretes(fretesBase, 'mes'), [fretesBase, applyCrossFretes]);
  const evolucaoMensal = useMemo(() => {
    const map = new Map<string, { valor: number; qtd: number; toneladas: number }>();
    fretesPorMes.forEach((f) => {
      if (!f.data) return;
      const ym = f.data.slice(0, 7);
      const prev = map.get(ym) || { valor: 0, qtd: 0, toneladas: 0 };
      map.set(ym, {
        valor: prev.valor + f.valorTotal,
        qtd: prev.qtd + 1,
        toneladas: prev.toneladas + (f.pesoToneladas || 0),
      });
    });
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ym, d]) => {
        const [ano, mes] = ym.split('-');
        return {
          ym,
          label: `${meses[parseInt(mes, 10) - 1]}/${ano.slice(2)}`,
          valor: d.valor,
          qtd: d.qtd,
          toneladas: Math.round(d.toneladas),
        };
      });
  }, [fretesPorMes]);

  // ── Top transportadoras (own dim) ──────────────────────────────────
  const fretesPorTransp = useMemo(() => applyCrossFretes(fretesBase, 'transportadora'), [fretesBase, applyCrossFretes]);
  const topTransportadoras = useMemo(() => {
    const map = new Map<string, { valor: number; qtd: number }>();
    fretesPorTransp.forEach((f) => {
      const key = (f.transportadora || 'Sem transportadora').trim() || 'Sem transportadora';
      const prev = map.get(key) || { valor: 0, qtd: 0 };
      map.set(key, { valor: prev.valor + f.valorTotal, qtd: prev.qtd + 1 });
    });
    return Array.from(map.entries())
      .map(([nome, d]) => ({ nome, valor: d.valor, qtd: d.qtd }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);
  }, [fretesPorTransp]);

  // ── Top obras (own dim: obraId) ────────────────────────────────────
  const fretesPorObra = useMemo(() => applyCrossFretes(fretesBase, 'obraId'), [fretesBase, applyCrossFretes]);
  const topObras = useMemo(() => {
    const map = new Map<string, { valor: number; qtd: number }>();
    fretesPorObra.forEach((f) => {
      if (!f.obraId) return;
      const prev = map.get(f.obraId) || { valor: 0, qtd: 0 };
      map.set(f.obraId, { valor: prev.valor + f.valorTotal, qtd: prev.qtd + 1 });
    });
    return Array.from(map.entries())
      .map(([id, d]) => ({ id, nome: obrasMap.get(id) || 'Sem obra', valor: d.valor, qtd: d.qtd }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);
  }, [fretesPorObra, obrasMap]);

  // ── Top materiais (own dim: insumoId) ──────────────────────────────
  const fretesPorMat = useMemo(() => applyCrossFretes(fretesBase, 'insumoId'), [fretesBase, applyCrossFretes]);
  const topMateriais = useMemo(() => {
    const map = new Map<string, { valor: number; toneladas: number; qtd: number }>();
    fretesPorMat.forEach((f) => {
      if (!f.insumoId) return;
      const prev = map.get(f.insumoId) || { valor: 0, toneladas: 0, qtd: 0 };
      map.set(f.insumoId, {
        valor: prev.valor + f.valorTotal,
        toneladas: prev.toneladas + (f.pesoToneladas || 0),
        qtd: prev.qtd + 1,
      });
    });
    return Array.from(map.entries())
      .map(([id, d]) => ({
        id,
        nome: insumosMap.get(id) || id,
        valor: d.valor,
        toneladas: d.toneladas,
        qtd: d.qtd,
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);
  }, [fretesPorMat, insumosMap]);

  // ── Top pedreiras (own dim: origem) ────────────────────────────────
  const fretesPorPedreira = useMemo(() => applyCrossFretes(fretesBase, 'origem'), [fretesBase, applyCrossFretes]);
  const topPedreiras = useMemo(() => {
    const map = new Map<string, { valor: number; toneladas: number }>();
    fretesPorPedreira.forEach((f) => {
      const key = (f.origem || '').trim();
      if (!key) return;
      const prev = map.get(key) || { valor: 0, toneladas: 0 };
      map.set(key, {
        valor: prev.valor + f.valorTotal,
        toneladas: prev.toneladas + (f.pesoToneladas || 0),
      });
    });
    return Array.from(map.entries())
      .map(([nome, d]) => ({
        nome,
        valor: d.valor,
        toneladas: d.toneladas,
        custoMedio: d.toneladas > 0 ? d.valor / d.toneladas : 0,
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);
  }, [fretesPorPedreira]);

  // ── Pagamentos por método (own dim: metodo) ────────────────────────
  const pagPorMetodo = useMemo(() => applyCrossPag(pagamentosBase, 'metodo'), [pagamentosBase, applyCrossPag]);
  const pagamentosPorMetodo = useMemo(() => {
    const map = new Map<string, { valor: number; qtd: number }>();
    pagPorMetodo.forEach((p) => {
      const m = p.metodo || 'outro';
      const prev = map.get(m) || { valor: 0, qtd: 0 };
      map.set(m, { valor: prev.valor + p.valor, qtd: prev.qtd + 1 });
    });
    return Array.from(map.entries())
      .map(([metodo, d]) => ({
        id: metodo,
        nome: METODO_LABELS[metodo] || metodo,
        valor: d.valor,
        qtd: d.qtd,
      }))
      .sort((a, b) => b.valor - a.valor);
  }, [pagPorMetodo]);
  const totalPagamentosMetodo = pagamentosPorMetodo.reduce((s, p) => s + p.valor, 0);

  const [metricaMensal, setMetricaMensal] = useState<'valor' | 'toneladas'>('valor');

  return (
    <div className="space-y-4">
      {/* ── Hero KPIs ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<Truck className="h-4 w-4" />}
          eyebrow="Total de Fretes"
          value={formatCurrency(totalFretes)}
          subtitle={`${fretesAll.length} frete${fretesAll.length !== 1 ? 's' : ''} no período`}
          tone="amber"
        />
        <KpiCard
          icon={<Package className="h-4 w-4" />}
          eyebrow="Volume Transportado"
          value={`${totalToneladas.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} t`}
          subtitle={`${totalKm.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km percorridos`}
        />
        <KpiCard
          icon={<Activity className="h-4 w-4" />}
          eyebrow="Custo Médio"
          value={formatCurrency(custoMedioPorTon)}
          subtitle={`por tonelada · ${formatCurrency(custoMedioPorKm)}/km`}
        />
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          eyebrow="Status de Entrega"
          value={`${pctEntregues.toFixed(0)}%`}
          subtitle={`${fretesEntregues} entregues · ${fretesTransito} em trânsito`}
          progress={pctEntregues}
        />
      </div>

      {/* ── Evolução Mensal + Top Transportadoras ──────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <ChartCard
          title="Evolução Mensal"
          subtitle={metricaMensal === 'valor' ? 'Valor de fretes (R$) e quantidade por mês — clique numa barra para filtrar' : 'Toneladas transportadas e quantidade por mês — clique numa barra para filtrar'}
          icon={<TrendingUp className="h-4 w-4" />}
          className="xl:col-span-2"
          headerExtra={
            <div className="inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] p-0.5">
              <button
                type="button"
                onClick={() => setMetricaMensal('valor')}
                className={`text-[11px] px-2.5 py-1 rounded transition-colors ${metricaMensal === 'valor' ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)] font-semibold' : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'}`}
              >R$</button>
              <button
                type="button"
                onClick={() => setMetricaMensal('toneladas')}
                className={`text-[11px] px-2.5 py-1 rounded transition-colors ${metricaMensal === 'toneladas' ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)] font-semibold' : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'}`}
              >Ton</button>
            </div>
          }
          height={300}
        >
          {evolucaoMensal.length === 0 ? (
            <EmptyChart text="Nenhum frete no período selecionado." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={evolucaoMensal} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" fontSize={11} tick={{ fill: 'var(--color-fg-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} />
                <YAxis yAxisId="left" fontSize={11} tick={{ fill: 'var(--color-fg-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false}
                  tickFormatter={(v) => metricaMensal === 'valor' ? `R$ ${(v / 1000).toFixed(0)}k` : `${(v as number).toLocaleString('pt-BR')}t`} />
                <YAxis yAxisId="right" orientation="right" fontSize={11} tick={{ fill: 'var(--color-fg-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'color-mix(in srgb, var(--color-fg) 6%, transparent)' }}
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value, name) => {
                    if (name === 'Valor (R$)') return [formatCurrency(Number(value)), name];
                    if (name === 'Toneladas') return [`${Number(value).toLocaleString('pt-BR')} t`, name];
                    return [value, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                <Bar yAxisId="left" dataKey={metricaMensal} name={metricaMensal === 'valor' ? 'Valor (R$)' : 'Toneladas'} radius={[6, 6, 0, 0]} cursor="pointer"
                  onClick={(e) => onToggle('mes', (e as { ym?: string }).ym || '')}
                >
                  {evolucaoMensal.map((d) => (
                    <Cell key={d.ym} fill={fillFor('var(--color-accent-amber)', crossFilters.mes === d.ym, !!crossFilters.mes)} />
                  ))}
                </Bar>
                <Line yAxisId="right" type="monotone" dataKey="qtd" name="Qtd fretes" stroke="#6AA2FF" strokeWidth={2} dot={{ r: 3, fill: '#6AA2FF' }} activeDot={{ r: 5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Top Transportadoras"
          subtitle="Clique para filtrar"
          icon={<Truck className="h-4 w-4" />}
          height={300}
        >
          {topTransportadoras.length === 0 ? (
            <EmptyChart text="Sem dados de transportadoras." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topTransportadoras} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" fontSize={11} tick={{ fill: 'var(--color-fg-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                <YAxis dataKey="nome" type="category" fontSize={11} tick={{ fill: 'var(--color-fg-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} width={110} />
                <Tooltip cursor={{ fill: 'color-mix(in srgb, var(--color-fg) 6%, transparent)' }} contentStyle={TOOLTIP_STYLE}
                  formatter={(value, _name, item) => {
                    const qtd = item?.payload?.qtd;
                    return [`${formatCurrency(Number(value))} · ${qtd} frete${qtd !== 1 ? 's' : ''}`, 'Gasto'];
                  }} />
                <Bar dataKey="valor" radius={[0, 6, 6, 0]} cursor="pointer"
                  onClick={(e) => onToggle('transportadora', (e as { nome?: string }).nome || '')}
                >
                  {topTransportadoras.map((d, i) => (
                    <Cell key={d.nome} fill={fillFor(PALETTE[i % PALETTE.length], crossFilters.transportadora === d.nome, !!crossFilters.transportadora)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── Gasto por Obra + Top Materiais ─────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <ChartCard title="Gasto por Obra" subtitle="Top 8 — clique para filtrar" icon={<Activity className="h-4 w-4" />} height={280}>
          {topObras.length === 0 ? (
            <EmptyChart text="Sem fretes vinculados a obra." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topObras} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" fontSize={11} tick={{ fill: 'var(--color-fg-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                <YAxis dataKey="nome" type="category" fontSize={11} tick={{ fill: 'var(--color-fg-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} width={130} />
                <Tooltip cursor={{ fill: 'color-mix(in srgb, var(--color-fg) 6%, transparent)' }} contentStyle={TOOLTIP_STYLE}
                  formatter={(value, _name, item) => {
                    const qtd = item?.payload?.qtd;
                    return [`${formatCurrency(Number(value))} · ${qtd} frete${qtd !== 1 ? 's' : ''}`, 'Gasto'];
                  }} />
                <Bar dataKey="valor" radius={[0, 6, 6, 0]} cursor="pointer"
                  onClick={(e) => onToggle('obraId', (e as { id?: string }).id || '')}
                >
                  {topObras.map((d, i) => (
                    <Cell key={d.id} fill={fillFor(PALETTE[(i + 1) % PALETTE.length], crossFilters.obraId === d.id, !!crossFilters.obraId)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Top Materiais" subtitle="Por valor — clique para filtrar" icon={<Package className="h-4 w-4" />} height={280}>
          {topMateriais.length === 0 ? (
            <EmptyChart text="Sem materiais transportados." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topMateriais} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" fontSize={11} tick={{ fill: 'var(--color-fg-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                <YAxis dataKey="nome" type="category" fontSize={11} tick={{ fill: 'var(--color-fg-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} width={130} />
                <Tooltip cursor={{ fill: 'color-mix(in srgb, var(--color-fg) 6%, transparent)' }} contentStyle={TOOLTIP_STYLE}
                  formatter={(value, _name, item) => {
                    const ton = item?.payload?.toneladas;
                    return [
                      `${formatCurrency(Number(value))} · ${Number(ton).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} t`,
                      'Frete',
                    ];
                  }} />
                <Bar dataKey="valor" radius={[0, 6, 6, 0]} cursor="pointer"
                  onClick={(e) => onToggle('insumoId', (e as { id?: string }).id || '')}
                >
                  {topMateriais.map((d, i) => (
                    <Cell key={d.id} fill={fillFor(PALETTE[(i + 2) % PALETTE.length], crossFilters.insumoId === d.id, !!crossFilters.insumoId)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── Pagamentos por método + Top Pedreiras ──────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <ChartCard title="Pagamentos por Método" subtitle="Clique numa fatia para filtrar" icon={<Wallet className="h-4 w-4" />} height={300}>
          {pagamentosPorMetodo.length === 0 ? (
            <EmptyChart text="Sem pagamentos no período." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pagamentosPorMetodo}
                  dataKey="valor"
                  nameKey="nome"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  stroke="var(--color-surface-1)"
                  strokeWidth={2}
                  cursor="pointer"
                  onClick={(e) => onToggle('metodo', (e as { id?: string }).id || '')}
                >
                  {pagamentosPorMetodo.map((d, i) => (
                    <Cell key={d.id} fill={fillFor(PALETTE[i % PALETTE.length], crossFilters.metodo === d.id, !!crossFilters.metodo)} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value, _name, item) => {
                    const pct = totalPagamentosMetodo > 0 ? (Number(value) / totalPagamentosMetodo) * 100 : 0;
                    const qtd = item?.payload?.qtd;
                    return [`${formatCurrency(Number(value))} · ${pct.toFixed(1)}% · ${qtd} pagto${qtd !== 1 ? 's' : ''}`, item?.payload?.nome];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} formatter={(value) => <span style={{ color: 'var(--color-fg-muted)' }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Top Pedreiras / Origens" subtitle="Gasto e custo médio R$/t — clique para filtrar" icon={<Mountain className="h-4 w-4" />} className="xl:col-span-2" height={300}>
          {topPedreiras.length === 0 ? (
            <EmptyChart text="Sem dados de origem." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topPedreiras} margin={{ top: 4, right: 12, left: 4, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="nome" fontSize={10} tick={{ fill: 'var(--color-fg-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} angle={-30} textAnchor="end" height={60} interval={0} />
                <YAxis fontSize={11} tick={{ fill: 'var(--color-fg-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                <Tooltip cursor={{ fill: 'color-mix(in srgb, var(--color-fg) 6%, transparent)' }} contentStyle={TOOLTIP_STYLE}
                  formatter={(value, _name, item) => {
                    const ton = item?.payload?.toneladas;
                    const cm = item?.payload?.custoMedio;
                    return [
                      `${formatCurrency(Number(value))} · ${Number(ton).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} t · ${formatCurrency(cm)}/t`,
                      'Gasto',
                    ];
                  }} />
                <Bar dataKey="valor" radius={[6, 6, 0, 0]} cursor="pointer"
                  onClick={(e) => onToggle('origem', (e as { nome?: string }).nome || '')}
                >
                  {topPedreiras.map((d, i) => (
                    <Cell key={d.nome} fill={fillFor(PALETTE[(i + 3) % PALETTE.length], crossFilters.origem === d.nome, !!crossFilters.origem)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

// ── Subcomponentes ─────────────────────────────────────────────────────

function KpiCard({
  icon,
  eyebrow,
  value,
  subtitle,
  tone,
  progress,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  value: string;
  subtitle?: string;
  tone?: 'amber' | 'default';
  progress?: number;
}) {
  const accent = tone === 'amber' ? 'var(--color-accent-amber)' : 'var(--color-fg)';
  return (
    <div className="card-premium elevate-top p-4 relative overflow-hidden">
      {tone === 'amber' && (
        <div aria-hidden className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-25 pointer-events-none" style={{ background: 'radial-gradient(circle, var(--color-accent-amber) 0%, transparent 70%)' }} />
      )}
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <span className="label-eyebrow">{eyebrow}</span>
          <span className="inline-flex items-center justify-center h-7 w-7 rounded-md" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-fg)' }}>
            {icon}
          </span>
        </div>
        <p className="text-[22px] font-bold tracking-tight" style={{ color: accent }}>{value}</p>
        {subtitle && <p className="text-[11px] text-[var(--color-fg-subtle)] mt-1 truncate">{subtitle}</p>}
        {typeof progress === 'number' && (
          <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: 'color-mix(in srgb, var(--color-fg) 8%, transparent)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, progress))}%`, background: 'linear-gradient(90deg, var(--color-success), var(--color-accent-amber))' }} />
          </div>
        )}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  icon,
  className = '',
  headerExtra,
  height,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
  headerExtra?: React.ReactNode;
  height: number;
  children: React.ReactNode;
}) {
  return (
    <div className={`card-premium elevate-top p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-2 min-w-0">
          {icon && (
            <span className="inline-flex items-center justify-center h-7 w-7 rounded-md shrink-0 mt-0.5" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-fg)' }}>
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--color-fg)] truncate">{title}</h3>
            {subtitle && <p className="text-[11px] text-[var(--color-fg-subtle)] truncate">{subtitle}</p>}
          </div>
        </div>
        {headerExtra && <div className="shrink-0">{headerExtra}</div>}
      </div>
      <div style={{ height }}>{children}</div>
    </div>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <Clock className="h-7 w-7 text-[var(--color-fg-subtle)] mb-2" />
      <p className="text-xs text-[var(--color-fg-muted)]">{text}</p>
    </div>
  );
}
