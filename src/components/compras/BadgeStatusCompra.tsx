/**
 * Chip de status do módulo Compras — design premium SaaS.
 *
 * Cores semânticas com fundo sutil + borda firme + dot indicador.
 * Tamanho compacto pra caber em listas/tabelas/cards sem perder
 * legibilidade no dark mode (alto contraste de texto vs fundo).
 */
import type {
  StatusPedidoCompra,
  StatusCotacao,
  StatusOrdemCompra,
  StatusLancamentoFinanceiro,
} from '../../types';

type StatusUnificado =
  | StatusPedidoCompra
  | StatusCotacao
  | StatusOrdemCompra
  | StatusLancamentoFinanceiro;

interface Tema {
  bg: string;
  border: string;
  fg: string;
  dot: string;
  label: string;
}

// Premium: dark com mais contraste (-100 no texto, -900/40 no bg, -700/40 na borda).
// Light: mantém o tom claro mas com texto -800 pra peso adequado.
const TEMAS: Record<string, Tema> = {
  // Pedidos
  pendente:    { bg: 'bg-amber-50 dark:bg-amber-500/10',     border: 'border-amber-300 dark:border-amber-500/30',     fg: 'text-amber-800 dark:text-amber-100',     dot: 'bg-amber-500',     label: 'Pendente' },
  aprovado:    { bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-300 dark:border-emerald-500/30', fg: 'text-emerald-800 dark:text-emerald-100', dot: 'bg-emerald-500',   label: 'Aprovado' },
  reprovado:   { bg: 'bg-rose-50 dark:bg-rose-500/10',       border: 'border-rose-300 dark:border-rose-500/30',       fg: 'text-rose-800 dark:text-rose-100',       dot: 'bg-rose-500',      label: 'Reprovado' },
  em_cotacao:  { bg: 'bg-blue-50 dark:bg-blue-500/10',       border: 'border-blue-300 dark:border-blue-500/30',       fg: 'text-blue-800 dark:text-blue-100',       dot: 'bg-blue-500',      label: 'Em cotação' },
  cotado:      { bg: 'bg-violet-50 dark:bg-violet-500/10',   border: 'border-violet-300 dark:border-violet-500/30',   fg: 'text-violet-800 dark:text-violet-100',   dot: 'bg-violet-500',    label: 'Cotado' },
  comprado:    { bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-300 dark:border-emerald-500/30', fg: 'text-emerald-800 dark:text-emerald-100', dot: 'bg-emerald-600',   label: 'Comprado' },
  cancelado:   { bg: 'bg-rose-50 dark:bg-rose-500/10',       border: 'border-rose-300 dark:border-rose-500/30',       fg: 'text-rose-800 dark:text-rose-100',       dot: 'bg-rose-500',      label: 'Cancelado' },

  // Cotação extra
  parcial:     { bg: 'bg-sky-50 dark:bg-sky-500/10',         border: 'border-sky-300 dark:border-sky-500/30',         fg: 'text-sky-800 dark:text-sky-100',         dot: 'bg-sky-500',       label: 'Parcial' },
  cancelada:   { bg: 'bg-rose-50 dark:bg-rose-500/10',       border: 'border-rose-300 dark:border-rose-500/30',       fg: 'text-rose-800 dark:text-rose-100',       dot: 'bg-rose-500',      label: 'Cancelada' },

  // OC
  emitida:     { bg: 'bg-blue-50 dark:bg-blue-500/10',       border: 'border-blue-300 dark:border-blue-500/30',       fg: 'text-blue-800 dark:text-blue-100',       dot: 'bg-blue-500',      label: 'Emitida' },
  aprovada:    { bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-300 dark:border-emerald-500/30', fg: 'text-emerald-800 dark:text-emerald-100', dot: 'bg-emerald-500',   label: 'Aprovada' },
  entregue:    { bg: 'bg-slate-100 dark:bg-slate-500/15',    border: 'border-slate-300 dark:border-slate-500/30',     fg: 'text-slate-800 dark:text-slate-100',     dot: 'bg-slate-500',     label: 'Entregue' },
  recebida:    { bg: 'bg-slate-100 dark:bg-slate-500/15',    border: 'border-slate-300 dark:border-slate-500/30',     fg: 'text-slate-800 dark:text-slate-100',     dot: 'bg-slate-500',     label: 'Recebida' },

  // Financeiro
  nao_aplicavel:{bg: 'bg-slate-50 dark:bg-slate-500/10',     border: 'border-slate-200 dark:border-slate-500/25',     fg: 'text-slate-600 dark:text-slate-300',     dot: 'bg-slate-400',     label: 'N/A' },
  lancada:     { bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-300 dark:border-emerald-500/30', fg: 'text-emerald-800 dark:text-emerald-100', dot: 'bg-emerald-500',   label: 'Lançada' },
};

const TEMA_FALLBACK: Tema = {
  bg: 'bg-slate-50 dark:bg-slate-500/10',
  border: 'border-slate-200 dark:border-slate-500/25',
  fg: 'text-slate-700 dark:text-slate-200',
  dot: 'bg-slate-400',
  label: 'Desconhecido',
};

interface BadgeProps {
  status: StatusUnificado | string;
  size?: 'xs' | 'sm';
  /** Sobrescreve o label padrão do tema */
  label?: string;
  className?: string;
}

export default function BadgeStatusCompra({
  status,
  size = 'sm',
  label,
  className = '',
}: BadgeProps) {
  const tema = TEMAS[status] ?? TEMA_FALLBACK;
  const sizes = size === 'xs'
    ? 'px-2 py-0.5 text-[10.5px] tracking-wide'
    : 'px-2.5 py-[3px] text-[11.5px] tracking-wide';

  return (
    <span
      className={
        'inline-flex items-center gap-1.5 rounded-full font-semibold border ' +
        `${tema.bg} ${tema.border} ${tema.fg} ${sizes} ${className}`
      }
    >
      <span className={`w-1.5 h-1.5 rounded-full ${tema.dot} shrink-0`} aria-hidden="true" />
      {label ?? tema.label}
    </span>
  );
}
