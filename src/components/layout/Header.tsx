import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import UserMenu from './UserMenu';

const links: { to: string; label: string; acao?: string }[] = [
  { to: '/', label: 'Dashboard', acao: 'ver_dashboard' },
  { to: '/obras', label: 'Cadastros', acao: 'ver_cadastros' },
  { to: '/combustivel', label: 'Combustivel', acao: 'ver_combustivel' },
  { to: '/insumos', label: 'Insumos', acao: 'ver_insumos' },
  { to: '/funcionarios', label: 'Funcionarios', acao: 'ver_funcionarios' },
];

export default function Header() {
  const { pathname } = useLocation();
  const { temAcao } = useAuth();

  const visibleLinks = links.filter(
    (link) => !link.acao || temAcao(link.acao)
  );

  return (
    <header className="bg-blue-800 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="text-2xl font-bold tracking-tight">
          Gestao Obras
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
                    : 'text-blue-200 hover:text-white'
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
