import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LogOut, User, Settings, Users, ClipboardList, Calendar, FileText } from 'lucide-react';
import type { Perfil } from '../types';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems: { path: string; label: string; icon: React.ReactNode; perfis: Perfil[] }[] = [
  { path: '/admin', label: 'Administração', icon: <Settings size={20} />, perfis: ['admin'] },
  { path: '/admin/usuarios', label: 'Usuários', icon: <Users size={20} />, perfis: ['admin'] },
  { path: '/recepcao', label: 'Recepção', icon: <ClipboardList size={20} />, perfis: ['admin', 'atendente'] },
  { path: '/atendimento', label: 'Atendimento', icon: <User size={20} />, perfis: ['admin', 'atendente'] },
  { path: '/agendamento', label: 'Agendamento', icon: <Calendar size={20} />, perfis: ['admin', 'atendente'] },
  { path: '/relatorios', label: 'Relatórios', icon: <FileText size={20} />, perfis: ['admin', 'atendente'] },
];

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleNavItems = navItems.filter(
    item => user && item.perfis.includes(user.perfil)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain bg-white rounded-lg shadow-sm" />
              <div className="bg-white p-1.5 rounded">
                <span className="text-blue-800 font-bold text-sm">56ª ZE</span>
              </div>
              <div>
                <h1 className="text-lg font-semibold">Sistema de Gerenciamento de Filas</h1>
                <p className="text-xs text-blue-200">Juazeirinho/PB</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="font-medium">{user?.nome}</p>
                <p className="text-xs text-blue-200 capitalize">{user?.perfil}</p>
                <p className="text-xs text-blue-300">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-1 bg-blue-700 hover:bg-blue-600 px-3 py-2 rounded transition-colors"
              >
                <LogOut size={18} />
                <span className="text-sm">Sair</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1">
            {visibleNavItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${
                  location.pathname.startsWith(item.path)
                    ? 'text-blue-700 border-b-2 border-blue-700'
                    : 'text-gray-600 hover:text-blue-700'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}