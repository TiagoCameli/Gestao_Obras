// PainelToggles — barra de toggles que mostra/esconde cada painel
// do Dashboard. Renderiza só os painéis para os quais o usuário tem
// permissão (`canSee`). Em telas pequenas vira chips em flex-wrap.

import { Eye, EyeOff, RotateCcw } from 'lucide-react';
import { DASHBOARD_PANELS, useDashboardPrefs } from '../../hooks/useDashboardPrefs';

export default function PainelToggles() {
  const { canSee, visible, toggle, resetAll } = useDashboardPrefs();

  const painéisDisponíveis = DASHBOARD_PANELS.filter((p) => canSee(p.key));
  if (painéisDisponíveis.length === 0) return null;

  // Conta quantos estão visíveis pra mostrar um resumo discreto
  const visíveis = painéisDisponíveis.filter((p) => visible(p.key)).length;
  const total = painéisDisponíveis.length;

  return (
    <div className="card-premium p-4 mb-6">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div>
          <h3 className="text-xs font-semibold text-[var(--color-fg-muted)] uppercase tracking-wider">
            Painéis exibidos
          </h3>
          <p className="text-[11px] text-[var(--color-fg-subtle)] mt-0.5">
            {visíveis} de {total} painéis ativos · clique pra mostrar/esconder
          </p>
        </div>
        <button
          type="button"
          onClick={resetAll}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] px-2.5 py-1.5 rounded-md hover:bg-[var(--color-surface-2)] transition-colors"
          title="Mostrar todos os painéis novamente"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Restaurar padrão
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {painéisDisponíveis.map((p) => {
          const isOn = visible(p.key);
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => toggle(p.key)}
              className={
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ' +
                (isOn
                  ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)] border-[var(--color-accent)]/40 hover:bg-[var(--color-accent-soft)]'
                  : 'bg-[var(--color-surface-1)] text-[var(--color-fg-subtle)] border-[var(--color-border)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg-muted)]')
              }
              aria-pressed={isOn}
              title={isOn ? `Esconder "${p.label}"` : `Mostrar "${p.label}"`}
            >
              {isOn ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
