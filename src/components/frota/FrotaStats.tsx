import type { Equipamento } from '../../types';
import { CheckCircle2, Wrench, AlertOctagon, PowerOff, Layers } from 'lucide-react';

interface FrotaStatsProps {
  equipamentos: Equipamento[];
}

interface KPI {
  label: string;
  valor: number | string;
  hint?: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  accent: { bg: string; fg: string; border: string };
}

export default function FrotaStats({ equipamentos }: FrotaStatsProps) {
  const total = equipamentos.length;
  const ativas = equipamentos.filter((e) => e.status === 'ativa').length;
  const preventiva = equipamentos.filter((e) => e.status === 'manutencao_preventiva').length;
  const corretiva = equipamentos.filter((e) => e.status === 'manutencao_corretiva').length;
  const fora = equipamentos.filter((e) => e.status === 'fora_funcionamento').length;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const kpis: KPI[] = [
    {
      label: 'Total da frota',
      valor: total,
      hint: `${equipamentos.filter((e) => e.propriedade === 'alugada').length} alugado(s)`,
      icon: Layers,
      accent: { bg: 'var(--color-surface-2)', fg: 'var(--color-fg)', border: 'var(--color-border)' },
    },
    {
      label: 'Ativas',
      valor: ativas,
      hint: `${pct(ativas)}% da frota`,
      icon: CheckCircle2,
      accent: { bg: 'var(--color-success-soft)', fg: 'var(--color-success-fg)', border: 'var(--color-success)' },
    },
    {
      label: 'Manutenção preventiva',
      valor: preventiva,
      hint: `${pct(preventiva)}% da frota`,
      icon: Wrench,
      accent: { bg: 'var(--color-warning-soft)', fg: 'var(--color-warning-fg)', border: 'var(--color-warning)' },
    },
    {
      label: 'Manutenção corretiva',
      valor: corretiva,
      hint: corretiva > 0 ? 'Atenção urgente' : 'Sem ocorrências',
      icon: AlertOctagon,
      accent: { bg: 'var(--color-danger-soft)', fg: 'var(--color-danger-fg)', border: 'var(--color-danger)' },
    },
    {
      label: 'Fora de funcionamento',
      valor: fora,
      hint: `${pct(fora)}% da frota`,
      icon: PowerOff,
      accent: { bg: 'var(--color-surface-2)', fg: 'var(--color-fg-muted)', border: 'var(--color-border-strong)' },
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {kpis.map((k) => {
        const Icon = k.icon;
        return (
          <div
            key={k.label}
            className="relative overflow-hidden rounded-2xl border bg-[var(--color-surface-1)] p-4 transition-all hover:shadow-[var(--shadow-md)]"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div
              aria-hidden
              className="absolute inset-y-0 left-0 w-1"
              style={{ background: `color-mix(in srgb, ${k.accent.border} 75%, transparent)` }}
            />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium tracking-wide uppercase text-[var(--color-fg-muted)]">
                  {k.label}
                </p>
                <p className="text-3xl font-bold mt-1.5 tabular-nums leading-none text-[var(--color-fg)]">
                  {k.valor}
                </p>
                {k.hint && (
                  <p className="text-xs text-[var(--color-fg-subtle)] mt-2 truncate">{k.hint}</p>
                )}
              </div>
              <div
                className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: k.accent.bg, color: k.accent.fg }}
              >
                <Icon aria-hidden className="w-5 h-5" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
