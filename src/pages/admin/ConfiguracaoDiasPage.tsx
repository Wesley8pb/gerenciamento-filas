import { useState, useEffect } from 'react';
import { Layout } from '../../components/Layout';
import { fetchConfiguracaoDias, atualizarConfiguracaoDia, aplicarLimiteTodosDias, fetchConfiguracaoSistema, atualizarConfiguracaoSistema, criarConfiguracaoDia } from '../../services/configuracao';
import type { ConfiguracaoDia } from '../../types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Save, AlertCircle, Loader2, Check, Star, Clock, Plus } from 'lucide-react';

export function ConfiguracaoDiasPage() {
  const [dias, setDias] = useState<ConfiguracaoDia[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Configuração de agendamento
  const [agendamentoData, setAgendamentoData] = useState('');
  const [agendamentoHora, setAgendamentoHora] = useState('18:00');

  // Modal de nova data
  const [showNovoDiaModal, setShowNovoDiaModal] = useState(false);
  const [novoDiaData, setNovoDiaData] = useState('');
  const [novoDiaPeriodo, setNovoDiaPeriodo] = useState<1 | 2>(1);
  const [novoDiaLimite, setNovoDiaLimite] = useState('100');
  const [novoDiaEspecial, setNovoDiaEspecial] = useState(false);
  const [novoDiaBloqueado, setNovoDiaBloqueado] = useState(false);
  const [novoDiaObs, setNovoDiaObs] = useState('');

  // Modal de edição
  const [editingDia, setEditingDia] = useState<ConfiguracaoDia | null>(null);
  const [editLimite, setEditLimite] = useState('');
  const [editObs, setEditObs] = useState('');

  // Aplicar para todos
  const [limiteTodos, setLimiteTodos] = useState('');

  // Carregar dados
  const loadData = async () => {
    try {
      setLoading(true);
      const [diasData, config] = await Promise.all([
        fetchConfiguracaoDias(),
        fetchConfiguracaoSistema(),
      ]);
      setDias(diasData);

      // Parse data de abertura
      if (config['agendamento_abertura']) {
        const dt = parseISO(config['agendamento_abertura']);
        setAgendamentoData(format(dt, 'yyyy-MM-dd'));
        setAgendamentoHora(format(dt, 'HH:mm'));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Abrir modal de edição
  const handleEdit = (dia: ConfiguracaoDia) => {
    setEditingDia(dia);
    setEditLimite(dia.limite_senhas.toString());
    setEditObs(dia.observacao || '');
  };

  // Salvar edição completa
  const handleSaveEdit = async () => {
    if (!editingDia) return;
    try {
      setSaving(editingDia.id);
      const atualizado = await atualizarConfiguracaoDia(editingDia.id, {
        limite_senhas: parseInt(editLimite) || 0,
        observacao: editObs || null,
      });
      setDias(dias.map(d => d.id === editingDia.id ? atualizado : d));
      setEditingDia(null);
      setSuccess('Configuração salva!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(null);
    }
  };

  // Aplicar limite para todos
  const handleAplicarTodos = async () => {
    const limite = parseInt(limiteTodos);
    if (isNaN(limite) || limite < 0) {
      setError('Digite um limite válido');
      return;
    }
    try {
      setSaving(-1);
      await aplicarLimiteTodosDias(limite);
      setDias(dias.map(d => d.bloqueado ? d : { ...d, limite_senhas: limite }));
      setSuccess('Limite aplicado a todos os dias ativos!');
      setTimeout(() => setSuccess(null), 3000);
      setLimiteTodos('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao aplicar limite');
    } finally {
      setSaving(null);
    }
  };

  // Salvar data de abertura do agendamento
  const handleSaveAgendamento = async () => {
    try {
      setSaving(-2);
      const dataHora = `${agendamentoData}T${agendamentoHora}:00`;
      await atualizarConfiguracaoSistema('agendamento_abertura', dataHora);
      setSuccess('Data de abertura salva!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar data de abertura');
    } finally {
      setSaving(null);
    }
  };

  // Criar novo dia
  const handleCriarDia = async () => {
    if (!novoDiaData) {
      setError('Selecione uma data');
      return;
    }

    // Verifica se é domingo
    const dataObj = new Date(novoDiaData + 'T00:00:00');
    if (dataObj.getDay() === 0) {
      setError('Não é permitido cadastrar domingos');
      return;
    }

    try {
      setSaving(-3);
      const novoDia = await criarConfiguracaoDia({
        data: novoDiaData,
        periodo: novoDiaPeriodo,
        limite_senhas: parseInt(novoDiaLimite) || 0,
        bloqueado: novoDiaBloqueado,
        dia_especial: novoDiaEspecial,
        observacao: novoDiaObs || null,
        ciclo_atual: 0,
      });

      // Atualiza a lista de dias
      setDias([...dias, novoDia].sort((a, b) => a.data.localeCompare(b.data)));

      // Fecha modal e limpa campos
      setShowNovoDiaModal(false);
      setNovoDiaData('');
      setNovoDiaPeriodo(1);
      setNovoDiaLimite('100');
      setNovoDiaEspecial(false);
      setNovoDiaBloqueado(false);
      setNovoDiaObs('');

      setSuccess('Nova data adicionada com sucesso!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar dia');
    } finally {
      setSaving(null);
    }
  };

  // Agrupar dias por mês
  const diasPorMes = dias.reduce((acc, dia) => {
    const mes = format(parseISO(dia.data), 'MMMM yyyy', { locale: ptBR });
    if (!acc[mes]) acc[mes] = [];
    acc[mes].push(dia);
    return acc;
  }, {} as Record<string, ConfiguracaoDia[]>);

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Configuração de Dias</h1>
          <p className="text-gray-500">Defina limites de senhas e configure o calendário de atendimento</p>
        </div>
        <button
          onClick={() => setShowNovoDiaModal(true)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2 transition-colors"
        >
          <Plus size={20} />
          <span>Adicionar Nova Data</span>
        </button>
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

      {/* Configuração de Agendamento */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center space-x-2 mb-4">
          <Clock className="text-blue-600" size={20} />
          <h2 className="text-lg font-semibold">Abertura do Agendamento (Período 2)</h2>
        </div>
        <div className="flex items-end space-x-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
            <input
              type="date"
              value={agendamentoData}
              onChange={(e) => setAgendamentoData(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Horário</label>
            <input
              type="time"
              value={agendamentoHora}
              onChange={(e) => setAgendamentoHora(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleSaveAgendamento}
            disabled={saving === -2}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2 disabled:opacity-50"
          >
            {saving === -2 ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            <span>Salvar</span>
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-2">O módulo de agendamento será liberado nesta data/hora (verificação server-side)</p>
      </div>

      {/* Aplicar limite para todos */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Aplicar mesmo limite para todos os dias ativos</label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                value={limiteTodos}
                onChange={(e) => setLimiteTodos(e.target.value)}
                placeholder="Ex: 100"
                className="w-32 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                min="0"
              />
              <button
                onClick={handleAplicarTodos}
                disabled={saving === -1 || !limiteTodos}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2 disabled:opacity-50"
              >
                {saving === -1 ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                <span>Aplicar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Calendário por mês */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Loader2 className="animate-spin mx-auto text-blue-600" size={32} />
          <p className="text-gray-500 mt-2">Carregando calendário...</p>
        </div>
      ) : (
        Object.entries(diasPorMes).map(([mes, diasMes]) => (
          <div key={mes} className="bg-white rounded-lg shadow mb-6 overflow-hidden">
            <div className="bg-gray-50 px-6 py-3 border-b">
              <h3 className="font-semibold text-gray-700 capitalize">{mes}</h3>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {diasMes.map((dia) => {
                const dataObj = parseISO(dia.data);
                const diaSemana = format(dataObj, 'EEE', { locale: ptBR });

                return (
                  <div
                    key={dia.id}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      dia.bloqueado
                        ? 'bg-red-50 border-red-200'
                        : dia.dia_especial
                        ? 'bg-yellow-50 border-yellow-300'
                        : 'bg-white border-gray-200 hover:border-blue-300'
                    }`}
                    onClick={() => handleEdit(dia)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-gray-800">
                          {format(dataObj, 'dd')}
                        </span>
                        <span className="text-sm text-gray-500 capitalize">{diaSemana}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        {dia.dia_especial && (
                          <span title="Dia especial">
                            <Star className="text-yellow-500" size={16} />
                          </span>
                        )}
                        {dia.bloqueado ? (
                          <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">Bloqueado</span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">Ativo</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs text-gray-500">Limite:</span>
                        <span className="ml-1 font-medium">{dia.limite_senhas || '—'}</span>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        dia.periodo === 1 ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                      }`}>
                        P{dia.periodo}
                      </span>
                    </div>

                    {dia.observacao && (
                      <p className="text-xs text-gray-500 mt-1 truncate">{dia.observacao}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Modal de Edição */}
      {editingDia && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              {format(parseISO(editingDia.data), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Limite de Senhas</label>
                <input
                  type="number"
                  value={editLimite}
                  onChange={(e) => setEditLimite(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observação</label>
                <input
                  type="text"
                  value={editObs}
                  onChange={(e) => setEditObs(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Opcional"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="bloqueado"
                  checked={editingDia.bloqueado}
                  onChange={() => {
                    const novo = !editingDia.bloqueado;
                    setEditingDia({ ...editingDia, bloqueado: novo });
                  }}
                  className="rounded"
                />
                <label htmlFor="bloqueado" className="text-sm text-gray-700">Dia bloqueado (sem atendimento)</label>
              </div>

              {editingDia.dia_especial && (
                <div className="bg-yellow-50 p-3 rounded-lg text-sm text-yellow-700 flex items-center space-x-2">
                  <Star size={16} />
                  <span>Este é um dia especial (sábado de atendimento)</span>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={() => setEditingDia(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  await atualizarConfiguracaoDia(editingDia.id, { bloqueado: editingDia.bloqueado });
                  handleSaveEdit();
                }}
                disabled={saving === editingDia.id}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                {saving === editingDia.id && <Loader2 className="animate-spin" size={16} />}
                <span>Salvar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Nova Data */}
      {showNovoDiaModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Adicionar Nova Data
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
                <input
                  type="date"
                  value={novoDiaData}
                  onChange={(e) => setNovoDiaData(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Período *</label>
                <select
                  value={novoDiaPeriodo}
                  onChange={(e) => setNovoDiaPeriodo(parseInt(e.target.value) as 1 | 2)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value={1}>Período 1</option>
                  <option value={2}>Período 2</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Limite de Senhas</label>
                <input
                  type="number"
                  value={novoDiaLimite}
                  onChange={(e) => setNovoDiaLimite(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                  placeholder="Ex: 100"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="novoDiaEspecial"
                  checked={novoDiaEspecial}
                  onChange={(e) => setNovoDiaEspecial(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="novoDiaEspecial" className="text-sm text-gray-700">Dia especial (sábado de atendimento)</label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="novoDiaBloqueado"
                  checked={novoDiaBloqueado}
                  onChange={(e) => setNovoDiaBloqueado(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="novoDiaBloqueado" className="text-sm text-gray-700">Dia bloqueado (sem atendimento)</label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observação</label>
                <input
                  type="text"
                  value={novoDiaObs}
                  onChange={(e) => setNovoDiaObs(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={() => setShowNovoDiaModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCriarDia}
                disabled={saving === -3}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                {saving === -3 && <Loader2 className="animate-spin" size={16} />}
                <span>Adicionar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}