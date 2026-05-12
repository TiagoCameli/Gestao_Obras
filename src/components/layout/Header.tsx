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
  { to: '/frota', label: 'Frota', acao: 'ver_frota' },
  { to: '/manutencao', label: 'Manutenção', acao: 'ver_frota' },
  { to: '/combustivel', label: 'Combustível', acao: 'ver_frota' },
  { to: '/apontamento', label: 'Apontamento RH', acao: 'ver_apontamento_rh' },
  { to: '/medicao', label: 'Medição', acao: 'ver_medicao' },
];

// Active match: exact for non-nested, prefix for /cadastros (so /cadastros/obras stays highlighted).
function isActive(pathname: string, to: string): boolean {
  if (to === '/') return pathname === '/';
  if (to === '/cadastros') return pathname === '/cadastros' || pathname.startsWith('/cadastros/');
  if (to === '/manutencao') return pathname === '/manutencao' || pathname.startsWith('/manutencao/');
  return pathname === to;
}

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
    <header className="sticky top-0 z-40 bg-[var(--color-surface-1)]/85 backdrop-blur-md border-b border-[var(--color-border)]">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-[var(--color-fg)] font-semibold tracking-tight text-[15px]"
        >
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--color-accent)] text-[var(--color-fg-on-accent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.15),var(--shadow-xs)]">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21V7l9-4 9 4v14" />
              <path d="M9 21v-8h6v8" />
            </svg>
          </span>
          EMT Construtora
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {visibleLinks.map((link) => {
            const active = isActive(pathname, link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                className={
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors ' +
                  (active
                    ? 'bg-[var(--color-surface-2)] text-[var(--color-fg)]'
                    : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]')
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)] transition-colors"
            aria-label={dark ? 'Modo claro' : 'Modo escuro'}
          >
            {dark ? (
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          <UserMenu />
          <button
            className="md:hidden w-9 h-9 inline-flex items-center justify-center rounded-lg text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="md:hidden border-t border-[var(--color-border)] px-3 py-2 space-y-0.5 bg-[var(--color-surface-1)]">
          {visibleLinks.map((link) => {
            const active = isActive(pathname, link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className={
                  'block py-2.5 px-3 rounded-md transition-colors text-sm ' +
                  (active
                    ? 'bg-[var(--color-surface-2)] text-[var(--color-fg)] font-medium'
                    : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]')
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
