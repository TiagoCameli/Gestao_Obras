// Marco 2 / PR10 — estilos compartilhados para chips/badges de OS.

import type { StatusOS, PrioridadeOS, TipoOS } from '../../../types';

export const STATUS_COLOR: Record<StatusOS, { bg: string; fg: string; dot: string }> = {
  rascunho: {
    bg: 'var(--color-surface-2)', fg: 'var(--color-fg-muted)', dot: 'var(--color-fg-subtle)',
  },
  aberta: {
    bg: 'var(--color-info-soft)', fg: 'var(--color-info-fg)', dot: 'var(--color-info)',
  },
  aguardando_pecas: {
    bg: 'var(--color-warning-soft)', fg: 'var(--color-warning-fg)', dot: 'var(--color-warning)',
  },
  em_execucao: {
    bg: 'var(--color-accent-soft, var(--color-info-soft))', fg: 'var(--color-accent-fg, var(--color-info-fg))',
    dot: 'var(--color-accent, var(--color-info))',
  },
  aguardando_aprovacao: {
    bg: 'var(--color-warning-soft)', fg: 'var(--color-warning-fg)', dot: 'var(--color-warning)',
  },
  concluida: {
    bg: 'var(--color-success-soft)', fg: 'var(--color-success-fg)', dot: 'var(--color-success)',
  },
  cancelada: {
    bg: 'var(--color-surface-2)', fg: 'var(--color-fg-muted)', dot: 'var(--color-fg-subtle)',
  },
};

export const PRIORIDADE_COLOR: Record<PrioridadeOS, { bg: string; fg: string }> = {
  baixa:   { bg: 'var(--color-surface-2)',     fg: 'var(--color-fg-muted)' },
  media:   { bg: 'var(--color-info-soft)',     fg: 'var(--color-info-fg)' },
  alta:    { bg: 'var(--color-warning-soft)',  fg: 'var(--color-warning-fg)' },
  critica: { bg: 'var(--color-danger-soft)',   fg: 'var(--color-danger-fg)' },
};

export const TIPO_COLOR: Record<TipoOS, string> = {
  preventiva: 'border-l-emerald-500',
  corretiva:  'border-l-rose-500',
  preditiva:  'border-l-violet-500',
  melhoria:   'border-l-sky-500',
  garantia:   'border-l-amber-500',
  recall:     'border-l-orange-600',
};
