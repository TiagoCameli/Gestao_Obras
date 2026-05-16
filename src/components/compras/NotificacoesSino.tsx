/**
 * NotificacoesSino — botão sino + dropdown com notificações in-app de Compras.
 *
 * - Badge vermelho com contagem de não-lidas
 * - Dropdown com até 30 notificações (não-lidas em destaque)
 * - Cada item clicável navega via prop onNavigate (caller decide o que fazer
 *   com o link interno tipo `/compras?tab=ordens&id=OC-...`)
 * - Botão "Marcar todas como lidas"
 * - Auto-refetch a cada 60s + ao voltar pra aba
 */
import { useEffect, useRef, useState } from 'react';
import { Bell, Check, CheckCheck, Inbox } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  useNotificacoesCompras,
  useMarcarNotificacaoLida,
  useMarcarTodasLidas,
} from '../../hooks/useComprasNotificacoes';
import type { ComprasNotificacao } from '../../types';

interface Props {
  onNavigate?: (link: string) => void;
}

function formatarTempoRelativo(iso: string): string {
  const agora = Date.now();
  const ms = agora - new Date(iso).getTime();
  const seg = Math.floor(ms / 1000);
  if (seg < 60) return 'agora';
  const min = Math.floor(seg / 60);
  if (min < 60) return `${min}min atrás`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `${horas}h atrás`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `${dias}d atrás`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function NotificacoesSino({ onNavigate }: Props) {
  const { usuario } = useAuth();
  const nome = usuario?.nome || '';

  const { data: notificacoes = [] } = useNotificacoesCompras(nome);
  const marcarLidaMut = useMarcarNotificacaoLida();
  const marcarTodasMut = useMarcarTodasLidas();

  const [aberto, setAberto] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  // Fecha ao clicar fora
  useEffect(() => {
    if (!aberto) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [aberto]);

  const handleClicarNotificacao = async (n: ComprasNotificacao) => {
    if (!n.lida) {
      try { await marcarLidaMut.mutateAsync(n.id); } catch { /* silent */ }
    }
    if (n.link && onNavigate) {
      onNavigate(n.link);
    }
    setAberto(false);
  };

  const handleMarcarTodas = async () => {
    if (!nome) return;
    await marcarTodasMut.mutateAsync(nome);
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="relative w-10 h-10 inline-flex items-center justify-center rounded-lg text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] transition-colors"
        title="Notificações de Compras"
        aria-label="Notificações"
      >
        <Bell className="w-4 h-4" />
        {naoLidas > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-rose-600 text-white tabular-nums shadow-[0_0_0_2px_var(--color-surface-1)]">
            {naoLidas > 99 ? '99+' : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute top-full right-0 mt-2 w-[360px] max-w-[90vw] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-[var(--shadow-xl)] z-50 overflow-hidden">
          <header className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-fg)] tracking-tight">Notificações</h3>
              <p className="text-[11px] text-[var(--color-fg-subtle)]">
                {naoLidas > 0 ? `${naoLidas} não lida${naoLidas > 1 ? 's' : ''}` : 'tudo em dia'}
              </p>
            </div>
            {naoLidas > 0 && (
              <button
                type="button"
                onClick={handleMarcarTodas}
                disabled={marcarTodasMut.isPending}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] px-2 py-1 rounded transition-colors disabled:opacity-50"
              >
                <CheckCheck className="w-3 h-3" /> Marcar todas
              </button>
            )}
          </header>

          {/* Lista */}
          <div className="max-h-[60vh] overflow-y-auto">
            {notificacoes.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Inbox className="w-8 h-8 mx-auto text-[var(--color-fg-subtle)] mb-2 opacity-60" />
                <p className="text-sm text-[var(--color-fg-muted)]">Sem notificações por aqui.</p>
                <p className="text-[11px] text-[var(--color-fg-subtle)] mt-1">
                  Você verá avisos sobre pedidos aprovados, cotações respondidas e OCs.
                </p>
              </div>
            ) : (
              notificacoes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleClicarNotificacao(n)}
                  className={
                    'w-full text-left px-4 py-3 border-b border-[var(--color-border)] last:border-b-0 ' +
                    'hover:bg-[var(--color-surface-2)] transition-colors flex items-start gap-3 ' +
                    (n.lida ? 'opacity-70' : 'bg-[var(--color-accent)]/5')
                  }
                >
                  {!n.lida && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] mt-2 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-[var(--color-fg)] truncate">
                      {n.titulo}
                    </div>
                    <div className="text-xs text-[var(--color-fg-muted)] mt-0.5 line-clamp-2">
                      {n.mensagem}
                    </div>
                    <div className="text-[10px] text-[var(--color-fg-subtle)] mt-1">
                      {formatarTempoRelativo(n.criadoEm)}
                    </div>
                  </div>
                  {!n.lida && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); marcarLidaMut.mutate(n.id); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault(); e.stopPropagation();
                          marcarLidaMut.mutate(n.id);
                        }
                      }}
                      className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded text-[var(--color-fg-subtle)] hover:bg-[var(--color-surface-1)] hover:text-[var(--color-fg)] transition-colors cursor-pointer"
                      title="Marcar como lida"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
