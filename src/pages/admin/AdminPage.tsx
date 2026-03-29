import { Layout } from '../../components/Layout';
import { Settings, Users, Calendar, FileText, List } from 'lucide-react';
import { Link } from 'react-router-dom';

export function AdminPage() {
  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Administração</h1>
        <p className="text-gray-500">Gerencie o sistema, usuários e configurações</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          to="/admin/usuarios"
          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
        >
          <Users className="text-blue-600 mb-4" size={32} />
          <h2 className="text-lg font-semibold text-gray-800">Gestão de Usuários</h2>
          <p className="text-sm text-gray-500 mt-2">
            Criar, editar, desativar e resetar senhas dos servidores
          </p>
        </Link>

        <Link
          to="/admin/calendario"
          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
        >
          <Calendar className="text-green-600 mb-4" size={32} />
          <h2 className="text-lg font-semibold text-gray-800">Configuração de Dias</h2>
          <p className="text-sm text-gray-500 mt-2">
            Definir limites, bloquear dias, configurar agendamento
          </p>
        </Link>

        <Link
          to="/admin/fila"
          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
        >
          <List className="text-purple-600 mb-4" size={32} />
          <h2 className="text-lg font-semibold text-gray-800">Gerenciamento de Fila</h2>
          <p className="text-sm text-gray-500 mt-2">
            Visualizar, excluir e reordenar eleitores na fila
          </p>
        </Link>

        <Link
          to="/admin/logs"
          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
        >
          <FileText className="text-orange-600 mb-4" size={32} />
          <h2 className="text-lg font-semibold text-gray-800">Logs de Ações</h2>
          <p className="text-sm text-gray-500 mt-2">
            Histórico de ações dos servidores no sistema
          </p>
        </Link>

        <Link
          to="/admin/configuracoes"
          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
        >
          <Settings className="text-gray-600 mb-4" size={32} />
          <h2 className="text-lg font-semibold text-gray-800">Configurações do Sistema</h2>
          <p className="text-sm text-gray-500 mt-2">
            Abertura do agendamento, toggles e outras opções
          </p>
        </Link>
      </div>
    </Layout>
  );
}