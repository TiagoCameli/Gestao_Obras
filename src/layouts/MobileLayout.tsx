// Marco 5 / PR25a + PR25b — Layout dedicado pra rotas mobile (/m/*).
//
// Header próprio (logo + nome + logout). Indicador de fila offline +
// status online/offline + botão Sincronizar quando há pendências.

import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, HardHat, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import Button from '../components/ui/Button';
import { useChecklistSync } from '../hooks/useChecklistSync';

export default function MobileLayout() {
  const { usuario, logout } = useAuth();
  const { pathname } = useLocation();
  const { count: pendentes, online, status, sync } = useChecklistSync();

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
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

        {/* Barra de status (só quando relevante) */}
        {(!online || pendentes > 0) && (
          <div
            className={
              'px-3 py-1.5 text-xs flex items-center gap-2 border-t border-white/10 ' +
              (!online ? 'bg-[#0a0a0a]/30' : '')
            }
          >
            {!online && (
              <span className="inline-flex items-center gap-1">
                <WifiOff className="w-3.5 h-3.5" />
                Sem conexão
              </span>
            )}
            {pendentes > 0 && (
              <>
                <span className="inline-flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {pendentes} {pendentes === 1 ? 'pendente' : 'pendentes'} de envio
                </span>
                {online && (
                  <button
                    type="button"
                    onClick={() => sync()}
                    disabled={status === 'syncing'}
                    className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 disabled:opacity-60"
                  >
                    <RefreshCw className={'w-3 h-3 ' + (status === 'syncing' ? 'animate-spin' : '')} />
                    {status === 'syncing' ? 'Enviando…' : 'Sincronizar'}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </header>

      <main className="flex-1 p-3 pb-20">
        <Outlet />
      </main>

      {import.meta.env.DEV && (
        <div className="fixed bottom-1 right-1 text-[10px] text-[var(--color-fg-subtle)] bg-[var(--color-surface-1)] px-1.5 py-0.5 rounded">
          {pathname}
        </div>
      )}
    </div>
  );
}
