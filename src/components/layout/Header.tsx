import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import UserMenu from './UserMenu';

const links: { to: string; label: string; acao?: string }[] = [
  { to: '/', label: 'Dashboard', acao: 'ver_dashboard' },
  { to: '/obras', label: 'Obras', acao: 'ver_obras' },
  { to: '/cadastros', label: 'Cadastros', acao: 'ver_cadastros' },
  { to: '/frete', label: 'Frete', acao: 'ver_frete' },
  { to: '/funcionarios', label: 'Usuários', acao: 'ver_funcionarios' },
];

export default function Header() {
  const { pathname } = useLocation();
  const { temAcao } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const visibleLinks = links.filter(
    (link) => !link.acao || temAcao(link.acao)
  );

  return (
    <header className="bg-emt-verde text-white shadow-md border-b-2 border-emt-amarelo">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="text-2xl font-bold tracking-tight">
          EMT Construtora
        </Link>
        <div className="flex items-center gap-4">
          {/* Desktop nav */}
          <nav className="hidden md:flex gap-6">
            {visibleLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`transition-colors ${
                  pathname === link.to
                    ? 'text-white font-semibold'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <UserMenu />
          {/* Hamburger button */}
          <button
            className="md:hidden p-2 text-white"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>
      {/* Mobile nav dropdown */}
      {menuOpen && (
        <nav className="md:hidden border-t border-white/20 px-4 py-2 space-y-1">
          {visibleLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMenuOpen(false)}
              className={`block py-3 px-2 rounded transition-colors text-base ${
                pathname === link.to
                  ? 'text-white font-semibold bg-white/10'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
