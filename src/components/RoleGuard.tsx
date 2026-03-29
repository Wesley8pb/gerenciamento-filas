import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { Perfil } from '../types';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedPerfis: Perfil[];
}

/**
 * Componente que bloqueia rotas por perfil
 */
export function RoleGuard({ children, allowedPerfis }: RoleGuardProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || !allowedPerfis.includes(user.perfil)) {
    return <Navigate to="/acesso-negado" replace />;
  }

  return <>{children}</>;
}