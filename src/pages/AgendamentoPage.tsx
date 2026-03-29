import { useState, useEffect, useCallback } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { checkAgendamentoLiberado, fetchDiasAgendamento, agendarEleitor, fetchAusentesPeriodo2, remarcarAgendamento } from '../services/agendamento';
import type { EleitorFila } from '../types';
import { format, parseISO, differenceInYears, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, AlertCircle, Loader2, Check, UserPlus, Accessibility } from 'lucide-react';

interface FormData {
  nome: string;
  dataNascimento: string;
  pcd: boolean;
}

interface DiaAgendamento {
  data: string;
  limite: number;
  ocupadas: number;
  disponiveis: number;
}

export function AgendamentoPage() {
  const { user } = useAuth();

  // Estado de liberação
  const [liberado, setLiberado] = useState(false);
  const [motivoBloqueio, setMotivoBloqueio] = useState('');
  const [countdown, setCountdown] = useState<{
    dias: number;
    horas: number;
    minutos: number;
    segundos: number;
  } | null>(null);
  const [checkingLiberacao, setCheckingLiberacao] = useState(true);

  // Estado do calendário
  const [dias, setDias] = useState<DiaAgendamento[]>([]);
  const [selectedDia, setSelectedDia] = useState<string | null>(null);
  const [loadingDias, setLoadingDias] = useState(true);

  // Estado do formulário
  const [formData, setFormData] = useState<FormData>({
    nome: '',
    dataNascimento: '',
    pcd: false,
  });
  const [idade, setIdade] = useState<number | null>(null);
  const [isPrioritario, setIsPrioritario] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estado de confirmação
  const [resultado, setResultado] = useState<{
    dia: string;
    senha: number;
    nome: string;
    fila: string;
  } | null>(null);
  const [showConfirmacao, setShowConfirmacao] = useState(false);

  // Estado de ausentes/remarcação
  const [ausentes, setAusentes] = useState<EleitorFila[]>([]);
  const [showRemarcacao, setShowRemarcacao] = useState(false);
  const [eleitorRemarcacao, setEleitorRemarcacao] = useState<EleitorFila | null>(null);
  const [loadingRemarcacao, setLoadingRemarcacao] = useState(false);

  // Verificar liberação
  const verificarLiberacao = useCallback(async () => {
    try {
      const status = await checkAgendamentoLiberado();
      setLiberado(status.liberado);
      setMotivoBloqueio(status.motivo);

      if (status.abre_em) {
        setCountdown({
          dias: status.abre_em.dias,
          horas: status.abre_em.horas,
          minutos: status.abre_em.minutos,
          segundos: status.abre_em.segundos,
        });
      }
    } catch (err) {
      console.error('Erro ao verificar liberação:', err);
    } finally {
      setCheckingLiberacao(false);
    }
  }, []);

  // Carregar dias disponíveis
  const carregarDias = useCallback(async () => {
    try {
      setLoadingDias(true);
      const diasData = await fetchDiasAgendamento();
      setDias(diasData);
    } catch (err) {
      console.error('Erro ao carregar dias:', err);
    } finally {
      setLoadingDias(false);
    }
  }, []);

  // Carregar ausentes
  const carregarAusentes = useCallback(async () => {
    try {
      const ausentesData = await fetchAusentesPeriodo2();
      setAusentes(ausentesData);
    } catch (err) {
      console.error('Erro ao carregar ausentes:', err);
    }
  }, []);

  useEffect(() => {
    verificarLiberacao();
    carregarDias();
    carregarAusentes();

    // Polling a cada 60s para verificar liberação
    const interval = setInterval(verificarLiberacao, 60000);

    return () => clearInterval(interval);
  }, [verificarLiberacao, carregarDias, carregarAusentes]);

  // Calcular idade e prioridade
  useEffect(() => {
    if (formData.dataNascimento) {
      const dataNasc = parseISO(formData.dataNascimento);
      if (isValid(dataNasc)) {
        const anos = differenceInYears(new Date(), dataNasc);
        setIdade(anos);
        setIsPrioritario(anos >= 60 || formData.pcd);
      } else {
        setIdade(null);
        setIsPrioritario(formData.pcd);
      }
    } else {
      setIdade(null);
      setIsPrioritario(formData.pcd);
    }
  }, [formData.dataNascimento, formData.pcd]);

  // Handler do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedDia) return;

    if (formData.nome.trim().length < 3) {
      setError('Nome deve ter pelo menos 3 caracteres');
      return;
    }

    if (!formData.dataNascimento) {
      setError('Data de nascimento é obrigatória');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await agendarEleitor({
        dia_atendimento: selectedDia,
        nome: formData.nome.trim(),
        data_nascimento: formData.dataNascimento,
        pcd: formData.pcd,
        prioritario: isPrioritario,
        servidor_cadastro_id: user.id,
      });

      setResultado({
        dia: selectedDia,
        senha: result.senha,
        nome: formData.nome.trim(),
        fila: result.fila,
      });
      setShowConfirmacao(true);

      // Limpar
      setFormData({ nome: '', dataNascimento: '', pcd: false });
      setSelectedDia(null);
      carregarDias();

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Remarcar
  const handleRemarcar = async (novoDia: string) => {
    if (!eleitorRemarcacao || !user) return;

    setLoadingRemarcacao(true);
    try {
      await remarcarAgendamento(eleitorRemarcacao.id, novoDia, user.id);
      setShowRemarcacao(false);
      setEleitorRemarcacao(null);
      carregarDias();
      carregarAusentes();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingRemarcacao(false);
    }
  };

  // Novo agendamento
  const handleNovo = () => {
    setShowConfirmacao(false);
    setResultado(null);
  };

  // Tela de bloqueio
  if (checkingLiberacao) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      </Layout>
    );
  }

  if (!liberado) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-8 text-center">
            <Clock size={48} className="mx-auto text-orange-500 mb-4" />
            <h2 className="text-xl font-semibold text-orange-800 mb-2">
              Agendamento Indisponível
            </h2>
            <p className="text-orange-700 mb-4">{motivoBloqueio}</p>

            {countdown && (
              <div className="bg-white rounded-lg p-4 mt-4">
                <p className="text-sm text-gray-500 mb-2">Abre em:</p>
                <div className="flex justify-center space-x-4 text-center">
                  <div>
                    <span className="text-3xl font-bold text-blue-600">{countdown.dias}</span>
                    <p className="text-xs text-gray-500">dias</p>
                  </div>
                  <div>
                    <span className="text-3xl font-bold text-blue-600">{String(countdown.horas).padStart(2, '0')}</span>
                    <p className="text-xs text-gray-500">horas</p>
                  </div>
                  <div>
                    <span className="text-3xl font-bold text-blue-600">{String(countdown.minutos).padStart(2, '0')}</span>
                    <p className="text-xs text-gray-500">min</p>
                  </div>
                  <div>
                    <span className="text-3xl font-bold text-blue-600">{String(countdown.segundos).padStart(2, '0')}</span>
                    <p className="text-xs text-gray-500">seg</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Agendamento</h1>
        <p className="text-gray-500">Agendamento para o Período 2 (07/05 a 20/05)</p>
      </div>

      {/* Ausentes para remarcar */}
      {ausentes.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-red-700">
              <AlertCircle size={18} />
              <span>{ausentes.length} ausente(s) aguardando remarcação</span>
            </div>
            <button
              onClick={() => setShowRemarcacao(true)}
              className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
            >
              Ver Ausentes
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendário */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <Calendar size={20} className="mr-2" />
            Selecione o Dia
          </h2>

          {loadingDias ? (
            <div className="text-center py-8">
              <Loader2 className="animate-spin mx-auto text-blue-600" size={24} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {dias.map((dia) => {
                const dataObj = parseISO(dia.data);
                const isSelected = selectedDia === dia.data;
                const semVagas = dia.limite > 0 && dia.disponiveis <= 0;

                return (
                  <button
                    key={dia.data}
                    onClick={() => !semVagas && setSelectedDia(dia.data)}
                    disabled={semVagas}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : semVagas
                        ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    <p className="font-medium text-gray-800">
                      {format(dataObj, "dd/MM", { locale: ptBR })}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">
                      {format(dataObj, "EEEE", { locale: ptBR })}
                    </p>
                    <p className={`text-sm mt-1 ${semVagas ? 'text-red-600' : 'text-green-600'}`}>
                      {semVagas ? 'Esgotado' : `${dia.disponiveis >= 999 ? '∞' : dia.disponiveis} vagas`}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Formulário */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <UserPlus size={20} className="mr-2" />
            Dados do Eleitor
          </h2>

          {!selectedDia ? (
            <p className="text-gray-500 text-center py-8">
              Selecione um dia no calendário ao lado
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Digite o nome completo"
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data de Nascimento *
                </label>
                <input
                  type="date"
                  value={formData.dataNascimento}
                  onChange={(e) => setFormData({ ...formData, dataNascimento: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  max={format(new Date(), 'yyyy-MM-dd')}
                  disabled={loading}
                  required
                />
                {idade !== null && (
                  <p className="text-sm text-gray-500 mt-1">Idade: {idade} anos</p>
                )}
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="pcd-agendamento"
                  checked={formData.pcd}
                  onChange={(e) => setFormData({ ...formData, pcd: e.target.checked })}
                  className="w-4 h-4 rounded"
                  disabled={loading}
                />
                <label htmlFor="pcd-agendamento" className="text-sm text-gray-700 flex items-center">
                  <Accessibility size={16} className="mr-1 text-purple-600" />
                  Pessoa com Deficiência (PCD)
                </label>
              </div>

              {isPrioritario && (
                <div className="bg-orange-100 border border-orange-300 rounded-lg p-3 flex items-center space-x-2">
                  <span className="px-2 py-1 bg-orange-500 text-white text-xs font-bold rounded">PRIORIDADE</span>
                  <span className="text-sm text-orange-700">
                    {idade !== null && idade >= 60 ? 'Idoso (60+)' : ''}
                    {idade !== null && idade >= 60 && formData.pcd ? ' e ' : ''}
                    {formData.pcd ? 'PCD' : ''}
                  </span>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2 text-red-700">
                  <AlertCircle size={16} />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <Check size={20} />
                    <span>Confirmar Agendamento</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Modal de Confirmação */}
      {showConfirmacao && resultado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md text-center">
            <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Check className="text-green-600" size={32} />
            </div>

            <h2 className="text-2xl font-bold text-gray-800 mb-2">Agendamento Confirmado!</h2>

            <div className="bg-blue-600 text-white rounded-lg p-6 mb-4">
              <p className="text-sm opacity-80 mb-1">Senha</p>
              <p className="text-5xl font-bold">{String(resultado.senha).padStart(3, '0')}</p>
            </div>

            <div className="text-left bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600 mb-1">
                <strong>Data:</strong> {format(parseISO(resultado.dia), "dd/MM/yyyy")}
              </p>
              <p className="text-sm text-gray-600 mb-1"><strong>Nome:</strong> {resultado.nome}</p>
              <p className="text-sm text-gray-600">
                <strong>Fila:</strong>{' '}
                <span className={resultado.fila === 'prioritaria' ? 'text-orange-600' : 'text-blue-600'}>
                  {resultado.fila === 'prioritaria' ? 'Prioritária' : 'Normal'}
                </span>
              </p>
            </div>

            <button
              onClick={handleNovo}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Novo Agendamento
            </button>
          </div>
        </div>
      )}

      {/* Modal de Remarcação */}
      {showRemarcacao && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Ausentes - Remarcação</h2>

            {!eleitorRemarcacao ? (
              <>
                <p className="text-gray-600 mb-4">
                  Selecione um ausente para remarcar:
                </p>
                <div className="space-y-2">
                  {ausentes.map((eleitor) => (
                    <div
                      key={eleitor.id}
                      className="flex items-center justify-between bg-gray-50 p-3 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{eleitor.nome}</p>
                        <p className="text-sm text-gray-500">
                          Agendado para: {format(parseISO(eleitor.dia_atendimento), 'dd/MM/yyyy')}
                        </p>
                      </div>
                      <button
                        onClick={() => setEleitorRemarcacao(eleitor)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        Remarcar
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setShowRemarcacao(false)}
                  className="mt-4 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Fechar
                </button>
              </>
            ) : (
              <>
                <p className="text-gray-600 mb-2">
                  Remarcando: <strong>{eleitorRemarcacao.nome}</strong>
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Agendado anteriormente para: {format(parseISO(eleitorRemarcacao.dia_atendimento), 'dd/MM/yyyy')}
                </p>
                <p className="font-medium text-gray-700 mb-2">Selecione o novo dia:</p>
                <div className="grid grid-cols-2 gap-2">
                  {dias.filter(d => d.limite === 0 || d.disponiveis > 0).map((dia) => (
                    <button
                      key={dia.data}
                      onClick={() => handleRemarcar(dia.data)}
                      disabled={loadingRemarcacao}
                      className="p-2 border rounded hover:bg-blue-50 text-left"
                    >
                      <p className="font-medium">{format(parseISO(dia.data), 'dd/MM')}</p>
                      <p className="text-xs text-green-600">{dia.disponiveis >= 999 ? 'Disponível' : `${dia.disponiveis} vagas`}</p>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setEleitorRemarcacao(null)}
                  className="mt-4 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Voltar
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}