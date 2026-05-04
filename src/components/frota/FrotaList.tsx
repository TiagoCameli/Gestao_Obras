import type { Equipamento, Empresa } from '../../types';
import { getCategoriaFrota } from '../../lib/frotaConstants';
import { Bell, Key, Inbox } from 'lucide-react';

interface FrotaListProps {
  equipamentos: Equipamento[];
  empresas: Empresa[];
  onSelect: (equipamento: Equipamento) => void;
  alertasMap?: Map<string, number>;
}

export default function FrotaList({
  equipamentos,
  empresas,
  onSelect,
  alertasMap = new Map(),
}: FrotaListProps) {
  const empresaMap = new Map(empresas.map((e) => [e.id, e.nome]));

  if (equipamentos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] py-16 px-6 flex flex-col items-center justify-center text-center">
        <Inbox aria-hidden className="w-10 h-10 text-[var(--color-fg-subtle)] mb-3" />
        <p className="text-sm font-medium text-[var(--color-fg)]">Nenhum equipamento</p>
        <p className="text-xs text-[var(--color-fg-muted)] mt-1">
          Ajuste os filtros ou cadastre um novo equipamento.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-surface-2)] text-[var(--color-fg-muted)]">
              <Th className="w-[110px]">Patrimônio</Th>
              <Th>Equipamento</Th>
              <Th className="hidden md:table-cell">Modelo</Th>
              <Th className="hidden md:table-cell">Marca / Ano</Th>
              <Th className="hidden lg:table-cell">N. Série</Th>
              <Th className="hidden md:table-cell">Empresa</Th>
              <Th align="center">Status</Th>
            </tr>
          </thead>
          <tbody>
            {equipamentos.map((eq) => {
              const cat = getCategoriaFrota(eq.tipo);
              const alertas = alertasMap.get(eq.id) ?? 0;
              const alugada = eq.propriedade === 'alugada';
              return (
                <tr
                  key={eq.id}
                  onClick={() => onSelect(eq)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect(eq);
                    }
                  }}
                  role="button"
                  aria-label={`Abrir detalhes de ${eq.nome}`}
                  className={
                    'cursor-pointer transition-colors border-t border-[var(--color-border)] ' +
                    'hover:bg-[var(--color-surface-2)] ' +
                    'focus-visible:outline-none focus-visible:bg-[var(--color-accent-soft)] ' +
                    (eq.ativo ? '' : 'opacity-70')
                  }
                >
                  <td className="px-4 py-3 font-mono text-xs text-[var(--color-fg-muted)]">
                    {eq.codigoPatrimonio || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        aria-hidden
                        className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg ${cat.corBg}`}
                      >
                        <span className={`text-[10px] font-bold ${cat.corTexto}`}>{cat.codigo}</span>
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-[var(--color-fg)] truncate flex items-center gap-1.5">
                          {eq.nome}
                          {alertas > 0 && (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--color-danger-soft)] text-[var(--color-danger-fg)]"
                              title={`${alertas} alerta(s) de manutenção`}
                            >
                              <Bell aria-hidden className="w-2.5 h-2.5" />
                              {alertas}
                            </span>
                          )}
                          {alugada && (
                            <span
                              className="md:hidden inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--color-warning-soft)] text-[var(--color-warning-fg)]"
                              title="Alugado"
                            >
                              <Key aria-hidden className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[var(--color-fg-subtle)] truncate md:hidden">
                          {[eq.marca, eq.modelo, eq.ano].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-fg)] hidden md:table-cell">
                    {eq.modelo || <span className="text-[var(--color-fg-subtle)]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-fg-muted)] hidden md:table-cell whitespace-nowrap">
                    {eq.marca || '—'}
                    {eq.ano && (
                      <span className="text-[var(--color-fg-subtle)]">
                        {' · '}
                        {eq.ano}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-fg-muted)] hidden lg:table-cell font-mono text-xs">
                    {eq.numeroSerie || '—'}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex items-center gap-1.5 text-[var(--color-fg-muted)]">
                      <span className="truncate max-w-[180px]">{empresaMap.get(eq.empresaId) || '—'}</span>
                      {alugada && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--color-warning-soft)] text-[var(--color-warning-fg)]"
                          title="Alugado"
                        >
                          <Key aria-hidden className="w-2.5 h-2.5" />
                          Alugado
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge ativo={eq.ativo} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  children,
  className = '',
  align = 'left',
}: {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
}) {
  return (
    <th
      className={
        'px-4 py-2.5 font-medium text-[11px] tracking-wider uppercase text-[var(--color-fg-muted)] ' +
        (align === 'center' ? 'text-center ' : align === 'right' ? 'text-right ' : 'text-left ') +
        className
      }
    >
      {children}
    </th>
  );
}

function StatusBadge({ ativo }: { ativo: boolean }) {
  return (
    <span
      className={
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ' +
        (ativo
          ? 'bg-[var(--color-success-soft)] text-[var(--color-success-fg)] border-[var(--color-success)]/30'
          : 'bg-[var(--color-danger-soft)] text-[var(--color-danger-fg)] border-[var(--color-danger)]/30')
      }
    >
      <span
        aria-hidden
        className={
          'w-1.5 h-1.5 rounded-full ' +
          (ativo ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)]')
        }
      />
      {ativo ? 'Ativo' : 'Inativo'}
    </span>
  );
}
