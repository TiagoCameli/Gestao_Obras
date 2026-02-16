import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  modulo?: string;
}

export default function ProtectedRoute({ children, modulo }: ProtectedRouteProps) {
  const { isAuthenticated, loading, temAcao } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">Carregando...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (modulo && !temAcao('ver_' + modulo)) {
    return <Navigate to="/acesso-negado" replace />;
  }

  return <>{children}</>;
}
