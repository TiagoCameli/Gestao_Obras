// Marco 5 / PR25a — Layout dedicado pra rotas mobile (/m/*).
//
// Sem header de navegação desktop, sem footer. Header próprio enxuto
// (logo + nome + botão de menu/logout). Conteúdo ocupa toda a viewport.

import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, HardHat } from 'lucide-react';
import Button from '../components/ui/Button';

export default function MobileLayout() {
  const { usuario, logout } = useAuth();
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      {/* Header próprio mobile */}
      <header className="sticky top-0 z-30 bg-[var(--color-accent)] text-[var(--color-accent-fg)] shadow-md">
        <div className="px-3 py-2.5 flex items-center gap-2">
          <Link to="/m" className="flex items-center gap-2 min-w-0 flex-1">
            <HardHat className="w-6 h-6 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-tight truncate">EMT Obras</div>
              <div className="text-[10px] opacity-90 leading-tight truncate">
                {usuario?.nome || 'Pré-uso'}
              </div>
            </div>
          </Link>
          <Button
            variant="secondary"
            size="sm"
            onClick={logout}
            className="!bg-white/15 !text-[var(--color-accent-fg)] !border-white/20 hover:!bg-white/25"
          >
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 p-3 pb-20">
        <Outlet />
      </main>

      {/* Indicador de rota (canto inferior, info pra dev) */}
      {import.meta.env.DEV && (
        <div className="fixed bottom-1 right-1 text-[10px] text-[var(--color-fg-subtle)] bg-[var(--color-surface-1)] px-1.5 py-0.5 rounded">
          {pathname}
        </div>
      )}
    </div>
  );
}
