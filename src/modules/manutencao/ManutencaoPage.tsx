import { NavLink, Outlet } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useAlertasAtivos } from './hooks/useAlertasAtivos';

const TABS: Array<{ to: string; label: string }> = [
  { to: 'frota', label: 'Frota' },
  { to: 'modelos', label: 'Modelos' },
  { to: 'alertas', label: 'Alertas' },
];

function tabClass(isActive: boolean): string {
  return (
    'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ' +
    (isActive
      ? 'text-[var(--color-fg)] border-[var(--color-accent)]'
      : 'text-[var(--color-fg-muted)] border-transparent hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)]')
  );
}

export default function ManutencaoPage() {
  const { data: alertas = [] } = useAlertasAtivos();
  const criticos = alertas.filter((a) => a.severidade === 'critical').length;

  return (
    <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-6">
      <header className="flex items-end justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-fg)]">
            Manutenção
          </h1>
          <p className="text-sm text-[var(--color-fg-muted)] mt-0.5">
            Frota, modelos, agenda e alertas.
          </p>
        </div>
        <NavLink
          to="alertas"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-sm"
          aria-label={`${criticos} alerta(s) crítico(s)`}
        >
          <Bell
            aria-hidden
            className="w-4 h-4"
            style={{
              color: criticos > 0 ? 'var(--color-danger-fg)' : 'var(--color-fg-muted)',
            }}
          />
          <span className="text-[var(--color-fg)] font-medium">{criticos}</span>
          <span className="text-[var(--color-fg-muted)] hidden sm:inline">crítico(s)</span>
        </NavLink>
      </header>

      <nav
        aria-label="Navegação do módulo Manutenção"
        className="flex border-b border-[var(--color-border)] mb-6 overflow-x-auto"
      >
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => tabClass(isActive)}>
            {t.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}

export { ManutencaoPage };
