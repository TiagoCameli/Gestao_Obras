/**
 * VisaoGeralFinanceiro — Dashboard simples do módulo Financeiro.
 *
 * Mostra (a partir de hoje):
 *   - Total a pagar (todas parcelas em aberto)
 *   - Vencidos (parcelas em_aberto com data < hoje)
 *   - Vence nos próximos 7 dias
 *   - Pago no mês corrente
 *   - Lista das próximas parcelas a vencer (até 10)
 *   - Top 5 fornecedores com maior valor em aberto
 *
 * Tudo derivado dos lançamentos carregados em memória — sem queries extras.
 */
import { useMemo } from 'react';
import {
  Banknote, AlertTriangle, TrendingUp, Calendar, Users, ChevronRight,
} from 'lucide-react';
import type {
  LancamentoFinanceiro,
  Fornecedor,
} from '../../types';

interface Props {
  lancamentos: LancamentoFinanceiro[];
  fornecedores: Fornecedor[];
}

function fmtMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtData(s: string): string {
  if (!s) return '—';
  try { return new Date(s + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }); }
  catch { return s; }
}
function diasAteHoje(dataIso: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(dataIso + 'T00:00');
  return Math.floor((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

export default function VisaoGeralFinanceiro({ lancamentos, fornecedores }: Props) {
  const fornecedoresMap = useMemo(() => new Map(fornecedores.map((f) => [f.id, f])), [fornecedores]);

  const stats = useMemo(() => {
    let totalAPagar = 0;
    let totalVencido = 0;
    let totalProx7d = 0;
    let totalPagoMes = 0;

    const proximasParcelas: Array<{
      lanc: LancamentoFinanceiro;
      parcela: LancamentoFinanceiro['parcelas'][0];
      diasAtraso: number;
    }> = [];

    const aPagarPorFornecedor = new Map<string, number>();

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const inicioMesIso = inicioMes.toISOString().slice(0, 10);

    for (const l of lancamentos) {
      if (l.status === 'cancelado') continue;
      for (const p of l.parcelas) {
        if (p.status === 'em_aberto') {
          totalAPagar += p.valor;
          const dias = diasAteHoje(p.dataVencimento);
          if (dias < 0) totalVencido += p.valor;
          if (dias >= 0 && dias <= 7) totalProx7d += p.valor;
          proximasParcelas.push({ lanc: l, parcela: p, diasAtraso: dias });
          const fId = l.fornecedorId ?? `_${l.favorecidoNome ?? 'sem'}`;
          aPagarPorFornecedor.set(fId, (aPagarPorFornecedor.get(fId) ?? 0) + p.valor);
        }
        if (p.status === 'pago' && p.dataPagamento && p.dataPagamento >= inicioMesIso) {
          totalPagoMes += p.valorPago ?? p.valor;
        }
      }
    }

    proximasParcelas.sort((a, b) => a.parcela.dataVencimento.localeCompare(b.parcela.dataVencimento));

    const topFornecedores = Array.from(aPagarPorFornecedor.entries())
      .map(([id, valor]) => ({
        id,
        nome: id.startsWith('_') ? id.slice(1) : fornecedoresMap.get(id)?.nome ?? '(sem fornecedor)',
        valor,
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);

    return {
      totalAPagar,
      totalVencido,
      totalProx7d,
      totalPagoMes,
      proximasParcelas: proximasParcelas.slice(0, 10),
      topFornecedores,
    };
  }, [lancamentos, fornecedoresMap]);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<Banknote className="w-5 h-5" />}
          label="Total a pagar"
          valor={fmtMoeda(stats.totalAPagar)}
          color="default"
        />
        <KpiCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Vencidos"
          valor={fmtMoeda(stats.totalVencido)}
          color={stats.totalVencido > 0 ? 'danger' : 'default'}
        />
        <KpiCard
          icon={<Calendar className="w-5 h-5" />}
          label="Vence em 7 dias"
          valor={fmtMoeda(stats.totalProx7d)}
          color={stats.totalProx7d > 0 ? 'warning' : 'default'}
        />
        <KpiCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Pago no mês"
          valor={fmtMoeda(stats.totalPagoMes)}
          color="success"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Próximas parcelas */}
        <section>
          <header className="flex items-center justify-between mb-2">
            <h3 className="text-[13px] font-semibold tracking-tight text-[var(--color-fg)] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[var(--color-fg-muted)]" />
              Próximas a vencer
            </h3>
            <span className="text-[11.5px] text-[var(--color-fg-muted)]">
              {stats.proximasParcelas.length} parcela{stats.proximasParcelas.length === 1 ? '' : 's'}
            </span>
          </header>
          {stats.proximasParcelas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] p-6 text-center text-[12.5px] text-[var(--color-fg-muted)]">
              Sem parcelas em aberto.
            </div>
          ) : (
            <ul className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] divide-y divide-[var(--color-border)]">
              {stats.proximasParcelas.map(({ lanc, parcela, diasAtraso }) => {
                const fornec = lanc.fornecedorId ? fornecedoresMap.get(lanc.fornecedorId)?.nome : lanc.favorecidoNome;
                return (
                  <li key={parcela.id} className="px-3 py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-medium text-[var(--color-fg)] truncate">
                        {fornec || '(sem fornecedor)'}
                      </div>
                      <div className="text-[11px] text-[var(--color-fg-muted)] truncate">
                        {lanc.numero} · {lanc.descricao || '—'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[12.5px] font-semibold text-[var(--color-fg)] tabular-nums">
                        {fmtMoeda(parcela.valor)}
                      </div>
                      <div
                        className={
                          'text-[10.5px] tabular-nums ' +
                          (diasAtraso < 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : diasAtraso <= 3
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-[var(--color-fg-muted)]')
                        }
                      >
                        {fmtData(parcela.dataVencimento)}
                        {' · '}
                        {diasAtraso < 0
                          ? `${Math.abs(diasAtraso)}d vencida`
                          : diasAtraso === 0
                            ? 'hoje'
                            : `em ${diasAtraso}d`}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Top fornecedores */}
        <section>
          <header className="flex items-center justify-between mb-2">
            <h3 className="text-[13px] font-semibold tracking-tight text-[var(--color-fg)] flex items-center gap-2">
              <Users className="w-4 h-4 text-[var(--color-fg-muted)]" />
              Top fornecedores em aberto
            </h3>
            <span className="text-[11.5px] text-[var(--color-fg-muted)]">
              {stats.topFornecedores.length} fornecedor{stats.topFornecedores.length === 1 ? '' : 'es'}
            </span>
          </header>
          {stats.topFornecedores.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] p-6 text-center text-[12.5px] text-[var(--color-fg-muted)]">
              Nada em aberto.
            </div>
          ) : (
            <ul className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] divide-y divide-[var(--color-border)]">
              {stats.topFornecedores.map((f, i) => {
                const pct = stats.totalAPagar > 0 ? (f.valor / stats.totalAPagar) * 100 : 0;
                return (
                  <li key={f.id} className="px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12.5px] font-medium text-[var(--color-fg)] truncate">
                        <span className="text-[var(--color-fg-subtle)] mr-1.5">#{i + 1}</span>
                        {f.nome}
                      </span>
                      <span className="text-[12.5px] font-semibold text-[var(--color-fg)] tabular-nums">
                        {fmtMoeda(f.valor)}
                      </span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--color-accent)]"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Sugestão de ação */}
      {stats.totalVencido > 0 && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50/70 dark:bg-rose-500/[0.06] p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-rose-900 dark:text-rose-100">
              Você tem {fmtMoeda(stats.totalVencido)} em parcelas vencidas
            </div>
            <p className="text-[12px] text-rose-800/80 dark:text-rose-200/80 mt-0.5">
              Acesse <strong>Contas a Pagar</strong> pra ver os detalhes e regularizar.
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-1" />
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icon, label, valor, color,
}: {
  icon: React.ReactNode;
  label: string;
  valor: string;
  color: 'default' | 'success' | 'warning' | 'danger';
}) {
  const colorClasses = {
    default: 'text-[var(--color-fg)]',
    success: 'text-emerald-700 dark:text-emerald-400',
    warning: 'text-amber-700 dark:text-amber-400',
    danger: 'text-rose-700 dark:text-rose-400',
  };
  const iconBg = {
    default: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]',
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    danger: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  };
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-9 h-9 rounded-lg inline-flex items-center justify-center ${iconBg[color]}`}>
          {icon}
        </div>
        <span className="text-[11.5px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold">
          {label}
        </span>
      </div>
      <div className={`text-xl font-semibold tabular-nums tracking-tight ${colorClasses[color]}`}>
        {valor}
      </div>
    </div>
  );
}
