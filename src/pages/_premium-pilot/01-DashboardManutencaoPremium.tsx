/**
 * PILOT 01 — Dashboard de Manutenção (Premium)
 * ---------------------------------------------
 * Refatora `src/components/manutencao/DashboardManutencao.tsx` (464 LOC).
 *
 * Melhorias visíveis vs versão atual:
 *  1. PageHeader unificado (eyebrow + h1 + description + actions)
 *  2. KPIs em 2 níveis: 3 hero KPIs grandes + 8 KPIs compactos abaixo
 *  3. Delta chips (↑↓%) em cada hero KPI — inverte cor por "good vs bad"
 *  4. Skeleton loading no formato exato do conteúdo (não <p>Carregando…</p>)
 *  5. Empty state estruturado com ícone + CTA (não div sem hierarquia)
 *  6. Eyebrow labels via .label-eyebrow (CSS utility) em vez de classes ad-hoc
 *  7. Chart card com header (título + ação "Exportar este gráfico")
 *  8. Tokens semânticos puros — zero text-gray-*, text-emt-verde
 *
 * Demo data: mock inline. Substituir pelos hooks reais (useDashboardManutencao etc).
 */
import { useState } from 'react';
import {
  ClipboardList, AlertTriangle, Clock, Wrench, TrendingUp,
  DollarSign, CalendarClock, Package, HardHat, FileDown, Plus,
  ChevronRight, ArrowUp, ArrowDown, Minus, BarChart3, type LucideIcon,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

/* ============================================================================
 * Stubs (em produção viram ui/PageHeader, ui/Skeleton, ui/EmptyState, ui/KPICard)
 * ============================================================================ */

function PageHeader({
  eyebrow, title, description, actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
      <div className="min-w-0">
        {eyebrow && <p className="label-eyebrow mb-1">{eyebrow}</p>}
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--color-fg)]">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-[var(--color-fg-muted)] mt-1 max-w-2xl">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </header>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-[var(--color-surface-2)] ${className}`} />
  );
}

function Button({
  children, variant = 'primary', size = 'md', onClick, type = 'button', disabled, loading,
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  loading?: boolean;
}) {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-md transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)] disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = { sm: 'h-8 px-2.5 text-xs', md: 'h-9 px-3 text-sm', lg: 'h-10 px-4 text-sm' }[size];
  const variants = {
    primary: 'bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] hover:bg-[var(--color-accent-hover)] shadow-[var(--shadow-xs)]',
    secondary: 'bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)]',
    ghost: 'text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]',
    danger: 'bg-[var(--color-danger)] text-white hover:opacity-90',
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} className={`${base} ${sizes} ${variants}`} aria-busy={loading}>
      {children}
    </button>
  );
}

function EmptyState({
  icon: Icon = ClipboardList, title, description, action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="surface-raised p-10 text-center">
      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center">
        <Icon className="w-6 h-6 text-[var(--color-fg-subtle)]" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-[var(--color-fg)]">{title}</p>
      {description && (
        <p className="text-xs text-[var(--color-fg-muted)] mt-1 max-w-sm mx-auto">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function KPICard({
  label, valor, legenda, delta, deltaPositiveMeans = 'good',
  icon: Icon, intent = 'neutral', size = 'compact', onClick,
}: {
  label: string;
  valor: string | number;
  legenda?: string;
  delta?: { value: number; period?: string };
  deltaPositiveMeans?: 'good' | 'bad';
  icon?: LucideIcon;
  intent?: 'neutral' | 'success' | 'danger' | 'warning' | 'info';
  size?: 'hero' | 'compact';
  onClick?: () => void;
}) {
  const intentBg = {
    neutral: 'bg-[var(--color-surface-2)] text-[var(--color-fg)]',
    success: 'bg-[var(--color-success-soft)] text-[var(--color-success-fg)]',
    danger:  'bg-[var(--color-danger-soft)] text-[var(--color-danger-fg)]',
    warning: 'bg-[var(--color-warning-soft)] text-[var(--color-warning-fg)]',
    info:    'bg-[var(--color-info-soft)] text-[var(--color-info-fg)]',
  }[intent];

  const deltaIsGood = (delta?.value ?? 0) === 0 ? null
    : (delta!.value > 0 ? deltaPositiveMeans === 'good' : deltaPositiveMeans === 'bad');

  const Tag = onClick ? 'button' : 'div';
  const valueClass = size === 'hero'
    ? 'text-3xl sm:text-4xl font-semibold tabular-nums tracking-tight'
    : 'text-xl font-semibold tabular-nums tracking-snug';

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={
        `surface-raised text-left flex items-start gap-3 transition-all duration-[var(--dur-fast)] ` +
        (size === 'hero' ? 'p-5 ' : 'p-3.5 ') +
        (onClick ? 'hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-sm)] cursor-pointer ' : '')
      }
    >
      {Icon && (
        <div className={`${size === 'hero' ? 'w-11 h-11' : 'w-9 h-9'} rounded-lg flex items-center justify-center shrink-0 ${intentBg}`}>
          <Icon className={size === 'hero' ? 'w-5 h-5' : 'w-4 h-4'} aria-hidden />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="label-eyebrow truncate">{label}</p>
        <p className={`${valueClass} text-[var(--color-fg)] mt-1`}>{valor}</p>
        {(legenda || delta) && (
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {delta && (
              <span className={
                'inline-flex items-center gap-0.5 text-2xs font-semibold tabular-nums ' +
                (deltaIsGood === null
                  ? 'text-[var(--color-fg-muted)]'
                  : deltaIsGood ? 'text-[var(--color-success-fg)]' : 'text-[var(--color-danger-fg)]')
              }>
                {delta.value > 0 ? <ArrowUp className="w-3 h-3" />
                  : delta.value < 0 ? <ArrowDown className="w-3 h-3" />
                  : <Minus className="w-3 h-3" />}
                {Math.abs(delta.value).toFixed(1)}%
                {delta.period && <span className="font-normal text-[var(--color-fg-subtle)] ml-0.5">vs {delta.period}</span>}
              </span>
            )}
            {legenda && (
              <span className="text-2xs text-[var(--color-fg-subtle)] truncate">{legenda}</span>
            )}
          </div>
        )}
      </div>
    </Tag>
  );
}

/* ============================================================================
 * Mock data (em produção vem dos hooks)
 * ============================================================================ */

const MOCK_KPIS = {
  osAbertas: 14, osCriticas: 3, osAtrasadas: 5,
  mttrHoras: 4.2, custoMes: 84500, custoAno: 980000,
  percCorretivoAno: 32, osConcluidasMes: 18,
};

const MOCK_PROXIMAS = { vencidas: 2, proximas30: 7, total: 18 };
const MOCK_CHECKLISTS = { total: 3, bloqueados: 1, comPendencias: 2, totalCriticos: 4 };
const MOCK_PECAS = { criticas: 5, zeradas: 2, abaixoMin: 3, total: 287 };

const MOCK_CUSTO_MENSAL = Array.from({ length: 12 }, (_, i) => {
  const month = new Date(2025, 5 + i, 1).toISOString().slice(0, 7);
  return {
    mes: month,
    Corretiva: 10000 + Math.random() * 50000,
    Preventiva: 5000 + Math.random() * 25000,
    Preditiva: 1000 + Math.random() * 8000,
  };
});

const MOCK_TOP_CUSTO = Array.from({ length: 5 }, (_, i) => ({
  equipamentoId: `eq-${i}`,
  equipamentoNome: ['Escavadeira CAT 320', 'Pá-carregadeira Volvo L120', 'Caminhão MB Axor 2544', 'Motoniveladora 14M', 'Rolo compactador HAMM'][i],
  tipo: ['Escavadeira', 'Carregadeira', 'Caminhão', 'Motoniveladora', 'Rolo'][i],
  custoTotal: 180000 - i * 28000,
  numOS: 12 - i,
}));

const CHART_COLORS = ['#2D7F4F', '#F79009', '#2563EB', '#D92D20', '#7C3AED'];

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}
function fmtMes(s: string) {
  const [a, m] = s.split('-');
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  return `${meses[parseInt(m, 10) - 1]}/${a.slice(2)}`;
}

/* ============================================================================
 * Página
 * ============================================================================ */

export default function DashboardManutencaoPremium() {
  // Demo state — descomente as linhas abaixo pra ver loading / error states
  const [isLoading] = useState(false);   // ou: useState(true) pra skeleton
  const [hasError, setHasError] = useState(false);
  const [hasData] = useState(true);
  const [exportando, setExportando] = useState<'idle' | 'mensal' | 'anual'>('idle');

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 max-w-[1400px] mx-auto">

      <PageHeader
        eyebrow="Operação"
        title="Manutenção"
        description="OS abertas, custos, MTTR e disponibilidade da frota — últimos 30 dias."
        actions={
          <>
            <Button variant="secondary" size="md" onClick={() => setExportando('mensal')}>
              <FileDown className="w-4 h-4" />
              {exportando === 'mensal' ? 'Gerando…' : 'PDF mensal'}
            </Button>
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4" />
              Nova OS
            </Button>
          </>
        }
      />

      {/* ---------- ESTADO: LOADING ---------- */}
      {isLoading && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
          <Skeleton className="h-80" />
        </div>
      )}

      {/* ---------- ESTADO: ERROR ---------- */}
      {!isLoading && hasError && (
        <div className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[var(--color-danger)] shrink-0 mt-0.5" aria-hidden />
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--color-danger-fg)]">Falha ao carregar dashboard</p>
              <p className="text-xs text-[var(--color-danger-fg)]/85 mt-1">
                Não conseguimos buscar os dados de manutenção. Verifique sua conexão.
              </p>
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setHasError(false)}>Tentar novamente</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- ESTADO: EMPTY ---------- */}
      {!isLoading && !hasError && !hasData && (
        <EmptyState
          icon={BarChart3}
          title="Sem dados consolidados ainda"
          description="Conforme OS forem concluídas, os indicadores começam a popular esta tela."
          action={<Button variant="primary"><Plus className="w-4 h-4" /> Criar primeira OS</Button>}
        />
      )}

      {/* ---------- ESTADO: SUCCESS ---------- */}
      {!isLoading && !hasError && hasData && (
        <div className="space-y-6">

          {/* Hero KPIs — 3 grandes, contam a história */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-3" aria-label="Indicadores principais">
            <KPICard
              size="hero"
              label="OS abertas"
              valor={MOCK_KPIS.osAbertas}
              delta={{ value: 12.4, period: 'mês anterior' }}
              deltaPositiveMeans="bad"
              legenda={`${MOCK_KPIS.osCriticas} crítica(s)`}
              icon={ClipboardList}
              intent="info"
              onClick={() => {}}
            />
            <KPICard
              size="hero"
              label="Custo do mês"
              valor={fmtBRL(MOCK_KPIS.custoMes)}
              delta={{ value: -8.2, period: 'mês anterior' }}
              deltaPositiveMeans="bad"
              legenda={`${MOCK_KPIS.osConcluidasMes} OS concluídas`}
              icon={DollarSign}
              intent="neutral"
            />
            <KPICard
              size="hero"
              label="MTTR"
              valor={`${MOCK_KPIS.mttrHoras.toFixed(1)} h`}
              delta={{ value: -3.4, period: 'mês anterior' }}
              deltaPositiveMeans="bad"
              legenda="médio (concluídas)"
              icon={Clock}
              intent="neutral"
            />
          </section>

          {/* Compact KPIs — 8 menores, drilldown */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3" aria-label="Indicadores secundários">
            <KPICard
              label="Atrasadas"
              valor={MOCK_KPIS.osAtrasadas}
              icon={Clock}
              intent="warning"
              onClick={() => {}}
            />
            <KPICard
              label="Custo do ano"
              valor={fmtBRL(MOCK_KPIS.custoAno)}
              icon={TrendingUp}
              intent="neutral"
              legenda="acumulado"
            />
            <KPICard
              label="% corretivo"
              valor={`${MOCK_KPIS.percCorretivoAno}%`}
              legenda="do custo anual"
              icon={Wrench}
              intent={MOCK_KPIS.percCorretivoAno > 50 ? 'danger' : MOCK_KPIS.percCorretivoAno > 30 ? 'warning' : 'success'}
            />
            <KPICard
              label="Preventivas vencidas"
              valor={MOCK_PROXIMAS.vencidas}
              legenda={`de ${MOCK_PROXIMAS.total} programadas`}
              icon={AlertTriangle}
              intent={MOCK_PROXIMAS.vencidas > 0 ? 'danger' : 'success'}
              onClick={() => {}}
            />
            <KPICard
              label="Preventivas próximas"
              valor={MOCK_PROXIMAS.proximas30}
              legenda="próx. 30 dias / 50 un."
              icon={CalendarClock}
              intent="warning"
              onClick={() => {}}
            />
            <KPICard
              label="Não-conformidades"
              valor={MOCK_CHECKLISTS.total}
              legenda={`${MOCK_CHECKLISTS.bloqueados} bloqueado · ${MOCK_CHECKLISTS.totalCriticos} crítico`}
              icon={HardHat}
              intent="danger"
              onClick={() => {}}
            />
            <KPICard
              label="Peças críticas"
              valor={MOCK_PECAS.criticas}
              legenda={`${MOCK_PECAS.zeradas} zeradas · ${MOCK_PECAS.abaixoMin} ≤ mín.`}
              icon={Package}
              intent="danger"
              onClick={() => {}}
            />
            <KPICard
              label="Total de OS"
              valor={MOCK_KPIS.osAbertas + MOCK_KPIS.osConcluidasMes}
              legenda="mês atual"
              icon={ClipboardList}
              intent="neutral"
            />
          </section>

          {/* Chart card */}
          <section className="surface-raised p-6">
            <header className="flex items-center justify-between mb-4">
              <div>
                <p className="label-eyebrow mb-1">Curva de custo</p>
                <h3 className="text-sm font-semibold text-[var(--color-fg)]">
                  Custo de manutenção por tipo · últimos 12 meses
                </h3>
              </div>
              <Button variant="ghost" size="sm">
                Exportar gráfico <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </header>

            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={MOCK_CUSTO_MENSAL} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                  <XAxis dataKey="mes" tickFormatter={fmtMes} stroke="var(--color-fg-muted)" fontSize={11} />
                  <YAxis tickFormatter={(v) => fmtBRL(v as number)} stroke="var(--color-fg-muted)" fontSize={11} />
                  <Tooltip
                    formatter={((value: number | string | undefined) => fmtBRL(Number(value ?? 0))) as never}
                    labelFormatter={((label: unknown) => fmtMes(String(label ?? ''))) as never}
                    contentStyle={{
                      backgroundColor: 'var(--color-surface-1)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 8,
                      fontSize: 12,
                      boxShadow: 'var(--shadow-md)',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {(['Corretiva', 'Preventiva', 'Preditiva'] as const).map((tipo, i) => (
                    <Line
                      key={tipo}
                      type="monotone"
                      dataKey={tipo}
                      stroke={CHART_COLORS[i]}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Top lists */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TopList
              eyebrow="Custos"
              titulo="Top 10 por custo · ano"
              icon={DollarSign}
              items={MOCK_TOP_CUSTO}
              valor={(it) => fmtBRL(it.custoTotal)}
              valorMax={Math.max(...MOCK_TOP_CUSTO.map(t => t.custoTotal))}
              legenda={(it) => `${it.numOS} OS · ${it.tipo}`}
            />
            <TopList
              eyebrow="Indisponibilidade"
              titulo="Top 10 por horas paradas"
              icon={Clock}
              items={MOCK_TOP_CUSTO.map(t => ({ ...t, custoTotal: t.custoTotal / 1000 }))}
              valor={(it) => `${(it.custoTotal).toFixed(1)} h`}
              valorMax={Math.max(...MOCK_TOP_CUSTO.map(t => t.custoTotal / 1000))}
              legenda={(it) => `${it.numOS} parada(s) · ${it.tipo}`}
            />
          </section>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------- */

function TopList<T extends { equipamentoId: string; equipamentoNome: string }>({
  eyebrow, titulo, icon: Icon, items, valor, legenda, valorMax,
}: {
  eyebrow: string;
  titulo: string;
  icon: LucideIcon;
  items: T[];
  valor: (it: T) => string;
  legenda: (it: T) => string;
  valorMax: number;
}) {
  return (
    <div className="surface-raised p-6">
      <header className="mb-3">
        <p className="label-eyebrow mb-1">{eyebrow}</p>
        <h3 className="text-sm font-semibold text-[var(--color-fg)] flex items-center gap-1.5">
          <Icon aria-hidden className="w-4 h-4 text-[var(--color-fg-muted)]" />
          {titulo}
        </h3>
      </header>
      {items.length === 0 ? (
        <EmptyState icon={BarChart3} title="Sem dados." />
      ) : (
        <ul className="space-y-1.5">
          {items.map((it, i) => {
            // Cálculo do bar fill (% do valor max)
            const numeric = parseFloat(valor(it).replace(/[^\d,.-]/g, '').replace('.', '').replace(',', '.'));
            const pct = valorMax > 0 ? Math.min(100, (numeric / valorMax) * 100) : 0;
            return (
              <li
                key={it.equipamentoId}
                className="relative rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3 flex items-center justify-between gap-3 group hover:border-[var(--color-border-strong)] transition-colors overflow-hidden"
              >
                {/* mini-bar de fundo */}
                <div
                  className="absolute inset-y-0 left-0 bg-[var(--color-accent-soft)] pointer-events-none"
                  style={{ width: `${pct}%` }}
                  aria-hidden
                />
                <div className="flex items-center gap-2.5 min-w-0 flex-1 relative">
                  <span className="text-2xs font-mono font-semibold text-[var(--color-fg-subtle)] w-5 text-right tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--color-fg)] truncate">{it.equipamentoNome}</p>
                    <p className="text-2xs text-[var(--color-fg-muted)] truncate">{legenda(it)}</p>
                  </div>
                </div>
                <strong className="text-sm font-mono font-semibold tabular-nums shrink-0 relative">
                  {valor(it)}
                </strong>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
