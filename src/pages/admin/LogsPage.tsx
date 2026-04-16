import { useState, useEffect, useCallback } from 'react';
import { Layout } from '../../components/Layout';
import { fetchLogs } from '../../services/fila';
import { fetchUsuarios } from '../../services/usuarios';
import type { LogAcao, Profile } from '../../types';
import { format } from 'date-fns';
import { FileText, AlertCircle, Loader2, Filter } from 'lucide-react';

export function LogsPage() {
  const [logs, setLogs] = useState<(LogAcao & { servidor?: Profile })[]>([]);
  const [servidores, setServidores] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [filtroServidor, setFiltroServidor] = useState('');
  const [filtroAcao, setFiltroAcao] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');

  // Carregar servidores para filtro
  useEffect(() => {
    const loadServidores = async () => {
      try {
        const data = await fetchUsuarios();
        setServidores(data);
      } catch (err: unknown) {
        console.error('Erro ao carregar servidores:', err);
      }
    };
    loadServidores();
  }, []);

  // Carregar logs
  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchLogs({
        servidor_id: filtroServidor || undefined,
        data_inicio: filtroDataInicio ? `${filtroDataInicio}T00:00:00` : undefined,
        data_fim: filtroDataFim ? `${filtroDataFim}T23:59:59` : undefined,
        acao: filtroAcao || undefined,
      });
      setLogs(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar logs');
    } finally {
      setLoading(false);
    }
  }, [filtroServidor, filtroAcao, filtroDataInicio, filtroDataFim]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Formatar detalhes
  const formatDetalhes = (log: LogAcao) => {
    if (!log.detalhes) return '-';
    const d = log.detalhes as Record<string, unknown>;
    switch (log.acao) {
      case 'exclusao_fila':
        return `Justificativa: ${d.justificativa}`;
      case 'alteracao_ordem':
        return `Ordem: ${d.ordem_anterior || 'N/A'} → ${d.nova_ordem} | Justificativa: ${d.justificativa}`;
      case 'cadastro_eleitor':
        return `Senha: ${d.senha}`;
      case 'chamada_eleitor':
        return `Senha: ${d.senha}`;
      case 'atendimento':
        return `Status: ${d.status}`;
      default:
        return JSON.stringify(d);
    }
  };

  // Labels de ação
  const acaoLabels: Record<string, string> = {
    exclusao_fila: 'Exclusão da Fila',
    alteracao_ordem: 'Alteração de Ordem',
    cadastro_eleitor: 'Cadastro de Eleitor',
    chamada_eleitor: 'Chamada de Eleitor',
    atendimento: 'Atendimento',
    login: 'Login',
    logout: 'Logout',
  };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Logs de Ações</h1>
        <p className="text-gray-500">Histórico de ações dos servidores no sistema</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center space-x-2 text-red-700">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center space-x-2 mb-4">
          <Filter size={18} className="text-gray-500" />
          <span className="font-medium text-gray-700">Filtros</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Servidor</label>
            <select
              value={filtroServidor}
              onChange={(e) => setFiltroServidor(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">Todos</option>
              {servidores.map((s) => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Ação</label>
            <select
              value={filtroAcao}
              onChange={(e) => setFiltroAcao(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">Todas</option>
              <option value="exclusao_fila">Exclusão da Fila</option>
              <option value="alteracao_ordem">Alteração de Ordem</option>
              <option value="cadastro_eleitor">Cadastro de Eleitor</option>
              <option value="chamada_eleitor">Chamada de Eleitor</option>
              <option value="atendimento">Atendimento</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Data Início</label>
            <input
              type="date"
              value={filtroDataInicio}
              onChange={(e) => setFiltroDataInicio(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Data Fim</label>
            <input
              type="date"
              value={filtroDataFim}
              onChange={(e) => setFiltroDataFim(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="animate-spin mx-auto text-blue-600" size={32} />
            <p className="text-gray-500 mt-2">Carregando logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FileText size={48} className="mx-auto mb-2 opacity-50" />
            Nenhum log encontrado.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data/Hora</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Servidor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ação</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Detalhes</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(log.timestamp), "dd/MM/yyyy HH:mm:ss")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{log.servidor?.nome || '—'}</div>
                    <div className="text-xs text-gray-500">{log.servidor?.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      log.acao.includes('exclusao') ? 'bg-red-100 text-red-700' :
                      log.acao.includes('alteracao') ? 'bg-yellow-100 text-yellow-700' :
                      log.acao.includes('cadastro') ? 'bg-green-100 text-green-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {acaoLabels[log.acao] || log.acao}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                    {formatDetalhes(log)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}