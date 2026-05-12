// Marco 2 / PR10 — Card resumo de OS na lista.

import type { OrdemServico, Equipamento } from '../../../types';
import {
  TIPO_OS_LABEL, PRIORIDADE_OS_LABEL, STATUS_OS_LABEL,
} from '../../../types';
import { STATUS_COLOR, PRIORIDADE_COLOR, TIPO_COLOR } from './styles';
import { Wrench, AlertTriangle, Calendar, Building2 } from 'lucide-react';

interface Props {
  os: OrdemServico;
  equipamento?: Equipamento;
  onClick?: () => void;
}

function fmtData(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s.slice(0, 10);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function diasAberta(dataAbertura: string, dataConclusao: string | null): number {
  const inicio = new Date(dataAbertura);
  const fim = dataConclusao ? new Date(dataConclusao) : new Date();
  return Math.max(0, Math.round((fim.getTime() - inicio.getTime()) / 86400000));
}

export default function OSCard({ os, equipamento, onClick }: Props) {
  const sCor = STATUS_COLOR[os.status];
  const pCor = PRIORIDADE_COLOR[os.prioridade];
  const dias = diasAberta(os.dataAbertura, os.dataConclusao);
  const aberta = !['concluida', 'cancelada'].includes(os.status);
  const equipamentoLabel = equipamento
    ? equipamento.codigoPatrimonio
      ? `${equipamento.codigoPatrimonio} · ${equipamento.nome}`
      : equipamento.nome
    : 'Equipamento não encontrado';

  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'block w-full text-left rounded-xl border-l-4 ' + TIPO_COLOR[os.tipo] +
        ' border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 ' +
        'hover:bg-[var(--color-surface-2)] hover:shadow-sm transition-all'
      }
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-medium text-[var(--color-fg-muted)]">
              {os.numero}
            </span>
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
              style={{ backgroundColor: sCor.bg, color: sCor.fg }}
            >
              <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sCor.dot }} />
              {STATUS_OS_LABEL[os.status]}
            </span>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
              style={{ backgroundColor: pCor.bg, color: pCor.fg }}
            >
              {PRIORIDADE_OS_LABEL[os.prioridade]}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]">
              <Wrench className="w-3 h-3" />
              {TIPO_OS_LABEL[os.tipo]}
            </span>
            {os.garantiaAcionada && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-info-soft)] text-[var(--color-info-fg)]">
                Garantia
              </span>
            )}
          </div>

          <h4 className="mt-1.5 text-sm font-semibold text-[var(--color-fg)] truncate">
            {equipamentoLabel}
          </h4>

          {os.defeitoReportado && (
            <p className="text-xs text-[var(--color-fg-muted)] mt-1 line-clamp-2">
              {os.defeitoReportado}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2 text-[11px] text-[var(--color-fg-subtle)] flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Calendar aria-hidden className="w-3 h-3" />
              Aberta {fmtData(os.dataAbertura)}
            </span>
            <span className="inline-flex items-center gap-1">
              <AlertTriangle aria-hidden className="w-3 h-3" />
              {aberta ? `${dias}d em aberto` : `Levou ${dias}d`}
            </span>
            {equipamento && (
              <span className="inline-flex items-center gap-1">
                <Building2 aria-hidden className="w-3 h-3" />
                {equipamento.tipo}
              </span>
            )}
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-xs text-[var(--color-fg-muted)]">Custo</div>
          <div className="text-sm font-mono font-semibold text-[var(--color-fg)]">
            {fmtBRL(os.custoTotal)}
          </div>
        </div>
      </div>
    </button>
  );
}
