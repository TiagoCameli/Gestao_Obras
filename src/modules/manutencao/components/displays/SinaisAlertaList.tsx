import { AlertOctagon, AlertTriangle, Info } from 'lucide-react';
import type { SinalAlerta } from '../../types';

export interface SinaisAlertaListProps {
  sinais: SinalAlerta[];
  className?: string;
}

const ORDEM_SEVERIDADE: Record<SinalAlerta['severidade'], number> = {
  critico: 0,
  atencao: 1,
  info: 2,
};

const ESTILO: Record<
  SinalAlerta['severidade'],
  { bg: string; fg: string; border: string; Icon: typeof AlertOctagon }
> = {
  critico: {
    bg: 'var(--color-danger-soft)',
    fg: 'var(--color-danger-fg)',
    border: 'var(--color-danger)',
    Icon: AlertOctagon,
  },
  atencao: {
    bg: 'var(--color-warning-soft)',
    fg: 'var(--color-warning-fg)',
    border: 'var(--color-warning)',
    Icon: AlertTriangle,
  },
  info: {
    bg: 'var(--color-info-soft)',
    fg: 'var(--color-info-fg)',
    border: 'var(--color-info)',
    Icon: Info,
  },
};

export function SinaisAlertaList({ sinais, className = '' }: SinaisAlertaListProps) {
  if (sinais.length === 0) {
    return (
      <p className={'text-sm italic text-[var(--color-fg-subtle)] ' + className}>
        Nenhum sinal de alerta cadastrado.
      </p>
    );
  }

  const ordenados = [...sinais].sort(
    (a, b) => ORDEM_SEVERIDADE[a.severidade] - ORDEM_SEVERIDADE[b.severidade]
  );

  return (
    <ul className={'flex flex-col gap-2 ' + className}>
      {ordenados.map((s, i) => {
        const e = ESTILO[s.severidade];
        const Icon = e.Icon;
        return (
          <li
            key={i}
            className="flex items-start gap-3 px-3 py-3 rounded-xl border"
            style={{
              backgroundColor: e.bg,
              borderColor: `color-mix(in srgb, ${e.border} 30%, transparent)`,
            }}
          >
            <Icon aria-hidden className="w-5 h-5 mt-0.5 shrink-0" style={{ color: e.fg }} />
            <div className="min-w-0 flex-1">
              <h5 className="text-sm font-semibold" style={{ color: e.fg }}>
                {s.sinal}
              </h5>
              <p className="mt-1 text-xs text-[var(--color-fg)]">
                <span className="font-medium">Significado: </span>
                {s.significado}
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-fg)]">
                <span className="font-medium">Ação: </span>
                {s.acao}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default SinaisAlertaList;
