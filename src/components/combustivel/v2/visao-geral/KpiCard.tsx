// Card de KPI premium — ícone + label + número grande + trend chip +
// sparkline mini. Hover sobe leve. Tooltip via title attribute do
// container (acessível, simples; pra rich tooltip uso popover futuro).

import { TrendingDown, TrendingUp, Minus, type LucideIcon } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import Sparkline from '../shared/Sparkline';
import { fmtPct } from '../shared/formatters';

interface Props {
  label: string;
  /** Valor formatado pra display (string final). */
  value: ReactNode;
  /** Subtítulo abaixo do label (ex: nome do equipamento no card "Maior consumidor"). */
  hint?: string;
  /** Mudança % vs período anterior. Positivo = subiu, negativo = caiu. */
  delta?: number;
  /** Quando true, alta é ruim (ex: custo). Inverte cor do trend.
   *  Quando ausente E `neutral` true, chip vai cinza (sem julgamento). */
  invertTrend?: boolean;
  /** Trend sem cor (ex: Volume e Equipamentos — alta não é
   *  necessariamente boa nem ruim). */
  neutral?: boolean;
  /** Override do texto do chip de trend (ex: "+1 equipamento" quando
   *  base anterior é tão pequena que % engana). Cor sempre cinza. */
  trendOverride?: string;
  /** Série dos últimos N dias (mesmo KPI) — sparkline. Suprimida quando
   *  série tem <4 pontos (linha quase reta = ruído visual). */
  spark?: number[];
  /** Ícone lucide. */
  icon?: ComponentType<{ className?: string }>;
  /** Texto explicando como o KPI foi calculado (mostrado em title= pro hover nativo). */
  tooltip?: string;
  /** Quando ausência de dado, exibe placeholder em vez do valor. */
  empty?: boolean;
  /** Quando definido, transforma o card em botão clicável (navega pra
   *  outra aba, abre modal, etc). Padrão: card estático. */
  onClick?: () => void;
  /** Sobrescreve a cor do círculo do ícone — usado pra dar peso visual
   *  no KPI #6 Anomalias (vermelho se há crítica, amber se só warning,
   *  verde se 0). Padrão: 'accent' (azul). */
  accent?: 'accent' | 'danger' | 'warning' | 'success';
}

// Map accent → CSS vars do círculo do ícone. 'accent' (default) usa o
// azul institucional do app; demais usam tokens semânticos já definidos.
const ACCENT_BG: Record<NonNullable<Props['accent']>, string> = {
  accent: 'bg-[var(--color-accent-soft)]',
  danger: 'bg-[var(--color-danger-soft)]',
  warning: 'bg-[var(--color-warning-soft)]',
  success: 'bg-[var(--color-success-soft)]',
};
const ACCENT_FG: Record<NonNullable<Props['accent']>, string> = {
  accent: 'text-[var(--color-accent)]',
  danger: 'text-[var(--color-danger)]',
  warning: 'text-[var(--color-warning)]',
  success: 'text-[var(--color-success)]',
};

export default function KpiCard({
  label,
  value,
  hint,
  delta,
  invertTrend = false,
  neutral = false,
  trendOverride,
  spark,
  icon: Icon,
  tooltip,
  empty = false,
  onClick,
  accent = 'accent',
}: Props) {
  let trendNode: ReactNode = null;

  // Cor cinza neutra é o fallback quando o trend não tem leitura semântica
  // (ex: Volume — alta não é nem boa nem ruim).
  const neutralCls = 'text-[var(--color-fg-muted)] bg-[var(--color-surface-2)]';

  if (trendOverride && !empty) {
    // Override sempre cinza — usado quando base anterior é pequena demais
    // pra um % fazer sentido ("+1 equipamento" em vez de "+100%").
    trendNode = (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums ${neutralCls}`}
      >
        {trendOverride}
      </span>
    );
  } else if (typeof delta === 'number' && !empty) {
    const upIsBad = invertTrend;
    // delta vem em pontos percentuais (12 = +12%), não fração — threshold
    // de ±5pp pra considerar movimento "real" e não ruído de borda.
    const isUp = delta > 5;
    const isDown = delta < -5;
    let cls = neutralCls;
    let TrendIcon: LucideIcon = Minus;
    if (isUp) {
      cls = neutral
        ? neutralCls
        : upIsBad
          ? 'text-[var(--color-danger-fg)] bg-[var(--color-danger-soft)]'
          : 'text-[var(--color-success-fg)] bg-[var(--color-success-soft)]';
      TrendIcon = TrendingUp;
    } else if (isDown) {
      cls = neutral
        ? neutralCls
        : upIsBad
          ? 'text-[var(--color-success-fg)] bg-[var(--color-success-soft)]'
          : 'text-[var(--color-danger-fg)] bg-[var(--color-danger-soft)]';
      TrendIcon = TrendingDown;
    }
    // Clip visual: |Δ| > 200% engana mais que ajuda.
    let display: string;
    if (delta > 200) display = '+200%+';
    else if (delta < -200) display = '−200%+';
    else display = fmtPct(delta, 1);
    trendNode = (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums ${cls}`}
      >
        <TrendIcon className="w-3 h-3" strokeWidth={2.5} />
        {display}
      </span>
    );
  }

  // Quando clicável, vira <button> com cursor-pointer e ring focus visível.
  // Mantém o mesmo layout interno (apenas wrapper muda) pra preservar tipografia
  // e espaçamento. Hover já existente continua aplicando.
  const Wrapper: 'button' | 'div' = onClick ? 'button' : 'div';
  const wrapperProps = onClick
    ? {
        onClick,
        type: 'button' as const,
        className:
          'group rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-5 shadow-[var(--shadow-xs)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] cursor-pointer text-left w-full focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40',
      }
    : {
        className:
          'group rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-5 shadow-[var(--shadow-xs)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]',
      };

  return (
    <Wrapper {...wrapperProps} title={tooltip}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && (
            <div className={`w-8 h-8 rounded-full ${ACCENT_BG[accent]} flex items-center justify-center shrink-0`}>
              <Icon className={`w-4 h-4 ${ACCENT_FG[accent]}`} />
            </div>
          )}
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)] font-semibold truncate">
            {label}
          </div>
        </div>
        {spark && spark.filter((v) => v > 0).length >= 4 && !empty && (
          <Sparkline data={spark} width={60} height={24} className="shrink-0" />
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2 min-h-[36px]">
        {empty ? (
          <span className="text-[var(--color-fg-subtle)] text-sm italic">Sem dado no período</span>
        ) : (
          <span
            className="text-[28px] leading-9 font-bold text-[var(--color-fg)] tracking-tight"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {value}
          </span>
        )}
      </div>

      <div className="mt-1 flex items-center justify-between gap-2 min-h-[18px]">
        {hint ? (
          <span className="text-xs text-[var(--color-fg-muted)] truncate">{hint}</span>
        ) : (
          <span />
        )}
        {trendNode}
      </div>
    </Wrapper>
  );
}
