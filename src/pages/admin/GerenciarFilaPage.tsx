import { useState, useEffect } from 'react';
import { Layout } from '../../components/Layout';
import { useAuth } from '../../hooks/useAuth';
import { fetchConfiguracaoDias } from '../../services/configuracao';
import { fetchFilaDia, excluirEleitorFila, alterarOrdemFila } from '../../services/fila';
import type { ConfiguracaoDia, EleitorFila } from '../../types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trash2, Move, AlertCircle, Loader2, Check, Clock, Accessibility } from 'lucide-react';

export function GerenciarFilaPage() {
  const { user } = useAuth();
  const [dias, setDias] = useState<ConfiguracaoDia[]>([]);
  const [selectedDia, setSelectedDia] = useState<string>('');
  const [fila, setFila] = useState<EleitorFila[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal de exclusão
  const [showExcluirModal, setShowExcluirModal] = useState(false);
  const [eleitorExcluir, setEleitorExcluir] = useState<EleitorFila | null>(null);
  const [justificativaExcluir, setJustificativaExcluir] = useState('');
  const [excluindo, setExcluindo] = useState(false);

  // Modal de ordem
  const [showOrdemModal, setShowOrdemModal] = useState(false);
  const [eleitorOrdem, setEleitorOrdem] = useState<EleitorFila | null>(null);
  const [novaOrdem, setNovaOrdem] = useState('');
  const [justificativaOrdem, setJustificativaOrdem] = useState('');
  const [alterando, setAlterando] = useState(false);

  // Carregar dias disponíveis
  useEffect(() => {
    const loadDias = async () => {
      try {
        const data = await fetchConfiguracaoDias();
        // Apenas dias não bloqueados
        const diasAtivos = data.filter(d => !d.bloqueado);
        setDias(diasAtivos);
        if (diasAtivos.length > 0) {
          setSelectedDia(diasAtivos[0].data);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar dias');
      }
    };
    loadDias();
  }, []);

  // Carregar fila quando mudar dia
  useEffect(() => {
    if (!selectedDia) return;
    const loadFila = async () => {
      try {
        setLoading(true);
        const data = await fetchFilaDia(selectedDia);
        setFila(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar fila');
      } finally {
        setLoading(false);
      }
    };
    loadFila();
  }, [selectedDia]);

  // Abrir modal de exclusão
  const handleExcluir = (eleitor: EleitorFila) => {
    if (!['aguardando', 'chamado'].includes(eleitor.status)) {
      setError('Só é possível excluir eleitores com status "aguardando" ou "chamado"');
      return;
    }
    setEleitorExcluir(eleitor);
    setJustificativaExcluir('');
    setShowExcluirModal(true);
  };

  // Confirmar exclusão
  const confirmarExclusao = async () => {
    if (!eleitorExcluir || !user) return;
    if (justificativaExcluir.length < 10) {
      setError('A justificativa deve ter pelo menos 10 caracteres');
      return;
    }
    try {
      setExcluindo(true);
      await excluirEleitorFila(eleitorExcluir.id, justificativaExcluir, user.id);
      setFila(fila.map(e => e.id === eleitorExcluir.id ? { ...e, status: 'cancelado' as const } : e));
      setSuccess('Eleitor excluído com sucesso');
      setTimeout(() => setSuccess(null), 3000);
      setShowExcluirModal(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir eleitor');
    } finally {
      setExcluindo(false);
    }
  };

  // Abrir modal de alterar ordem
  const handleAlterarOrdem = (eleitor: EleitorFila) => {
    if (eleitor.status !== 'aguardando') {
      setError('Só é possível alterar ordem de eleitores com status "aguardando"');
      return;
    }
    setEleitorOrdem(eleitor);
    setNovaOrdem(eleitor.ordem_manual?.toString() || '');
    setJustificativaOrdem('');
    setShowOrdemModal(true);
  };

  // Confirmar alteração de ordem
  const confirmarOrdem = async () => {
    if (!eleitorOrdem || !user) return;
    if (justificativaOrdem.length < 10) {
      setError('A justificativa deve ter pelo menos 10 caracteres');
      return;
    }
    const ordem = parseInt(novaOrdem);
    if (isNaN(ordem) || ordem < 1) {
      setError('Digite uma ordem válida');
      return;
    }
    try {
      setAlterando(true);
      await alterarOrdemFila(eleitorOrdem.id, ordem, justificativaOrdem, user.id);
      setFila(fila.map(e => e.id === eleitorOrdem.id ? { ...e, ordem_manual: ordem } : e));
      setSuccess('Ordem alterada com sucesso');
      setTimeout(() => setSuccess(null), 3000);
      setShowOrdemModal(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar ordem');
    } finally {
      setAlterando(false);
    }
  };

  // Agrupar por fila
  const filaPrioritaria = fila.filter(e => e.fila === 'prioritaria' && e.status !== 'cancelado');
  const filaNormal = fila.filter(e => e.fila === 'normal' && e.status !== 'cancelado');
  const filaRetorno = fila.filter(e => e.fila === 'retorno' && e.status !== 'cancelado');
  const cancelados = fila.filter(e => e.status === 'cancelado');

  const renderEleitor = (eleitor: EleitorFila) => {
    const statusColor = {
      aguardando: 'bg-blue-100 text-blue-700',
      chamado: 'bg-yellow-100 text-yellow-700',
      atendido: 'bg-green-100 text-green-700',
      ausente: 'bg-red-100 text-red-700',
      cancelado: 'bg-gray-100 text-gray-500',
    };

    return (
      <div
        key={eleitor.id}
        className="bg-white border rounded-lg p-4 flex items-center justify-between"
      >
        <div className="flex items-center space-x-4">
          <div className="bg-blue-600 text-white font-bold px-3 py-2 rounded-lg text-lg">
            {String(eleitor.senha).padStart(3, '0')}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-medium">{eleitor.nome}</span>
              {eleitor.prioritario && (
                <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full">Prioridade</span>
              )}
              {eleitor.pcd && (
                <span className="flex items-center text-purple-600"><Accessibility size={14} className="mr-1" />PCD</span>
              )}
              {eleitor.fila === 'retorno' && (
                <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">Retorno</span>
              )}
            </div>
            <div className="text-sm text-gray-500 flex items-center space-x-2">
              <Clock size={14} />
              <span>{format(parseISO(eleitor.horario_cadastro), 'HH:mm')}</span>
              <span className={`px-2 py-0.5 text-xs rounded-full ${statusColor[eleitor.status]}`}>
                {eleitor.status}
              </span>
            </div>
          </div>
        </div>

        {eleitor.status === 'aguardando' || eleitor.status === 'chamado' ? (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleAlterarOrdem(eleitor)}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
              title="Alterar ordem"
            >
              <Move size={18} />
            </button>
            <button
              onClick={() => handleExcluir(eleitor)}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
              title="Excluir da fila"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Gerenciamento de Fila</h1>
        <p className="text-gray-500">Visualize e gerencie a fila de eleitores</p>
      </div>

      {/* Alertas */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center space-x-2 text-red-700">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-center space-x-2 text-green-700">
          <Check size={18} />
          <span>{success}</span>
        </div>
      )}

      {/* Seletor de dia */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Selecionar Dia</label>
        <select
          value={selectedDia}
          onChange={(e) => setSelectedDia(e.target.value)}
          className="w-full md:w-64 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          {dias.map((dia) => (
            <option key={dia.id} value={dia.data}>
              {format(parseISO(dia.data), "EEEE, dd/MM/yyyy", { locale: ptBR })}
              {dia.dia_especial ? ' (Especial)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Fila */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Loader2 className="animate-spin mx-auto text-blue-600" size={32} />
          <p className="text-gray-500 mt-2">Carregando fila...</p>
        </div>
      ) : fila.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          Nenhum eleitor na fila para este dia.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Fila Prioritária */}
          {filaPrioritaria.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center">
                <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-sm mr-2">Prioritária</span>
                {filaPrioritaria.length} eleitores
              </h2>
              <div className="space-y-2">
                {filaPrioritaria.map(renderEleitor)}
              </div>
            </div>
          )}

          {/* Fila Normal */}
          {filaNormal.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center">
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm mr-2">Normal</span>
                {filaNormal.length} eleitores
              </h2>
              <div className="space-y-2">
                {filaNormal.map(renderEleitor)}
              </div>
            </div>
          )}

          {/* Fila Retorno */}
          {filaRetorno.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center">
                <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-sm mr-2">Retorno</span>
                {filaRetorno.length} eleitores
              </h2>
              <div className="space-y-2">
                {filaRetorno.map(renderEleitor)}
              </div>
            </div>
          )}

          {/* Cancelados */}
          {cancelados.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-500 mb-3">Cancelados: {cancelados.length}</h2>
              <div className="space-y-2 opacity-50">
                {cancelados.map(renderEleitor)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Excluir */}
      {showExcluirModal && eleitorExcluir && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Excluir Eleitor da Fila</h2>
            <p className="text-gray-600 mb-4">
              Você está prestes a excluir <strong>{eleitorExcluir.nome}</strong> (Senha {String(eleitorExcluir.senha).padStart(3, '0')}) da fila.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Justificativa (mín. 10 caracteres)</label>
              <textarea
                value={justificativaExcluir}
                onChange={(e) => setJustificativaExcluir(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={3}
                required
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowExcluirModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarExclusao}
                disabled={excluindo || justificativaExcluir.length < 10}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {excluindo && <Loader2 className="animate-spin" size={16} />}
                <span>Confirmar Exclusão</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ordem */}
      {showOrdemModal && eleitorOrdem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Alterar Ordem na Fila</h2>
            <p className="text-gray-600 mb-4">
              Defina uma nova posição para <strong>{eleitorOrdem.nome}</strong>.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nova Ordem</label>
              <input
                type="number"
                value={novaOrdem}
                onChange={(e) => setNovaOrdem(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                min="1"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Justificativa (mín. 10 caracteres)</label>
              <textarea
                value={justificativaOrdem}
                onChange={(e) => setJustificativaOrdem(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={3}
                required
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowOrdemModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarOrdem}
                disabled={alterando || justificativaOrdem.length < 10}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {alterando && <Loader2 className="animate-spin" size={16} />}
                <span>Confirmar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}