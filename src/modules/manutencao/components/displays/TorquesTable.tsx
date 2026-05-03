import { Lock } from 'lucide-react';
import type { TorqueSpec } from '../../types';

export interface TorquesTableProps {
  torques: TorqueSpec[];
  className?: string;
}

export function TorquesTable({ torques, className = '' }: TorquesTableProps) {
  if (torques.length === 0) {
    return (
      <p className={'text-sm italic text-[var(--color-fg-subtle)] ' + className}>
        Nenhum torque especificado.
      </p>
    );
  }

  return (
    <div className={'overflow-x-auto rounded-xl border border-[var(--color-border)] ' + className}>
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]">
          <tr>
            <th className="text-left font-medium px-3 py-2">Componente</th>
            <th className="text-right font-medium px-3 py-2">Nm</th>
            <th className="text-right font-medium px-3 py-2">lb-ft</th>
            <th className="text-center font-medium px-3 py-2">Trava-rosca</th>
          </tr>
        </thead>
        <tbody>
          {torques.map((t, i) => (
            <tr
              key={i}
              className={
                i % 2 === 0
                  ? 'bg-[var(--color-surface-1)]'
                  : 'bg-[var(--color-surface-2)]/50'
              }
            >
              <td className="px-3 py-2 text-[var(--color-fg)]">{t.componentName}</td>
              <td className="px-3 py-2 text-right font-mono text-[var(--color-fg)]">
                {t.torqueNm}
              </td>
              <td className="px-3 py-2 text-right font-mono text-[var(--color-fg-muted)]">
                {t.torqueLbFt ?? '—'}
              </td>
              <td className="px-3 py-2 text-center">
                {t.threadLockerRequired ? (
                  <Lock
                    aria-label="Trava-rosca obrigatório"
                    className="w-4 h-4 inline text-[var(--color-warning-fg)]"
                  />
                ) : (
                  <span className="text-[var(--color-fg-subtle)]">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default TorquesTable;
