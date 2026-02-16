import { useAuth } from '../../contexts/AuthContext';
import type { AcaoPermissao, ModuloPermissao } from '../../types';

interface PermissionGateProps {
  modulo: ModuloPermissao;
  acao: AcaoPermissao;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function PermissionGate({ modulo, acao, children, fallback = null }: PermissionGateProps) {
  const { temPermissao } = useAuth();

  if (!temPermissao(modulo, acao)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
