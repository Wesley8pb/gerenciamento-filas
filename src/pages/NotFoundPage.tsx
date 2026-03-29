import { Home } from 'lucide-react';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300">404</h1>
        <h2 className="text-2xl font-semibold text-gray-600 mt-4">Página não encontrada</h2>
        <p className="text-gray-500 mt-2">
          A página que você está procurando não existe ou foi removida.
        </p>
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