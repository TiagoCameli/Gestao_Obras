import { useEffect, useState } from 'react';
import { AlertTriangle, Lock, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/shadcn/button';
import { Skeleton } from '@/components/shadcn/skeleton';
import type { EstadoLock } from '../hooks/useLockRecurso';

interface LockBannerProps {
  estado: EstadoLock;
  /** Nome resolvido do dono (via funcionarios). Fallback exibe o uuid abreviado. */
  donoNome?: string;
  /** Quando fornecido, exibe botão "Forçar liberação" (gate por `gerenciar_locks_engenharia`). */
  onForcarLiberacao?: () => Promise<void>;
}

/**
 * Banner que mostra o estado do lock de uma nota/cálculo.
 *
 * - 'meu'        → não renderiza nada (usuário tem o lock, pode editar).
 * - 'outro'      → banner amarelo com nome do dono + countdown mm:ss até expirar.
 * - 'erro'       → banner vermelho com motivo.
 * - 'carregando' → skeleton thin.
 */
export function LockBanner({ estado, donoNome, onForcarLiberacao }: LockBannerProps) {
  if (estado.status === 'meu') return null;

  if (estado.status === 'carregando') {
    return <Skeleton className="h-8 w-full rounded-none" />;
  }

  if (estado.status === 'erro') {
    return (
      <div className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span className="flex-1">Falha ao adquirir lock: {estado.motivo}</span>
      </div>
    );
  }

  // status === 'outro'
  return (
    <OutroDonoBanner
      expiraEm={estado.expiraEm}
      donoUsuarioId={estado.donoUsuarioId}
      donoNome={donoNome}
      onForcarLiberacao={onForcarLiberacao}
    />
  );
}

interface OutroDonoBannerProps {
  expiraEm: string;
  donoUsuarioId: string;
  donoNome?: string;
  onForcarLiberacao?: () => Promise<void>;
}

function OutroDonoBanner({
  expiraEm,
  donoUsuarioId,
  donoNome,
  onForcarLiberacao,
}: OutroDonoBannerProps) {
  const [countdown, setCountdown] = useState(() => formatCountdown(expiraEm));
  const [liberando, setLiberando] = useState(false);

  useEffect(() => {
    setCountdown(formatCountdown(expiraEm));
    const id = window.setInterval(() => {
      setCountdown(formatCountdown(expiraEm));
    }, 1000);
    return () => window.clearInterval(id);
  }, [expiraEm]);

  const nomeExibido = donoNome ?? `usuário ${donoUsuarioId.slice(0, 8)}`;

  async function handleForcar() {
    if (!onForcarLiberacao || liberando) return;
    setLiberando(true);
    try {
      await onForcarLiberacao();
    } finally {
      setLiberando(false);
    }
  }

  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-yellow-200 bg-yellow-50 px-4 py-2 text-sm text-yellow-900 dark:border-yellow-900/30 dark:bg-yellow-950/30 dark:text-yellow-200"
    >
      <Lock className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        Em uso por <strong>{nomeExibido}</strong>
        <span className="ml-2 text-yellow-700 dark:text-yellow-300">
          — expira em {countdown}
        </span>
      </span>
      {onForcarLiberacao && (
        <Button
          variant="outline"
          size="xs"
          onClick={handleForcar}
          disabled={liberando}
          className="border-yellow-300 bg-yellow-100 text-yellow-900 hover:bg-yellow-200 dark:border-yellow-900/40 dark:bg-yellow-900/30 dark:text-yellow-100 dark:hover:bg-yellow-900/50"
        >
          <AlertTriangle className="mr-1 h-3 w-3" />
          {liberando ? 'Liberando…' : 'Forçar liberação'}
        </Button>
      )}
    </div>
  );
}

function formatCountdown(expiraEm: string): string {
  const fim = new Date(expiraEm).getTime();
  const agora = Date.now();
  const restante = Math.max(0, Math.floor((fim - agora) / 1000));
  const mm = Math.floor(restante / 60)
    .toString()
    .padStart(2, '0');
  const ss = (restante % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}
