import { useMemo } from 'react';
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
  LabelList,
} from 'recharts';
import {
  Package,
  ShoppingCart,
  Building2,
  Boxes,
  TrendingUp,
  Clock,
  PackagePlus,
} from 'lucide-react';
import type { PedidoMaterial, Frete } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import type { CrossFilters, CrossDim } from './crossFilterTypes';

const PALETTE = [
  '#3AA368',
  '#F7B155',
  '#6AA2FF',
  '#A78BFA',
  '#FB923C',
  '#5EEAD4',
  '#F472B6',
  '#FCD34D',
  '#67E8F9',
  '#F97066',
];

interface Props {
  pedidosBase: PedidoMaterial[];
  fretesBase: Frete[];
  insumosMap: Map<string, string>;
  fornecedoresMap: Map<string, string>;
  crossFilters: CrossFilters;
  onToggle: (dim: CrossDim, value: string) => void;
  applyCrossPedidos: (items: PedidoMaterial[], except?: CrossDim) => PedidoMaterial[];
  applyCrossFretes: (items: Frete[], except?: CrossDim) => Frete[];
}

const TOOLTIP_STYLE = {
  background: 'var(--color-surface-1)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--color-fg)',
  boxShadow: 'var(--shadow-lg)',
  fontSize: 12,
};

function fillFor(palette: string, isSelected: boolean, hasSelection: boolean): string {
  if (!hasSelection) return palette;
  return isSelected ? palette : `${palette}40`;
}

// Helpers para somar pedidos respeitando cross-filter de material:
// quando há crossFilters.insumoId, só contam os itens daquele material.
function sumPedido(p: PedidoMaterial, insumoFiltro?: string): { valor: number; qtd: number; itens: number } {
  const itens = (p.itens || []).filter((it) => !insumoFiltro || it.insumoId === insumoFiltro);
  return {
    valor: itens.reduce((s, it) => s + it.quantidade * it.valorUnitario, 0),
    qtd: itens.reduce((s, it) => s + it.quantidade, 0),
    itens: itens.length,
  };
}

export default function MaterialAnalyticsOverview({
  pedidosBase,
  fretesBase,
  insumosMap,
  fornecedoresMap,
  crossFilters,
  onToggle,
  applyCrossPedidos,
  applyCrossFretes,
}: Props) {
  const pedidosAll = useMemo(() => applyCrossPedidos(pedidosBase), [pedidosBase, applyCrossPedidos]);

  // ── KPIs ──────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    let valor = 0;
    let qtd = 0;
    let pedidos = 0;
    const materiaisSet = new Set<string>();
    pedidosAll.forEach((p) => {
      const s = sumPedido(p, crossFilters.insumoId);
      valor += s.valor;
      qtd += s.qtd;
      if (s.itens > 0) pedidos += 1;
      (p.itens || []).forEach((it) => {
        if (!crossFilters.insumoId || it.insumoId === crossFilters.insumoId) materiaisSet.add(it.insumoId);
      });
    });
    return { valor, qtd, pedidos, materiais: materiaisSet.size };
  }, [pedidosAll, crossFilters.insumoId]);

  // Top material por valor (calculado de pedidosAll já filtrado, exceto pelo próprio insumoId)
  const pedidosPorMat = useMemo(() => applyCrossPedidos(pedidosBase, 'insumoId'), [pedidosBase, applyCrossPedidos]);
  const topMaterialKpi = useMemo(() => {
    const map = new Map<string, number>();
    pedidosPorMat.forEach((p) => {
      (p.itens || []).forEach((it) => {
        map.set(it.insumoId, (map.get(it.insumoId) || 0) + it.quantidade * it.valorUnitario);
      });
    });
    let topId = '';
    let topVal = 0;
    map.forEach((v, k) => {
      if (v > topVal) {
        topVal = v;
        topId = k;
      }
    });
    return { id: topId, nome: insumosMap.get(topId) || '—', valor: topVal };
  }, [pedidosPorMat, insumosMap]);

  // ── Evolução mensal de compras ────────────────────────────────────
  const pedidosPorMes = useMemo(() => applyCrossPedidos(pedidosBase, 'mes'), [pedidosBase, applyCrossPedidos]);
  const evolucaoMensal = useMemo(() => {
    const map = new Map<string, { valor: number; qtdPedidos: number; qtdItens: number }>();
    pedidosPorMes.forEach((p) => {
      if (!p.data) return;
      const ym = p.data.slice(0, 7);
      const s = sumPedido(p, crossFilters.insumoId);
      if (s.itens === 0) return;
      const prev = map.get(ym) || { valor: 0, qtdPedidos: 0, qtdItens: 0 };
      map.set(ym, {
        valor: prev.valor + s.valor,
        qtdPedidos: prev.qtdPedidos + 1,
        qtdItens: prev.qtdItens + s.qtd,
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
          qtdPedidos: d.qtdPedidos,
          qtdItens: Math.round(d.qtdItens),
        };
      });
  }, [pedidosPorMes, crossFilters.insumoId]);

  // ── Top fornecedores ──────────────────────────────────────────────
  const pedidosPorForn = useMemo(() => applyCrossPedidos(pedidosBase, 'fornecedorId'), [pedidosBase, applyCrossPedidos]);
  const topFornecedores = useMemo(() => {
    const map = new Map<string, { valor: number; pedidos: number; qtd: number }>();
    pedidosPorForn.forEach((p) => {
      if (!p.fornecedorId) return;
      const s = sumPedido(p, crossFilters.insumoId);
      if (s.itens === 0) return;
      const prev = map.get(p.fornecedorId) || { valor: 0, pedidos: 0, qtd: 0 };
      map.set(p.fornecedorId, {
        valor: prev.valor + s.valor,
        pedidos: prev.pedidos + 1,
        qtd: prev.qtd + s.qtd,
      });
    });
    return Array.from(map.entries())
      .map(([id, d]) => ({ id, nome: fornecedoresMap.get(id) || id, ...d }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);
  }, [pedidosPorForn, fornecedoresMap, crossFilters.insumoId]);

  // ── Top materiais comprados (R$) ──────────────────────────────────
  const topMateriais = useMemo(() => {
    const map = new Map<string, { valor: number; qtd: number; ultimoPreco: number; ultimaData: string }>();
    pedidosPorMat.forEach((p) => {
      (p.itens || []).forEach((it) => {
        const prev = map.get(it.insumoId) || { valor: 0, qtd: 0, ultimoPreco: 0, ultimaData: '' };
        const novo = {
          valor: prev.valor + it.quantidade * it.valorUnitario,
          qtd: prev.qtd + it.quantidade,
          ultimoPreco: prev.ultimaData < (p.data || '') && it.valorUnitario > 0 ? it.valorUnitario : prev.ultimoPreco,
          ultimaData: prev.ultimaData < (p.data || '') ? p.data || '' : prev.ultimaData,
        };
        map.set(it.insumoId, novo);
      });
    });
    return Array.from(map.entries())
      .map(([id, d]) => {
        const qtdLabel = d.qtd >= 1000
          ? `${(d.qtd / 1000).toFixed(1)}k`
          : d.qtd.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
        return {
          id,
          nome: insumosMap.get(id) || id,
          valor: d.valor,
          qtd: d.qtd,
          precoMedio: d.qtd > 0 ? d.valor / d.qtd : 0,
          ultimoPreco: d.ultimoPreco,
          labelStr: `${formatCurrency(d.valor)} · ${qtdLabel}`,
        };
      })
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);
  }, [pedidosPorMat, insumosMap]);

  // ── Distribuição (donut) — top 6 + outros ─────────────────────────
  const distribuicaoMateriais = useMemo(() => {
    if (topMateriais.length === 0) return [];
    if (topMateriais.length <= 6) return topMateriais;
    const top6 = topMateriais.slice(0, 6);
    const outros = topMateriais.slice(6).reduce((s, m) => s + m.valor, 0);
    return [...top6, { id: '__outros', nome: 'Outros', valor: outros, qtd: 0, precoMedio: 0, ultimoPreco: 0 }];
  }, [topMateriais]);
  const totalDistrib = distribuicaoMateriais.reduce((s, d) => s + d.valor, 0);

  // ── Material vs Frete (correlação por insumoId) ───────────────────
  // Para os top materiais comprados, mostra: custo material (pedidos) vs custo frete (fretes)
  const fretesPorMat = useMemo(() => applyCrossFretes(fretesBase, 'insumoId'), [fretesBase, applyCrossFretes]);
  const materialVsFrete = useMemo(() => {
    const top = topMateriais.slice(0, 6);
    const freteMap = new Map<string, number>();
    fretesPorMat.forEach((f) => {
      if (!f.insumoId) return;
      freteMap.set(f.insumoId, (freteMap.get(f.insumoId) || 0) + f.valorTotal);
    });
    return top.map((m) => ({
      id: m.id,
      nome: m.nome.length > 18 ? m.nome.slice(0, 18) + '…' : m.nome,
      material: m.valor,
      frete: freteMap.get(m.id) || 0,
    }));
  }, [topMateriais, fretesPorMat]);

  return (
    <div className="space-y-4">
      {/* Cabeçalho da seção */}
      <div className="flex items-center gap-2 pt-2">
        <span
          className="inline-flex items-center justify-center h-7 w-7 rounded-md"
          style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-fg)' }}
        >
          <Boxes className="h-4 w-4" />
        </span>
        <div>
          <p className="label-eyebrow">Compras de Material</p>
          <h2 className="text-base font-semibold text-[var(--color-fg)]">Análise de Materiais</h2>
        </div>
      </div>

      {/* ── KPIs ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<ShoppingCart className="h-4 w-4" />}
          eyebrow="Total Comprado"
          value={formatCurrency(kpis.valor)}
          subtitle={`${kpis.pedidos} pedido${kpis.pedidos !== 1 ? 's' : ''} · ${kpis.materiais} material${kpis.materiais !== 1 ? 'is' : ''}`}
          tone="green"
        />
        <KpiCard
          icon={<Package className="h-4 w-4" />}
          eyebrow="Quantidade Comprada"
          value={kpis.qtd.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
          subtitle="unidades / toneladas adquiridas"
        />
        <KpiCard
          icon={<PackagePlus className="h-4 w-4" />}
          eyebrow="Pedidos Emitidos"
          value={kpis.pedidos.toString()}
          subtitle={`${kpis.materiais} materiais distintos`}
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          eyebrow="Top Material"
          value={topMaterialKpi.nome}
          subtitle={topMaterialKpi.valor > 0 ? formatCurrency(topMaterialKpi.valor) : 'Sem compras'}
          small
        />
      </div>

      {/* ── Evolução de Compras + Top Fornecedores ─────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <ChartCard
          title="Evolução de Compras"
          subtitle="Valor comprado e quantidade de pedidos por mês — clique para filtrar"
          icon={<TrendingUp className="h-4 w-4" />}
          className="xl:col-span-2"
          height={300}
        >
          {evolucaoMensal.length === 0 ? (
            <EmptyChart text="Nenhuma compra de material no período." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={evolucaoMensal} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" fontSize={11} tick={{ fill: 'var(--color-fg-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} />
                <YAxis yAxisId="left" fontSize={11} tick={{ fill: 'var(--color-fg-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false}
                  tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                <YAxis yAxisId="right" orientation="right" fontSize={11} tick={{ fill: 'var(--color-fg-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'color-mix(in srgb, var(--color-fg) 6%, transparent)' }}
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value, name) => {
                    if (name === 'Valor (R$)') return [formatCurrency(Number(value)), name];
                    return [value, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                <Bar yAxisId="left" dataKey="valor" name="Valor (R$)" radius={[6, 6, 0, 0]} cursor="pointer"
                  onClick={(e) => onToggle('mes', (e as { ym?: string }).ym || '')}
                >
                  {evolucaoMensal.map((d) => (
                    <Cell key={d.ym} fill={fillFor('#3AA368', crossFilters.mes === d.ym, !!crossFilters.mes)} />
                  ))}
                </Bar>
                <Line yAxisId="right" type="monotone" dataKey="qtdPedidos" name="Pedidos" stroke="#F7B155" strokeWidth={2} dot={{ r: 3, fill: '#F7B155' }} activeDot={{ r: 5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Top Fornecedores"
          subtitle="Por valor comprado · clique para filtrar"
          icon={<Building2 className="h-4 w-4" />}
          height={300}
        >
          {topFornecedores.length === 0 ? (
            <EmptyChart text="Sem fornecedores no período." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topFornecedores} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" fontSize={11} tick={{ fill: 'var(--color-fg-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                <YAxis dataKey="nome" type="category" fontSize={11} tick={{ fill: 'var(--color-fg-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} width={120} />
                <Tooltip cursor={{ fill: 'color-mix(in srgb, var(--color-fg) 6%, transparent)' }} contentStyle={TOOLTIP_STYLE}
                  formatter={(value, _name, item) => {
                    const p = item?.payload;
                    return [`${formatCurrency(Number(value))} · ${p?.pedidos} pedido${p?.pedidos !== 1 ? 's' : ''}`, 'Compras'];
                  }} />
                <Bar dataKey="valor" radius={[0, 6, 6, 0]} cursor="pointer"
                  onClick={(e) => onToggle('fornecedorId', (e as { id?: string }).id || '')}
                >
                  {topFornecedores.map((d, i) => (
                    <Cell key={d.id} fill={fillFor(PALETTE[i % PALETTE.length], crossFilters.fornecedorId === d.id, !!crossFilters.fornecedorId)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── Top Materiais + Distribuição ──────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <ChartCard
          title="Top Materiais Comprados"
          subtitle="Valor total e preço médio por unidade · clique para filtrar"
          icon={<Package className="h-4 w-4" />}
          className="xl:col-span-2"
          height={340}
        >
          {topMateriais.length === 0 ? (
            <EmptyChart text="Sem materiais comprados." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topMateriais} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" fontSize={11} tick={{ fill: 'var(--color-fg-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                <YAxis dataKey="nome" type="category" fontSize={11} tick={{ fill: 'var(--color-fg-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} width={140} />
                <Tooltip cursor={{ fill: 'color-mix(in srgb, var(--color-fg) 6%, transparent)' }} contentStyle={TOOLTIP_STYLE}
                  formatter={(value, _name, item) => {
                    const p = item?.payload;
                    return [
                      `${formatCurrency(Number(value))} · qtd ${Number(p?.qtd).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} · médio ${formatCurrency(p?.precoMedio || 0)}/un · último ${formatCurrency(p?.ultimoPreco || 0)}`,
                      'Compras',
                    ];
                  }} />
                <Bar dataKey="valor" radius={[0, 6, 6, 0]} cursor="pointer"
                  onClick={(e) => onToggle('insumoId', (e as { id?: string }).id || '')}
                >
                  {topMateriais.map((d, i) => (
                    <Cell key={d.id} fill={fillFor(PALETTE[i % PALETTE.length], crossFilters.insumoId === d.id, !!crossFilters.insumoId)} />
                  ))}
                  <LabelList
                    dataKey="labelStr"
                    position="right"
                    offset={6}
                    style={{ fill: 'var(--color-fg)', fontSize: 11, fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Distribuição por Material"
          subtitle="% sobre o gasto total"
          icon={<Boxes className="h-4 w-4" />}
          height={340}
        >
          {distribuicaoMateriais.length === 0 ? (
            <EmptyChart text="Sem materiais comprados." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distribuicaoMateriais}
                  dataKey="valor"
                  nameKey="nome"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                  stroke="var(--color-surface-1)"
                  strokeWidth={2}
                  cursor="pointer"
                  labelLine={false}
                  label={(props) => {
                    const cx = Number(props.cx ?? 0);
                    const cy = Number(props.cy ?? 0);
                    const midAngle = Number(props.midAngle ?? 0);
                    const innerRadius = Number(props.innerRadius ?? 0);
                    const outerRadius = Number(props.outerRadius ?? 0);
                    const percent = Number(props.percent ?? 0);
                    if (percent < 0.04) return null;
                    const RAD = Math.PI / 180;
                    const r = innerRadius + (outerRadius - innerRadius) * 0.55;
                    const x = cx + r * Math.cos(-midAngle * RAD);
                    const y = cy + r * Math.sin(-midAngle * RAD);
                    return (
                      <text
                        x={x}
                        y={y}
                        fill="#fff"
                        textAnchor="middle"
                        dominantBaseline="central"
                        style={{ fontSize: 11, fontWeight: 700, pointerEvents: 'none' }}
                      >
                        {(percent * 100).toFixed(0)}%
                      </text>
                    );
                  }}
                  onClick={(e) => {
                    const id = (e as { id?: string }).id;
                    if (id && id !== '__outros') onToggle('insumoId', id);
                  }}
                >
                  {distribuicaoMateriais.map((d, i) => (
                    <Cell key={d.id} fill={fillFor(PALETTE[i % PALETTE.length], crossFilters.insumoId === d.id, !!crossFilters.insumoId)} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value, _name, item) => {
                    const pct = totalDistrib > 0 ? (Number(value) / totalDistrib) * 100 : 0;
                    return [`${formatCurrency(Number(value))} · ${pct.toFixed(1)}%`, item?.payload?.nome];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} formatter={(v) => <span style={{ color: 'var(--color-fg-muted)' }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── Material × Frete (composto) ──────────────────────────── */}
      <ChartCard
        title="Custo Material vs Custo de Frete"
        subtitle="Top 6 materiais comprados — comparativo entre o custo de aquisição e o custo de transporte"
        icon={<TrendingUp className="h-4 w-4" />}
        height={310}
      >
        {materialVsFrete.length === 0 ? (
          <EmptyChart text="Sem dados pra comparar." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={materialVsFrete} margin={{ top: 8, right: 12, left: 4, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="nome" fontSize={11} tick={{ fill: 'var(--color-fg-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} interval={0} />
              <YAxis fontSize={11} tick={{ fill: 'var(--color-fg-muted)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                cursor={{ fill: 'color-mix(in srgb, var(--color-fg) 6%, transparent)' }}
                contentStyle={TOOLTIP_STYLE}
                formatter={(value, name) => [formatCurrency(Number(value)), name]}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
              <Bar dataKey="material" name="Material (R$)" fill="#3AA368" radius={[6, 6, 0, 0]} cursor="pointer"
                onClick={(e) => onToggle('insumoId', (e as { id?: string }).id || '')}
              />
              <Bar dataKey="frete" name="Frete (R$)" fill="#F7B155" radius={[6, 6, 0, 0]} cursor="pointer"
                onClick={(e) => onToggle('insumoId', (e as { id?: string }).id || '')}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}

// ── Subcomponentes (compartilham padrão visual com FreteAnalyticsOverview) ──

function KpiCard({
  icon,
  eyebrow,
  value,
  subtitle,
  tone,
  small,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  value: string;
  subtitle?: string;
  tone?: 'green' | 'default';
  small?: boolean;
}) {
  const accent = tone === 'green' ? 'var(--color-success)' : 'var(--color-fg)';
  return (
    <div className="card-premium elevate-top p-4 relative overflow-hidden">
      {tone === 'green' && (
        <div aria-hidden className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-25 pointer-events-none" style={{ background: 'radial-gradient(circle, var(--color-success) 0%, transparent 70%)' }} />
      )}
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <span className="label-eyebrow">{eyebrow}</span>
          <span className="inline-flex items-center justify-center h-7 w-7 rounded-md" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-fg)' }}>
            {icon}
          </span>
        </div>
        <p className={`${small ? 'text-base' : 'text-[22px]'} font-bold tracking-tight truncate`} style={{ color: accent }} title={value}>{value}</p>
        {subtitle && <p className="text-[11px] text-[var(--color-fg-subtle)] mt-1 truncate">{subtitle}</p>}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  icon,
  className = '',
  height,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
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
