import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import UserMenu from './UserMenu';

const links: { to: string; label: string; acao?: string }[] = [
  { to: '/', label: 'Dashboard', acao: 'ver_dashboard' },
  { to: '/obras', label: 'Obras', acao: 'ver_obras' },
  { to: '/cadastros', label: 'Cadastros', acao: 'ver_cadastros' },
  { to: '/frete', label: 'Frete', acao: 'ver_frete' },
  { to: '/apontamentos', label: 'Apontamentos', acao: 'ver_apontamentos' },
  { to: '/funcionarios', label: 'Usuários', acao: 'ver_funcionarios' },
];

export default function Header() {
  const { pathname } = useLocation();
  const { temAcao } = useAuth();
  const { dark, toggleTheme } = useTheme();
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
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label={dark ? 'Modo claro' : 'Modo escuro'}
          >
            {dark ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
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
