import { Layout } from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { Calendar, Users, Clock, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function DashboardPage() {
  const { user } = useAuth();
  const hoje = new Date();

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          Bem-vindo, {user?.nome}!
        </h1>
        <p className="text-gray-500">
          {format(hoje, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* Alerta sobre sistema em desenvolvimento */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="text-yellow-500" size={24} />
          <div>
            <h3 className="font-medium text-yellow-800">Sistema em Implementação</h3>
            <p className="text-sm text-yellow-700 mt-1">
              Este sistema está sendo desenvolvido para o atendimento eleitoral que inicia em 13/04/2026.
              Algumas funcionalidades ainda estão em desenvolvimento.
            </p>
          </div>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center space-x-3">
            <Calendar className="text-blue-600" size={24} />
            <div>
              <p className="text-sm text-gray-500">Período 1</p>
              <p className="text-xl font-bold text-gray-800">20 dias</p>
              <p className="text-xs text-gray-400">13/04 a 06/05</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center space-x-3">
            <Calendar className="text-green-600" size={24} />
            <div>
              <p className="text-sm text-gray-500">Período 2</p>
              <p className="text-xl font-bold text-gray-800">10 dias</p>
              <p className="text-xs text-gray-400">07/05 a 20/05</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center space-x-3">
            <Users className="text-purple-600" size={24} />
            <div>
              <p className="text-sm text-gray-500">Servidores</p>
              <p className="text-xl font-bold text-gray-800">1</p>
              <p className="text-xs text-gray-400">Usuários ativos</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center space-x-3">
            <Clock className="text-orange-600" size={24} />
            <div>
              <p className="text-sm text-gray-500">Início</p>
              <p className="text-xl font-bold text-gray-800">13/04</p>
              <p className="text-xs text-gray-400">Primeiro atendimento</p>
            </div>
          </div>
        </div>
      </div>

      {/* Mensagem por perfil */}
      {user?.perfil === 'admin' && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-800">Ações Recomendadas</h3>
          <ul className="mt-2 text-sm text-blue-700 space-y-1">
            <li>• Configure os limites de senhas para cada dia de atendimento</li>
            <li>• Crie os usuários atendentes do cartório</li>
            <li>• Verifique se todos os dias estão corretamente configurados</li>
          </ul>
        </div>
      )}
    </Layout>
  );
}