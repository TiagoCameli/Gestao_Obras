import type { CapacidadesSpec } from '../../types';

export interface CapacidadesDisplayProps {
  capacidades: CapacidadesSpec;
  className?: string;
}

interface Linha {
  label: string;
  valor: string;
}

function montarLinhas(c: CapacidadesSpec): Linha[] {
  const linhas: Linha[] = [];

  const add = (label: string, v?: number) => {
    if (v !== undefined && v !== null) linhas.push({ label, valor: `${v} L` });
  };

  add('Tanque de combustível', c.fuelTankL);
  add('Cárter do motor', c.engineCrankcaseL);
  add('Sistema hidráulico (total)', c.hydraulicSystemTotalL);
  add('Reservatório hidráulico', c.hydraulicTankL);
  add('Swing drive', c.swingDriveL);

  if (c.finalDriveEachL !== undefined && c.finalDriveEachL !== null) {
    if (c.finalDriveCount !== undefined && c.finalDriveCount !== null) {
      const total = c.finalDriveEachL * c.finalDriveCount;
      linhas.push({
        label: 'Comando final (cada)',
        valor: `${c.finalDriveEachL} L cada × ${c.finalDriveCount} (total ${total} L)`,
      });
    } else {
      linhas.push({ label: 'Comando final (cada)', valor: `${c.finalDriveEachL} L` });
    }
  }

  add('Transmissão', c.transmissionL);
  add('Eixo dianteiro', c.axleFrontL);
  add('Eixo traseiro', c.axleRearL);
  add('Sistema de arrefecimento', c.coolantSystemL);
  add('Diferencial', c.differentialL);

  return linhas;
}

export function CapacidadesDisplay({ capacidades, className = '' }: CapacidadesDisplayProps) {
  const linhas = montarLinhas(capacidades);
  if (linhas.length === 0) {
    return (
      <p className={'text-sm italic text-[var(--color-fg-subtle)] ' + className}>
        Sem dados de capacidade.
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

export default CapacidadesDisplay;
