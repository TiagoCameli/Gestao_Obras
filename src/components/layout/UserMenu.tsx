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
          className="flex items-center gap-2 text-blue-100 hover:text-white transition-colors"
          onClick={() => setOpen((v) => !v)}
        >
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
            {iniciais}
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-sm font-medium leading-tight">{usuario.nome}</div>
            <div className="text-xs text-blue-300">{usuario.cargo}</div>
          </div>
          <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
            <button
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              onClick={() => { setOpen(false); setPerfilOpen(true); }}
            >
              Meu Perfil
            </button>
            <button
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              onClick={() => { setOpen(false); setSenhaOpen(true); }}
            >
              Alterar Senha
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
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
