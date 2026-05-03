import type { MotorSpec } from '../../types';

export interface MotorSpecDisplayProps {
  motor: MotorSpec;
  className?: string;
}

interface Linha {
  label: string;
  valor: string;
}

function montarLinhas(m: MotorSpec): Linha[] {
  const linhas: Linha[] = [];
  if (m.catModel) linhas.push({ label: 'Modelo', valor: m.catModel });
  if (m.displacementL !== undefined) {
    linhas.push({ label: 'Cilindrada', valor: `${m.displacementL} L` });
  }
  if (m.netPowerKW !== undefined) {
    const valor =
      m.netPowerHP !== undefined
        ? `${m.netPowerKW} kW (${m.netPowerHP} HP)`
        : `${m.netPowerKW} kW`;
    linhas.push({ label: 'Potência', valor });
  } else if (m.netPowerHP !== undefined) {
    linhas.push({ label: 'Potência', valor: `${m.netPowerHP} HP` });
  }
  if (m.cylinders !== undefined) {
    linhas.push({ label: 'Cilindros', valor: String(m.cylinders) });
  }
  if (m.configuration) linhas.push({ label: 'Configuração', valor: m.configuration });
  if (m.injectionType) linhas.push({ label: 'Tipo de injeção', valor: m.injectionType });
  return linhas;
}

export function MotorSpecDisplay({ motor, className = '' }: MotorSpecDisplayProps) {
  const linhas = montarLinhas(motor);
  if (linhas.length === 0) {
    return (
      <p className={'text-sm italic text-[var(--color-fg-subtle)] ' + className}>
        Sem dados de motor.
      </p>
    );
  }

  return (
    <dl
      className={
        'grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm ' + className
      }
    >
      {linhas.map((l, i) => (
        <div key={i} className="contents">
          <dt className="text-[var(--color-fg-muted)]">{l.label}</dt>
          <dd className="text-[var(--color-fg)] font-medium">{l.valor}</dd>
        </div>
      ))}
    </dl>
  );
}

export default MotorSpecDisplay;
