import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AlterarSenhaModal from '../auth/AlterarSenhaModal';
import MeuPerfilModal from '../auth/MeuPerfilModal';

export default function UserMenu() {
  const { usuario, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [senhaOpen, setSenhaOpen] = useState(false);
  const [perfilOpen, setPerfilOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!usuario) return null;

  const iniciais = usuario.nome
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)] transition-colors"
          onClick={() => setOpen((v) => !v)}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-[var(--color-fg-on-accent)] bg-[var(--color-accent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),var(--shadow-xs)]"
          >
            {iniciais}
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-medium leading-tight text-[var(--color-fg)]">{usuario.nome}</div>
            <div className="text-[11px] text-[var(--color-fg-subtle)]">{usuario.cargo}</div>
          </div>
          <svg
            className={`w-3.5 h-3.5 transition-transform text-[var(--color-fg-subtle)] ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div
            className="absolute right-0 mt-2 w-52 rounded-xl py-1.5 z-50 bg-[var(--color-surface-1)] border border-[var(--color-border)] shadow-[var(--shadow-lg)] elevate-top"
          >
            <div className="px-3 py-2 border-b border-[var(--color-border)] mb-1">
              <div className="text-sm font-medium text-[var(--color-fg)] truncate">{usuario.nome}</div>
              <div className="text-xs text-[var(--color-fg-subtle)] truncate">{usuario.email}</div>
            </div>
            <button
              className="w-full text-left px-3 py-2 mx-0 text-sm text-[var(--color-fg)] hover:bg-[var(--color-surface-2)] transition-colors rounded-md"
              onClick={() => { setOpen(false); setPerfilOpen(true); }}
            >
              Meu Perfil
            </button>
            <button
              className="w-full text-left px-3 py-2 text-sm text-[var(--color-fg)] hover:bg-[var(--color-surface-2)] transition-colors rounded-md"
              onClick={() => { setOpen(false); setSenhaOpen(true); }}
            >
              Alterar Senha
            </button>
            <div className="border-t border-[var(--color-border)] my-1" />
            <button
              className="w-full text-left px-3 py-2 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] transition-colors rounded-md"
              onClick={() => { setOpen(false); logout(); }}
            >
              Sair
            </button>
          </div>
        )}
      </div>

      <AlterarSenhaModal open={senhaOpen} onClose={() => setSenhaOpen(false)} />
      <MeuPerfilModal open={perfilOpen} onClose={() => setPerfilOpen(false)} />
    </>
  );
}
