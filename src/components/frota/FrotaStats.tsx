import type { Equipamento } from '../../types';
import { CheckCircle2, XCircle, Layers, Building2, Key } from 'lucide-react';

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
  const ativos = equipamentos.filter((e) => e.ativo).length;
  const inativos = total - ativos;
  const proprios = equipamentos.filter((e) => e.propriedade === 'propria').length;
  const alugados = equipamentos.filter((e) => e.propriedade === 'alugada').length;
  const categorias = new Set(equipamentos.map((e) => e.tipo).filter(Boolean)).size;
  const pctAtivos = total > 0 ? Math.round((ativos / total) * 100) : 0;

  const kpis: KPI[] = [
    {
      label: 'Total da frota',
      valor: total,
      hint: `${categorias} categorias`,
      icon: Layers,
      accent: { bg: 'var(--color-surface-2)', fg: 'var(--color-fg)', border: 'var(--color-border)' },
    },
    {
      label: 'Ativos',
      valor: ativos,
      hint: `${pctAtivos}% da frota`,
      icon: CheckCircle2,
      accent: { bg: 'var(--color-success-soft)', fg: 'var(--color-success-fg)', border: 'var(--color-success)' },
    },
    {
      label: 'Inativos',
      valor: inativos,
      hint: inativos > 0 ? 'Fora de operação' : 'Tudo operando',
      icon: XCircle,
      accent: { bg: 'var(--color-danger-soft)', fg: 'var(--color-danger-fg)', border: 'var(--color-danger)' },
    },
    {
      label: 'Próprios',
      valor: proprios,
      hint: `${total > 0 ? Math.round((proprios / total) * 100) : 0}% da frota`,
      icon: Building2,
      accent: { bg: 'var(--color-info-soft)', fg: 'var(--color-info-fg)', border: 'var(--color-info)' },
    },
    {
      label: 'Alugados',
      valor: alugados,
      hint: `${total > 0 ? Math.round((alugados / total) * 100) : 0}% da frota`,
      icon: Key,
      accent: { bg: 'var(--color-warning-soft)', fg: 'var(--color-warning-fg)', border: 'var(--color-warning)' },
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
                style={{ backgroundColor: k.accent.bg }}
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
