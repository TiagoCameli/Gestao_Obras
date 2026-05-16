/**
 * VisaoGeralCompras — Dashboard premium do módulo Compras.
 *
 * Estrutura:
 *  ┌──────────────────────────────────────────────────────────────────┐
 *  │  6 KPI Cards (grid responsivo)                                    │
 *  ├────────────────────────────────────┬─────────────────────────────┤
 *  │  📋 Aguardando minha aprovação      │  💰 Aguardando financeiro    │
 *  │  (pedidos pendentes)                │  (OCs aprovadas s/ lançam.) │
 *  ├────────────────────────────────────┴─────────────────────────────┤
 *  │  📈 Gasto mensal (últimos 12 meses)                              │
 *  ├──────────────────────────┬───────────────────────────────────────┤
 *  │  🏗️ Gasto por obra        │  🥇 Top 5 fornecedores                │
 *  └──────────────────────────┴───────────────────────────────────────┘
 */
import { useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import {
  ClipboardList, Send, Package, ShoppingCart, Banknote, TrendingUp,
  CheckCircle2, ArrowRight,
} from 'lucide-react';
import type {
  PedidoCompra, Cotacao, OrdemCompra, Obra, Fornecedor,
} from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import BadgeStatusCompra from './BadgeStatusCompra';

interface Props {
  pedidos: PedidoCompra[];
  cotacoes: Cotacao[];
  ordens: OrdemCompra[];
  obras: Obra[];
  fornecedores: Fornecedor[];
  /** Vai pra aba Pedidos com o pedido em foco */
  onAbrirPedido: (p: PedidoCompra) => void;
  /** Abre modal "Gerar lançamento" */
  onGerarLancamento: (oc: OrdemCompra) => void;
  onAbrirOC: (oc: OrdemCompra) => void;
}

// ─── helpers ─────────────────────────────────────────────────────────────

function fmtMoeda(v: number, compacto: boolean = false): string {
  if (compacto && v >= 1000) {
    if (v >= 1_000_000) return 'R$ ' + (v / 1_000_000).toFixed(1).replace('.', ',') + 'M';
    if (v >= 1000) return 'R$ ' + (v / 1000).toFixed(0) + 'k';
  }
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function mesmoMesAno(dataIso: string, ref: Date): boolean {
  if (!dataIso) return false;
  const d = new Date(dataIso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

function ultimosMeses(n: number): { ano: number; mes: number; label: string }[] {
  const out: { ano: number; mes: number; label: string }[] = [];
  const base = new Date();
  base.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setMonth(d.getMonth() - i);
    out.push({
      ano: d.getFullYear(),
      mes: d.getMonth(),
      label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') + '/' + String(d.getFullYear()).slice(2),
    });
  }
  return out;
}

// ─── componente principal ───────────────────────────────────────────────

export default function VisaoGeralCompras({
  pedidos, cotacoes, ordens, obras, fornecedores,
  onAbrirPedido, onGerarLancamento, onAbrirOC,
}: Props) {
  const { temAcao } = useAuth();
  const podeAprovar = temAcao('aprovar_pedido');

  const obrasMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome])), [obras]);
  const fornecedoresMap = useMemo(() => new Map(fornecedores.map((f) => [f.id, f.nome])), [fornecedores]);

  const pedidosAtivos = useMemo(() => pedidos.filter((p) => !p.deletadoEm), [pedidos]);
  const cotacoesAtivas = useMemo(() => cotacoes.filter((c) => !c.deletadoEm), [cotacoes]);
  const ordensAtivas = useMemo(() => ordens.filter((o) => !o.deletadoEm), [ordens]);

  const hoje = new Date();
  const inicioMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);

  // ── KPIs ───────────────────────────────────────────────────────────────
  const pedidosPendentes = pedidosAtivos.filter((p) => p.status === 'pendente').length;
  const cotacoesAbertas = cotacoesAtivas.filter((c) => c.status === 'em_cotacao' || c.status === 'parcial').length;

  const ocsDoMes = ordensAtivas.filter((o) => mesmoMesAno(o.dataCriacao, hoje));
  const ocsMesAnterior = ordensAtivas.filter((o) => mesmoMesAno(o.dataCriacao, inicioMesAnterior));

  const valorMes = ocsDoMes.filter((o) => o.aprovada).reduce((s, o) => s + o.totalGeral, 0);
  const valorMesAnterior = ocsMesAnterior.filter((o) => o.aprovada).reduce((s, o) => s + o.totalGeral, 0);
  const deltaValor = valorMesAnterior > 0 ? ((valorMes - valorMesAnterior) / valorMesAnterior) * 100 : 0;

  const ocsAguardandoFinanceiro = ordensAtivas.filter(
    (o) => o.lancamentoFinanceiroStatus === 'pendente'
  );
  const valorAguardandoFinanceiro = ocsAguardandoFinanceiro.reduce((s, o) => s + o.totalGeral, 0);

  // ── Tabela: minhas pendências de aprovação ─────────────────────────────
  const minhasPendencias = useMemo(
    () => pedidosAtivos
      .filter((p) => p.status === 'pendente')
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
      .slice(0, 8),
    [pedidosAtivos]
  );

  // ── Gráfico: gasto mensal últimos 12 meses ─────────────────────────────
  const gastoMensal = useMemo(() => {
    const meses = ultimosMeses(12);
    return meses.map((m) => {
      const valor = ordensAtivas
        .filter((o) => o.aprovada)
        .filter((o) => {
          if (!o.dataCriacao) return false;
          const d = new Date(o.dataCriacao);
          return d.getFullYear() === m.ano && d.getMonth() === m.mes;
        })
        .reduce((s, o) => s + o.totalGeral, 0);
      return { mes: m.label, valor };
    });
  }, [ordensAtivas]);

  // ── Gasto por obra (top 10) ─────────────────────────────────────────────
  const gastoPorObra = useMemo(() => {
    const acc = new Map<string, number>();
    for (const oc of ordensAtivas) {
      if (!oc.aprovada || !oc.obraId) continue;
      acc.set(oc.obraId, (acc.get(oc.obraId) ?? 0) + oc.totalGeral);
    }
    return Array.from(acc.entries())
      .map(([obraId, valor]) => ({
        nome: (obrasMap.get(obraId) ?? '?').slice(0, 22),
        valor,
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);
  }, [ordensAtivas, obrasMap]);

  // ── Top 5 fornecedores ─────────────────────────────────────────────────
  const topFornecedores = useMemo(() => {
    const acc = new Map<string, { valor: number; ocs: number }>();
    for (const oc of ordensAtivas) {
      if (!oc.aprovada || !oc.fornecedorId) continue;
      const cur = acc.get(oc.fornecedorId) ?? { valor: 0, ocs: 0 };
      cur.valor += oc.totalGeral;
      cur.ocs += 1;
      acc.set(oc.fornecedorId, cur);
    }
    return Array.from(acc.entries())
      .map(([id, v]) => ({ nome: fornecedoresMap.get(id) ?? '?', ...v }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);
  }, [ordensAtivas, fornecedoresMap]);

  return (
    <div className="space-y-6">
      {/* ── KPI Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard
          icon={ClipboardList}
          label="Pedidos pendentes"
          value={pedidosPendentes.toString()}
          accent="amber"
        />
        <KpiCard
          icon={Send}
          label="Cotações em aberto"
          value={cotacoesAbertas.toString()}
          accent="blue"
        />
        <KpiCard
          icon={ShoppingCart}
          label="OCs do mês"
          value={ocsDoMes.length.toString()}
          sub={`${ocsMesAnterior.length} no mês anterior`}
          accent="violet"
        />
        <KpiCard
          icon={TrendingUp}
          label="Valor comprado (mês)"
          value={fmtMoeda(valorMes, true)}
          delta={deltaValor}
          accent="emerald"
        />
        <KpiCard
          icon={Banknote}
          label="Aguardando financeiro"
          value={ocsAguardandoFinanceiro.length.toString()}
          sub={fmtMoeda(valorAguardandoFinanceiro, true)}
          accent="orange"
        />
        <KpiCard
          icon={Package}
          label="Top fornecedor"
          value={topFornecedores[0]?.nome.slice(0, 18) ?? '—'}
          sub={topFornecedores[0] ? fmtMoeda(topFornecedores[0].valor, true) : ''}
          accent="slate"
        />
      </div>

      {/* ── Pendências ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Aguardando aprovação */}
        <Card titulo={podeAprovar ? 'Aguardando minha aprovação' : 'Pedidos pendentes'} icon={ClipboardList}>
          {minhasPendencias.length === 0 ? (
            <EmptyMini msg="Nenhum pedido aguardando." />
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {minhasPendencias.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onAbrirPedido(p)}
                  className="w-full px-1 py-2.5 flex items-center gap-3 hover:bg-[var(--color-surface-2)]/50 transition-colors group text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-[var(--color-fg-muted)]">{p.numero}</span>
                      <BadgeStatusCompra status={p.status} size="xs" />
                    </div>
                    <div className="text-sm text-[var(--color-fg)] truncate">
                      {obrasMap.get(p.obraId) ?? <span className="italic text-[var(--color-fg-subtle)]">sem obra</span>}
                      <span className="text-[var(--color-fg-muted)]"> · {p.solicitante}</span>
                    </div>
                  </div>
                  {p.valorEstimado != null && (
                    <span className="shrink-0 text-xs tabular-nums text-[var(--color-fg-muted)]">
                      {fmtMoeda(p.valorEstimado, true)}
                    </span>
                  )}
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--color-fg-subtle)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Aguardando lançamento financeiro */}
        <Card
          titulo="Aguardando lançamento financeiro"
          icon={Banknote}
          accent="amber"
          headerRight={
            ocsAguardandoFinanceiro.length > 0 && (
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 tabular-nums">
                Total: {fmtMoeda(valorAguardandoFinanceiro)}
              </span>
            )
          }
        >
          {ocsAguardandoFinanceiro.length === 0 ? (
            <EmptyMini msg="Nenhuma OC aguardando lançamento." icon={CheckCircle2} />
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {ocsAguardandoFinanceiro.slice(0, 8).map((oc) => (
                <div key={oc.id} className="px-1 py-2.5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onAbrirOC(oc)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-[var(--color-fg-muted)]">{oc.numero}</span>
                      <span className="inline-flex items-center px-1.5 h-5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-300">
                        🟠 pendente
                      </span>
                    </div>
                    <div className="text-sm text-[var(--color-fg)] truncate">
                      {fornecedoresMap.get(oc.fornecedorId) ?? '—'}
                    </div>
                  </button>
                  <span className="shrink-0 text-xs tabular-nums text-[var(--color-fg)] font-medium">
                    {fmtMoeda(oc.totalGeral, true)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onGerarLancamento(oc)}
                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                    title="Gerar lançamento financeiro"
                  >
                    <Banknote className="w-3 h-3" /> Lançar
                  </button>
                </div>
              ))}
              {ocsAguardandoFinanceiro.length > 8 && (
                <div className="text-center text-xs text-[var(--color-fg-subtle)] pt-2">
                  +{ocsAguardandoFinanceiro.length - 8} OCs
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* ── Gasto mensal ──────────────────────────────────────────── */}
      <Card titulo="Gasto mensal (últimos 12 meses)" icon={TrendingUp}>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={gastoMensal} margin={{ top: 10, right: 16, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--color-fg-muted)' }} stroke="var(--color-border)" />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--color-fg-muted)' }}
                tickFormatter={(v: number) => fmtMoeda(v, true).replace('R$ ', '')}
                stroke="var(--color-border)"
              />
              <Tooltip
                cursor={{ fill: 'var(--color-surface-2)', opacity: 0.5 }}
                contentStyle={{
                  backgroundColor: 'var(--color-surface-1)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={((v: number) => fmtMoeda(v)) as never}
                labelStyle={{ color: 'var(--color-fg)' }}
              />
              <Line
                type="monotone"
                dataKey="valor"
                stroke="var(--color-accent)"
                strokeWidth={2.5}
                dot={{ r: 3, fill: 'var(--color-accent)' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* ── Gasto por obra + Top fornecedores ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card titulo="Gasto por obra (top 8)" icon={Package}>
          {gastoPorObra.length === 0 ? (
            <EmptyMini msg="Sem dados ainda." />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gastoPorObra} layout="vertical" margin={{ top: 5, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: 'var(--color-fg-muted)' }}
                    tickFormatter={(v: number) => fmtMoeda(v, true).replace('R$ ', '')}
                    stroke="var(--color-border)"
                  />
                  <YAxis
                    type="category"
                    dataKey="nome"
                    tick={{ fontSize: 11, fill: 'var(--color-fg-muted)' }}
                    width={130}
                    stroke="var(--color-border)"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-surface-1)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={((v: number) => fmtMoeda(v)) as never}
                  />
                  <Bar dataKey="valor" fill="var(--color-accent)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card titulo="Top 5 fornecedores" icon={Package}>
          {topFornecedores.length === 0 ? (
            <EmptyMini msg="Sem fornecedores ainda." />
          ) : (
            <div className="space-y-2.5 pt-1">
              {topFornecedores.map((f, i) => {
                const max = topFornecedores[0].valor || 1;
                const pct = (f.valor / max) * 100;
                return (
                  <div key={f.nome + i} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--color-surface-2)] text-[10px] font-bold text-[var(--color-fg-muted)] shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-[var(--color-fg)] truncate font-medium">{f.nome}</span>
                      </div>
                      <span className="tabular-nums text-[var(--color-fg)] font-semibold shrink-0">
                        {fmtMoeda(f.valor, true)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                        <div
                          className="h-full bg-[var(--color-accent)] transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-[var(--color-fg-subtle)] tabular-nums">
                        {f.ocs} OC{f.ocs !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ─── auxiliares ──────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, label, value, sub, delta, accent = 'slate',
}: {
  icon: typeof ClipboardList;
  label: string;
  value: string;
  sub?: string;
  delta?: number;
  accent?: 'amber' | 'blue' | 'violet' | 'emerald' | 'orange' | 'slate';
}) {
  const accents = {
    amber:   { bg: 'bg-amber-50 dark:bg-amber-950/30',     fg: 'text-amber-600 dark:text-amber-400' },
    blue:    { bg: 'bg-blue-50 dark:bg-blue-950/30',       fg: 'text-blue-600 dark:text-blue-400' },
    violet:  { bg: 'bg-violet-50 dark:bg-violet-950/30',   fg: 'text-violet-600 dark:text-violet-400' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', fg: 'text-emerald-600 dark:text-emerald-400' },
    orange:  { bg: 'bg-orange-50 dark:bg-orange-950/30',   fg: 'text-orange-600 dark:text-orange-400' },
    slate:   { bg: 'bg-slate-50 dark:bg-slate-900/40',     fg: 'text-slate-600 dark:text-slate-400' },
  }[accent];

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3.5 shadow-[var(--shadow-xs)] hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-1.5">
        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${accents.bg} ${accents.fg}`}>
          <Icon className="w-4 h-4" />
        </span>
        {delta !== undefined && Number.isFinite(delta) && (
          <span className={
            'text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded ' +
            (delta >= 0
              ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-300'
              : 'text-rose-700 bg-rose-50 dark:bg-rose-950/30 dark:text-rose-300')
          }>
            {delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(0)}%
          </span>
        )}
      </div>
      <div className="text-xl font-bold text-[var(--color-fg)] tracking-tight tabular-nums leading-tight">
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] mt-0.5">
        {label}
      </div>
      {sub && (
        <div className="text-[10px] text-[var(--color-fg-subtle)] mt-0.5">{sub}</div>
      )}
    </div>
  );
}

function Card({
  titulo, icon: Icon, accent, headerRight, children,
}: {
  titulo: string;
  icon?: typeof ClipboardList;
  accent?: 'amber';
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  const headerCls = accent === 'amber'
    ? 'border-amber-200 dark:border-amber-800/50 bg-amber-50/40 dark:bg-amber-950/10'
    : '';
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-[var(--shadow-xs)] overflow-hidden">
      <header className={`px-4 py-2.5 border-b border-[var(--color-border)] flex items-center justify-between gap-3 ${headerCls}`}>
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-[var(--color-fg-muted)]" />}
          <h3 className="text-sm font-semibold text-[var(--color-fg)] tracking-tight">{titulo}</h3>
        </div>
        {headerRight}
      </header>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

function EmptyMini({ msg, icon: Icon = CheckCircle2 }: { msg: string; icon?: typeof CheckCircle2 }) {
  return (
    <div className="text-center py-8 text-sm text-[var(--color-fg-muted)] flex flex-col items-center gap-1.5">
      <Icon className="w-6 h-6 text-[var(--color-fg-subtle)] opacity-60" />
      {msg}
    </div>
  );
}
