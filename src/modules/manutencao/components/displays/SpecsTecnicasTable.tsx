import type { SpecTecnica } from '../../types';

export interface SpecsTecnicasTableProps {
  specs: SpecTecnica[];
  className?: string;
}

export function SpecsTecnicasTable({ specs, className = '' }: SpecsTecnicasTableProps) {
  if (specs.length === 0) {
    return (
      <p className={'text-sm italic text-[var(--color-fg-subtle)] ' + className}>
        Nenhuma especificação cadastrada.
      </p>
    );
  }

  return (
    <div className={'overflow-x-auto rounded-xl border border-[var(--color-border)] ' + className}>
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]">
          <tr>
            <th className="text-left font-medium px-3 py-2">Parâmetro</th>
            <th className="text-left font-medium px-3 py-2">Nominal</th>
            <th className="text-left font-medium px-3 py-2">Mín.</th>
            <th className="text-left font-medium px-3 py-2">Máx.</th>
            <th className="text-left font-medium px-3 py-2">Unidade</th>
            <th className="text-left font-medium px-3 py-2">Condição</th>
            <th className="text-left font-medium px-3 py-2">Método</th>
          </tr>
        </thead>
        <tbody>
          {specs.map((s, i) => (
            <tr
              key={i}
              title={s.observacao}
              className={
                i % 2 === 0
                  ? 'bg-[var(--color-surface-1)]'
                  : 'bg-[var(--color-surface-2)]/50'
              }
            >
              <td className="px-3 py-2 font-medium text-[var(--color-fg)]">{s.parametro}</td>
              <td className="px-3 py-2 text-[var(--color-fg)]">{s.valorNominal}</td>
              <td className="px-3 py-2 text-[var(--color-fg-muted)]">{s.valorMinimo ?? '—'}</td>
              <td className="px-3 py-2 text-[var(--color-fg-muted)]">{s.valorMaximo ?? '—'}</td>
              <td className="px-3 py-2 text-[var(--color-fg-muted)]">{s.unidade ?? '—'}</td>
              <td className="px-3 py-2 text-[var(--color-fg-muted)]">{s.condicaoMedicao ?? '—'}</td>
              <td className="px-3 py-2 text-[var(--color-fg-muted)]">{s.metodoMedicao ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default SpecsTecnicasTable;
