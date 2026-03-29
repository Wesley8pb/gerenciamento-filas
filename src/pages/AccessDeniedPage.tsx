import { ShieldAlert, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function AccessDeniedPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="bg-red-100 rounded-full p-6 w-24 h-24 mx-auto mb-6 flex items-center justify-center">
          <ShieldAlert className="text-red-500" size={40} />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">Acesso Negado</h1>
        <p className="text-gray-500 mt-2">
          Você não tem permissão para acessar esta página.
        </p>
        {user && (
          <p className="text-sm text-gray-400 mt-4">
            Seu perfil: <span className="font-medium capitalize">{user.perfil}</span>
          </p>
        )}
        <Link
          to="/"
          className="mt-6 inline-flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Home size={18} />
          <span>Voltar ao início</span>
        </Link>
      </div>
    </div>
  );
}