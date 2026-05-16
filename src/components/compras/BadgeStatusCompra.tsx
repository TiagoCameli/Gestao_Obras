/**
 * Chip de status do módulo Compras — design "premium SaaS".
 *
 * Cores semânticas com fundo translúcido + borda sutil. Tamanho compacto pra
 * caber em listas/tabelas/cards.
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

const TEMAS: Record<string, Tema> = {
  // Pedidos
  pendente:    { bg: 'bg-amber-50 dark:bg-amber-950/40',    border: 'border-amber-200 dark:border-amber-800/60',   fg: 'text-amber-900 dark:text-amber-200',   dot: 'bg-amber-500',   label: 'Pendente' },
  aprovado:    { bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-200 dark:border-emerald-800/60',fg: 'text-emerald-900 dark:text-emerald-200',dot: 'bg-emerald-500',label: 'Aprovado' },
  reprovado:   { bg: 'bg-rose-50 dark:bg-rose-950/40',      border: 'border-rose-200 dark:border-rose-800/60',     fg: 'text-rose-900 dark:text-rose-200',     dot: 'bg-rose-500',    label: 'Reprovado' },
  em_cotacao:  { bg: 'bg-blue-50 dark:bg-blue-950/40',      border: 'border-blue-200 dark:border-blue-800/60',     fg: 'text-blue-900 dark:text-blue-200',     dot: 'bg-blue-500',    label: 'Em cotação' },
  cotado:      { bg: 'bg-violet-50 dark:bg-violet-950/40',  border: 'border-violet-200 dark:border-violet-800/60', fg: 'text-violet-900 dark:text-violet-200', dot: 'bg-violet-500',  label: 'Cotado' },
  comprado:    { bg: 'bg-emerald-50 dark:bg-emerald-950/40',border: 'border-emerald-200 dark:border-emerald-800/60',fg: 'text-emerald-900 dark:text-emerald-200',dot: 'bg-emerald-600',label: 'Comprado' },
  cancelado:   { bg: 'bg-rose-50 dark:bg-rose-950/40',      border: 'border-rose-200 dark:border-rose-800/60',     fg: 'text-rose-900 dark:text-rose-200',     dot: 'bg-rose-500',    label: 'Cancelado' },

  // Cotação extra
  parcial:     { bg: 'bg-sky-50 dark:bg-sky-950/40',        border: 'border-sky-200 dark:border-sky-800/60',       fg: 'text-sky-900 dark:text-sky-200',       dot: 'bg-sky-500',     label: 'Parcial' },
  cancelada:   { bg: 'bg-rose-50 dark:bg-rose-950/40',      border: 'border-rose-200 dark:border-rose-800/60',     fg: 'text-rose-900 dark:text-rose-200',     dot: 'bg-rose-500',    label: 'Cancelada' },

  // OC
  emitida:     { bg: 'bg-blue-50 dark:bg-blue-950/40',      border: 'border-blue-200 dark:border-blue-800/60',     fg: 'text-blue-900 dark:text-blue-200',     dot: 'bg-blue-500',    label: 'Emitida' },
  aprovada:    { bg: 'bg-emerald-50 dark:bg-emerald-950/40',border: 'border-emerald-200 dark:border-emerald-800/60',fg: 'text-emerald-900 dark:text-emerald-200',dot: 'bg-emerald-500',label: 'Aprovada' },
  entregue:    { bg: 'bg-slate-50 dark:bg-slate-900/60',    border: 'border-slate-200 dark:border-slate-700',      fg: 'text-slate-900 dark:text-slate-100',   dot: 'bg-slate-500',   label: 'Entregue' },
  recebida:    { bg: 'bg-slate-50 dark:bg-slate-900/60',    border: 'border-slate-200 dark:border-slate-700',      fg: 'text-slate-900 dark:text-slate-100',   dot: 'bg-slate-500',   label: 'Recebida' },

  // Financeiro
  nao_aplicavel:{bg: 'bg-slate-50 dark:bg-slate-900/40',    border: 'border-slate-200 dark:border-slate-700',      fg: 'text-slate-700 dark:text-slate-300',   dot: 'bg-slate-400',   label: 'N/A' },
  lancada:     { bg: 'bg-emerald-50 dark:bg-emerald-950/40',border: 'border-emerald-200 dark:border-emerald-800/60',fg: 'text-emerald-900 dark:text-emerald-200',dot: 'bg-emerald-500',label: 'Lançada' },
};

const TEMA_FALLBACK: Tema = {
  bg: 'bg-slate-50 dark:bg-slate-900/40',
  border: 'border-slate-200 dark:border-slate-700',
  fg: 'text-slate-700 dark:text-slate-300',
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
  const sizes = size === 'xs' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-xs';

  return (
    <span
      className={
        'inline-flex items-center gap-1.5 rounded-full font-medium border ' +
        `${tema.bg} ${tema.border} ${tema.fg} ${sizes} ${className}`
      }
    >
      <span className={`w-1.5 h-1.5 rounded-full ${tema.dot}`} aria-hidden="true" />
      {label ?? tema.label}
    </span>
  );
}
