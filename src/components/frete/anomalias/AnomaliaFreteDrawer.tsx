import { useMemo } from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle2, Undo2 } from 'lucide-react';
import Drawer from '../../ui/Drawer';
import Button from '../../ui/Button';
import FretesAfetadosList from './FretesAfetadosList';
import { type AnomaliaFrete, type Severidade, SEVERITY_LABEL, FRETE_DETECTOR_LABEL } from './detect';
import type { Frete } from '../../../types';
import type { AnomaliaFreteCheck } from '../../../hooks/useAnomaliasFreteChecks';

const SEVERITY_STYLES: Record<Severidade, {
  icon: typeof AlertCircle;
  badgeBg: string;
  badgeFg: string;
  iconColor: string;
}> = {
  critical: {
    icon: AlertCircle,
    badgeBg: 'bg-[var(--color-danger-soft)]',
    badgeFg: 'text-[var(--color-danger-fg)]',
    iconColor: 'text-[var(--color-danger)]',
  },
  warning: {
    icon: AlertTriangle,
    badgeBg: 'bg-[var(--color-warning-soft)]',
    badgeFg: 'text-[var(--color-warning-fg)]',
    iconColor: 'text-[var(--color-warning)]',
  },
  info: {
    icon: Info,
    badgeBg: 'bg-[var(--color-info-soft)]',
    badgeFg: 'text-[var(--color-info-fg)]',
    iconColor: 'text-[var(--color-info)]',
  },
};

interface Props {
  anomalia: AnomaliaFrete | null;
  open: boolean;
  onClose: () => void;
  fretesTodos: Frete[];
  insumoNome: Map<string, string>;
  onEditFrete: (f: Frete) => void;
  verificada?: AnomaliaFreteCheck | null;
  onMarcarVerificada?: (anomaliaId: string) => void;
  onDesfazerVerificacao?: (anomaliaId: string) => void;
}

export default function AnomaliaFreteDrawer({
  anomalia, open, onClose, fretesTodos, insumoNome, onEditFrete,
  verificada, onMarcarVerificada, onDesfazerVerificacao,
}: Props) {
  const fretesAfetados = useMemo(() => {
    if (!anomalia) return [];
    const ids = new Set(anomalia.affectedFreteIds);
    return fretesTodos.filter((f) => ids.has(f.id));
  }, [anomalia, fretesTodos]);

  if (!anomalia) return null;
  const styles = SEVERITY_STYLES[anomalia.severity];
  const Icon = styles.icon;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={anomalia.title}
      subtitle={`${FRETE_DETECTOR_LABEL[anomalia.detector]} · ${anomalia.data}`}
      width="lg"
    >
      <div className="space-y-4">
        <div className={`rounded-lg p-3 flex items-start gap-3 ${styles.badgeBg}`}>
          <Icon className={`w-5 h-5 ${styles.iconColor} shrink-0 mt-0.5`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/60 ${styles.badgeFg}`}>
                {SEVERITY_LABEL[anomalia.severity]}
              </span>
              <span className="text-[10px] font-mono text-[var(--color-fg-subtle)]">{anomalia.detector}</span>
            </div>
            <p className="text-sm text-[var(--color-fg)] mt-1">{anomalia.description}</p>
            {anomalia.acaoSugerida && (
              <p className="text-[11px] text-[var(--color-fg-muted)] italic mt-1.5">
                ↳ {anomalia.acaoSugerida}
              </p>
            )}
          </div>
        </div>

        {verificada ? (
          <div className="rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success-soft)] p-3 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[var(--color-success)] shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-success-fg)]">
                Verificada
              </div>
              <p className="text-sm text-[var(--color-fg)] mt-0.5">
                {verificada.checkedBy ? `por ${verificada.checkedBy} · ` : ''}
                {verificada.checkedAt.slice(0, 16).replace('T', ' ')}
              </p>
              {verificada.motivo && (
                <p className="text-[11px] text-[var(--color-fg-muted)] italic mt-1">
                  "{verificada.motivo}"
                </p>
              )}
            </div>
            {onDesfazerVerificacao && (
              <Button
                type="button"
                onClick={() => onDesfazerVerificacao(anomalia.id)}
                className="text-xs inline-flex items-center gap-1 shrink-0"
                variant="secondary"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Desfazer
              </Button>
            )}
          </div>
        ) : onMarcarVerificada ? (
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => onMarcarVerificada(anomalia.id)}
              className="text-xs inline-flex items-center gap-1.5"
              variant="secondary"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Marcar como verificada
            </Button>
          </div>
        ) : null}

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-fg-muted)] mb-2">
            Fretes afetados ({fretesAfetados.length})
          </div>
          <FretesAfetadosList fretes={fretesAfetados} insumoNome={insumoNome} onEditFrete={onEditFrete} />
        </div>
      </div>
    </Drawer>
  );
}
