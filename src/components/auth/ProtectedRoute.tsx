import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Gate por módulo: gera chave `ver_<modulo>` automaticamente. */
  modulo?: string;
  /** Gate por chave de ACOES_PLATAFORMA direta (não concatena prefixo). */
  acao?: string;
}

export default function ProtectedRoute({ children, modulo, acao }: ProtectedRouteProps) {
  const { isAuthenticated, loading, temAcao } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app">
        <div className="text-[var(--color-fg-subtle)] text-sm">Carregando...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (acao && !temAcao(acao)) {
    return <Navigate to="/acesso-negado" replace />;
  }

  if (modulo && !temAcao('ver_' + modulo)) {
    return <Navigate to="/acesso-negado" replace />;
  }

  return <>{children}</>;
}
