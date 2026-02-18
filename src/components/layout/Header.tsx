import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import UserMenu from './UserMenu';

const links: { to: string; label: string; acao?: string }[] = [
  { to: '/', label: 'Dashboard', acao: 'ver_dashboard' },
  { to: '/obras', label: 'Cadastros', acao: 'ver_cadastros' },
  { to: '/combustivel', label: 'Combustível', acao: 'ver_combustivel' },
  { to: '/insumos', label: 'Insumos', acao: 'ver_insumos' },
  { to: '/frete', label: 'Frete', acao: 'ver_frete' },
  { to: '/compras', label: 'Compras', acao: 'ver_compras' },
  { to: '/funcionarios', label: 'Funcionários', acao: 'ver_funcionarios' },
];

export default function Header() {
  const { pathname } = useLocation();
  const { temAcao } = useAuth();

  const visibleLinks = links.filter(
    (link) => !link.acao || temAcao(link.acao)
  );

  return (
    <header className="bg-emt-verde text-white shadow-md border-b-2 border-emt-amarelo">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="text-2xl font-bold tracking-tight">
          EMT Construtora
        </Link>
        <div className="flex items-center gap-6">
          <nav className="flex gap-6">
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
        </div>
      </div>
    </header>
  );
}
