import type { Equipamento, Empresa, TipoEquipamento, StatusEquipamento } from '../../types';
import { getCategoriaFrota } from '../../lib/frotaConstants';
import { Bell, Calendar, Building2, Hash, Key } from 'lucide-react';
import StatusDropdown from './StatusDropdown';

interface FrotaGridProps {
  equipamentos: Equipamento[];
  empresas: Empresa[];
  categoriaFiltro: TipoEquipamento | '';
  onSelect: (equipamento: Equipamento) => void;
  onChangeStatus?: (equipamento: Equipamento, status: StatusEquipamento, motivo: string, observacoes: string) => void;
  alertasMap?: Map<string, number>;
}

function EquipamentoCard({
  eq,
  empresaNome,
  alertas,
  onClick,
  onChangeStatus,
}: {
  eq: Equipamento;
  empresaNome: string;
  alertas: number;
  onClick: () => void;
  onChangeStatus?: (status: StatusEquipamento, motivo: string, observacoes: string) => void;
}) {
  const cat = getCategoriaFrota(eq.tipo);
  const alugada = eq.propriedade === 'alugada';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={
        'group relative text-left w-full rounded-2xl border bg-[var(--color-surface-1)] ' +
        'p-4 transition-all duration-200 cursor-pointer ' +
        'hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] hover:border-[var(--color-border-strong)] ' +
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] ' +
        (eq.status === 'fora_funcionamento' ? 'border-[var(--color-border)] opacity-75' : 'border-[var(--color-border)]')
      }
    >
      <div
        aria-hidden
        className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl ${cat.cor}`}
      />

      <div className="flex items-start justify-between gap-2 mb-3 pt-1">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wide ${cat.corBg} ${cat.corTexto}`}
        >
          {cat.codigo}
        </span>
        <div className="flex items-center gap-1.5">
          {alertas > 0 && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-bold bg-[var(--color-danger-soft)] text-[var(--color-danger-fg)]"
              title={`${alertas} alerta(s) de manutenção`}
            >
              <Bell aria-hidden className="w-3 h-3" />
              {alertas}
            </span>
          )}
          {alugada && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-[var(--color-warning-soft)] text-[var(--color-warning-fg)]">
              <Key aria-hidden className="w-3 h-3" />
              Alugado
            </span>
          )}
        </div>
      </div>

      <h3 className="font-semibold text-[15px] text-[var(--color-fg)] leading-tight line-clamp-2">
        {eq.nome}
      </h3>

      {(eq.modelo || eq.marca) && (
        <p className="mt-1 text-sm text-[var(--color-fg-muted)] truncate">
          {[eq.marca, eq.modelo].filter(Boolean).join(' · ')}
          {eq.ano && (
            <span className="text-[var(--color-fg-subtle)]">
              {' · '}
              {eq.ano}
            </span>
          )}
        </p>
      )}

      <div className="mt-3" onClick={(e) => e.stopPropagation()}>
        <StatusDropdown
          value={eq.status}
          onChange={(s, motivo, obs) => onChangeStatus?.(s, motivo, obs)}
          disabled={!onChangeStatus}
          size="sm"
          equipamentoNome={eq.nome}
        />
      </div>

      <div className="mt-3 pt-3 border-t border-[var(--color-border)] space-y-1.5">
        {eq.codigoPatrimonio && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-fg-subtle)]">
            <Hash aria-hidden className="w-3.5 h-3.5 shrink-0" />
            <span className="font-mono truncate">{eq.codigoPatrimonio}</span>
          </div>
        )}
        {empresaNome && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-fg-subtle)]">
            <Building2 aria-hidden className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{empresaNome}</span>
          </div>
        )}
        {eq.dataAquisicao && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-fg-subtle)]">
            <Calendar aria-hidden className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{formatarData(eq.dataAquisicao)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function formatarData(s: string): string {
  if (!s) return '';
  // suporta YYYY-MM-DD e DD/MM/YYYY
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [a, m, d] = s.slice(0, 10).split('-');
    return `${d}/${m}/${a}`;
  }
  return s;
}

export default function FrotaGrid({
  equipamentos,
  empresas,
  categoriaFiltro,
  onSelect,
  onChangeStatus,
  alertasMap = new Map(),
}: FrotaGridProps) {
  const empresaMap = new Map(empresas.map((e) => [e.id, e.nome]));

  if (categoriaFiltro) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {equipamentos.map((eq) => (
          <EquipamentoCard
            key={eq.id}
            eq={eq}
            empresaNome={empresaMap.get(eq.empresaId) ?? ''}
            alertas={alertasMap.get(eq.id) ?? 0}
            onClick={() => onSelect(eq)}
            onChangeStatus={onChangeStatus ? (s, motivo, obs) => onChangeStatus(eq, s, motivo, obs) : undefined}
          />
        ))}
      </div>
    );
  }

  const grupos = new Map<string, Equipamento[]>();
  for (const eq of equipamentos) {
    const key = eq.tipo || 'Outros';
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(eq);
  }

  const gruposOrdenados = Array.from(grupos.entries()).sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])
  );

  return (
    <div className="space-y-8">
      {gruposOrdenados.map(([tipo, eqs]) => {
        const cat = getCategoriaFrota(tipo as Equipamento['tipo']);
        return (
          <section key={tipo}>
            <header className="flex items-center gap-3 mb-4">
              <span
                className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${cat.corBg}`}
                aria-hidden
              >
                <span className={`text-[11px] font-bold ${cat.corTexto}`}>{cat.codigo}</span>
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-[var(--color-fg)] leading-tight">
                  {cat.label}
                </h3>
                <p className="text-xs text-[var(--color-fg-muted)]">
                  {eqs.length} equipamento{eqs.length === 1 ? '' : 's'}
                </p>
              </div>
            </header>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {eqs.map((eq) => (
                <EquipamentoCard
                  key={eq.id}
                  eq={eq}
                  empresaNome={empresaMap.get(eq.empresaId) ?? ''}
                  alertas={alertasMap.get(eq.id) ?? 0}
                  onClick={() => onSelect(eq)}
                  onChangeStatus={onChangeStatus ? (s, motivo, obs) => onChangeStatus(eq, s, motivo, obs) : undefined}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
