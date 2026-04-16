import { useState, useEffect, useCallback } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { useDiaAtivo } from '../hooks/useDiaAtivo';
import { chamarProximo, finalizarAtendimento, registrarRetorno, desfazerAcao, fetchFilaCompleta, fetchHistoricoAtendidos } from '../services/atendimento';
import { supabase } from '../lib/supabase';
import { notify, getFriendlyError } from '../utils/toast';
import type { EleitorFila } from '../types';
import { format, parseISO, differenceInYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, X, RotateCcw, Loader2, UserCheck, History, Calendar, Accessibility } from 'lucide-react';

export function AtendimentoPage() {
  const { user } = useAuth();
  const { isAtivo, motivo, loading: loadingDia, dataAtual } = useDiaAtivo();

  // Estados da fila
  const [fila, setFila] = useState<{
    prioritarios: EleitorFila[];
    normais: EleitorFila[];
    retornos: EleitorFila[];
    chamados: EleitorFila[];
    ausentes: EleitorFila[];
  }>({ prioritarios: [], normais: [], retornos: [], chamados: [], ausentes: [] });
  const [historico, setHistorico] = useState<EleitorFila[]>([]);

  // Estado de chamada
  const [chamando, setChamando] = useState(false);
  const [eleitorChamado, setEleitorChamado] = useState<EleitorFila | null>(null);

  // Estado de finalização
  const [finalizando, setFinalizando] = useState(false);

  // Estado de desfazer
  const [ultimoFinalizado, setUltimoFinalizado] = useState<EleitorFila | null>(null);
  const [tempoDesfazer, setTempoDesfazer] = useState<number>(0);
  const [statusAnterior, setStatusAnterior] = useState<'aguardando' | 'chamado'>('chamado');

  // Carregar dados
  const carregarDados = useCallback(async () => {
    if (!dataAtual) return;
    try {
      const [filaData, historicoData] = await Promise.all([
        fetchFilaCompleta(dataAtual),
        fetchHistoricoAtendidos(dataAtual),
      ]);
      setFila(filaData);
      setHistorico(historicoData);

      // Se há alguém chamado, mostrar
      if (filaData.chamados.length > 0) {
        setEleitorChamado(filaData.chamados[0]);
      } else {
        setEleitorChamado(null);
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    }
  }, [dataAtual]);

  useEffect(() => {
    carregarDados();

    // Realtime subscription
    const channel = `fila:${dataAtual}`;
    const subscription = supabase
      .channel(channel)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'eleitores_fila',
        filter: `dia_atendimento=eq.${dataAtual}`,
      }, () => {
        carregarDados();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [dataAtual, carregarDados]);

  // Timer para desfazer
  useEffect(() => {
    if (tempoDesfazer > 0) {
      const timer = setTimeout(() => {
        setTempoDesfazer(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (tempoDesfazer === 0 && ultimoFinalizado) {
      setUltimoFinalizado(null);
    }
  }, [tempoDesfazer, ultimoFinalizado]);

  // Chamar próximo
  const handleChamarProximo = async () => {
    if (!user || !dataAtual) return;
    try {
      setChamando(true);
      const eleitor = await chamarProximo(dataAtual, user.id);
      setEleitorChamado(eleitor);
      notify.success(`Senha ${String(eleitor.senha).padStart(3, '0')} chamada!`);
      carregarDados();
    } catch (err: unknown) {
      notify.error(getFriendlyError(err));
    } finally {
      setChamando(false);
    }
  };

  // Finalizar atendimento
  const handleFinalizar = async (status: 'atendido' | 'ausente') => {
    if (!eleitorChamado || !user) return;
    try {
      setFinalizando(true);
      setStatusAnterior('chamado');
      await finalizarAtendimento(eleitorChamado.id, status, user.id);
      notify.success(status === 'atendido' ? 'Atendimento finalizado!' : 'Ausência registrada');
      setUltimoFinalizado(eleitorChamado);
      setTempoDesfazer(120); // 2 minutos
      setEleitorChamado(null);
      carregarDados();
    } catch (err: unknown) {
      notify.error(getFriendlyError(err));
    } finally {
      setFinalizando(false);
    }
  };

  // Desfazer
  const handleDesfazer = async () => {
    if (!ultimoFinalizado) return;
    try {
      await desfazerAcao(ultimoFinalizado.id, statusAnterior);
      notify.success('Ação desfeita!');
      setUltimoFinalizado(null);
      setTempoDesfazer(0);
      carregarDados();
    } catch (err: unknown) {
      notify.error(getFriendlyError(err));
    }
  };

  // Registrar retorno
  const handleRegistrarRetorno = async (eleitor: EleitorFila) => {
    if (!user) return;
    try {
      await registrarRetorno(eleitor.id, user.id);
      notify.success('Retorno registrado!');
      carregarDados();
    } catch (err: unknown) {
      notify.error(getFriendlyError(err));
    }
  };

  // Calcular idade
  const calcularIdade = (dataNasc: string): number => {
    return differenceInYears(new Date(), parseISO(dataNasc));
  };

  // Tela de bloqueio
  if (!loadingDia && !isAtivo) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
            <Calendar size={48} className="mx-auto text-yellow-500 mb-4" />
            <h2 className="text-xl font-semibold text-yellow-800 mb-2">
              Atendimento Indisponível
            </h2>
            <p className="text-yellow-700">{motivo}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Atendimento</h1>
        <p className="text-gray-500">Chamada de eleitores da fila</p>
        {dataAtual && (
          <p className="text-sm text-gray-400 mt-1">
            {format(parseISO(dataAtual), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        )}
      </div>

      {/* Botão Desfazer */}
      {ultimoFinalizado && tempoDesfazer > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <RotateCcw className="text-orange-600" size={20} />
            <div>
              <p className="text-orange-800 font-medium">Ação pode ser desfeita</p>
              <p className="text-sm text-orange-600">
                {ultimoFinalizado.nome} - Tempo restante: {Math.floor(tempoDesfazer / 60)}:{String(tempoDesfazer % 60).padStart(2, '0')}
              </p>
            </div>
          </div>
          <button
            onClick={handleDesfazer}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            Desfazer
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna principal - Chamada */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card do eleitor chamado ou botão chamar */}
          {eleitorChamado ? (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-700 mb-4">Eleitor Chamado</h2>
              <div className="bg-blue-600 text-white rounded-lg p-6 text-center mb-4">
                <p className="text-sm opacity-80 mb-1">Senha</p>
                <p className="text-6xl font-bold">{String(eleitorChamado.senha).padStart(3, '0')}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-lg font-medium text-gray-800">{eleitorChamado.nome}</p>
                <p className="text-lg font-medium text-gray-800">{format(parseISO(eleitorChamado.data_nascimento), 'dd/MM/yyyy')}</p>
                <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                  <span>Idade: {calcularIdade(eleitorChamado.data_nascimento)} anos</span>
                  {eleitorChamado.pcd && (
                    <span className="flex items-center text-purple-600">
                      <Accessibility size={14} className="mr-1" /> PCD
                    </span>
                  )}
                  {eleitorChamado.fila === 'retorno' && (
                    <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs">Retorno</span>
                  )}
                </div>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => handleFinalizar('atendido')}
                  disabled={finalizando}
                  className="flex-1 flex items-center justify-center space-x-2 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {finalizando ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                  <span>Atendido</span>
                </button>
                <button
                  onClick={() => handleFinalizar('ausente')}
                  disabled={finalizando}
                  className="flex-1 flex items-center justify-center space-x-2 bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {finalizando ? <Loader2 className="animate-spin" size={20} /> : <X size={20} />}
                  <span>Ausente</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6">
              <button
                onClick={handleChamarProximo}
                disabled={chamando || (fila.prioritarios.length + fila.normais.length + fila.retornos.length === 0)}
                className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white py-6 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-xl font-semibold"
              >
                {chamando ? (
                  <Loader2 className="animate-spin" size={24} />
                ) : (
                  <>
                    <UserCheck size={24} />
                    <span>Chamar Próximo</span>
                  </>
                )}
              </button>
              <p className="text-center text-gray-500 mt-4">
                {fila.prioritarios.length + fila.normais.length + fila.retornos.length === 0
                  ? 'Não há eleitores aguardando'
                  : `${fila.prioritarios.length + fila.normais.length + fila.retornos.length} eleitores aguardando`}
              </p>
            </div>
          )}

          {/* Contadores */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-orange-50 rounded-lg p-4 text-center">
              <p className="text-sm text-orange-600">Prioritários</p>
              <p className="text-3xl font-bold text-orange-700">{fila.prioritarios.length}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-sm text-blue-600">Normais</p>
              <p className="text-3xl font-bold text-blue-700">{fila.normais.length}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600">Retorno</p>
              <p className="text-3xl font-bold text-gray-700">{fila.retornos.length}</p>
            </div>
          </div>

          {/* Histórico */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center space-x-2 mb-4">
              <History size={20} className="text-gray-500" />
              <h2 className="text-lg font-semibold text-gray-700">Últimos Atendidos</h2>
            </div>
            {historico.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Nenhum atendimento registrado</p>
            ) : (
              <div className="space-y-2">
                {historico.map((eleitor) => (
                  <div key={eleitor.id} className="flex items-center justify-between bg-gray-50 rounded p-3">
                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-lg font-semibold">{String(eleitor.senha).padStart(3, '0')}</span>
                      <span className="text-gray-700">{eleitor.nome}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {eleitor.horario_finalizacao && (
                        <span className="text-xs text-gray-500">
                          {format(parseISO(eleitor.horario_finalizacao), 'HH:mm')}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        eleitor.status === 'atendido' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {eleitor.status === 'atendido' ? 'Atendido' : 'Ausente'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Coluna lateral - Filas */}
        <div className="space-y-6">
          {/* Fila Prioritária */}
          <div className="bg-white rounded-lg shadow">
            <div className="bg-orange-500 text-white px-4 py-2 rounded-t-lg">
              <h3 className="font-semibold">Fila Prioritária ({fila.prioritarios.length})</h3>
            </div>
            <div className="p-4 max-h-48 overflow-y-auto">
              {fila.prioritarios.length === 0 ? (
                <p className="text-gray-400 text-sm text-center">Vazia</p>
              ) : (
                <div className="space-y-2">
                  {fila.prioritarios.slice(0, 5).map((eleitor) => (
                    <div key={eleitor.id} className="flex items-center justify-between text-sm">
                      <span className="font-mono font-semibold">{String(eleitor.senha).padStart(3, '0')}</span>
                      <span className="text-gray-600 truncate ml-2">{eleitor.nome}</span>
                    </div>
                  ))}
                  {fila.prioritarios.length > 5 && (
                    <p className="text-xs text-gray-400 text-center">+{fila.prioritarios.length - 5} mais</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Fila Normal */}
          <div className="bg-white rounded-lg shadow">
            <div className="bg-blue-500 text-white px-4 py-2 rounded-t-lg">
              <h3 className="font-semibold">Fila Normal ({fila.normais.length})</h3>
            </div>
            <div className="p-4 max-h-48 overflow-y-auto">
              {fila.normais.length === 0 ? (
                <p className="text-gray-400 text-sm text-center">Vazia</p>
              ) : (
                <div className="space-y-2">
                  {fila.normais.slice(0, 5).map((eleitor) => (
                    <div key={eleitor.id} className="flex items-center justify-between text-sm">
                      <span className="font-mono font-semibold">{String(eleitor.senha).padStart(3, '0')}</span>
                      <span className="text-gray-600 truncate ml-2">{eleitor.nome}</span>
                    </div>
                  ))}
                  {fila.normais.length > 5 && (
                    <p className="text-xs text-gray-400 text-center">+{fila.normais.length - 5} mais</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Fila Retorno */}
          <div className="bg-white rounded-lg shadow">
            <div className="bg-gray-500 text-white px-4 py-2 rounded-t-lg">
              <h3 className="font-semibold">Fila Retorno ({fila.retornos.length})</h3>
            </div>
            <div className="p-4 max-h-48 overflow-y-auto">
              {fila.retornos.length === 0 ? (
                <p className="text-gray-400 text-sm text-center">Vazia</p>
              ) : (
                <div className="space-y-2">
                  {fila.retornos.slice(0, 5).map((eleitor) => (
                    <div key={eleitor.id} className="flex items-center justify-between text-sm">
                      <span className="font-mono font-semibold">{String(eleitor.senha).padStart(3, '0')}</span>
                      <span className="text-gray-600 truncate ml-2">{eleitor.nome}</span>
                    </div>
                  ))}
                  {fila.retornos.length > 5 && (
                    <p className="text-xs text-gray-400 text-center">+{fila.retornos.length - 5} mais</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Ausentes - Período 1 */}
          {fila.ausentes.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="bg-red-100 text-red-700 px-4 py-2 rounded-t-lg">
                <h3 className="font-semibold">Ausentes ({fila.ausentes.length})</h3>
                <p className="text-xs">Clique para registrar retorno</p>
              </div>
              <div className="p-4 max-h-48 overflow-y-auto">
                <div className="space-y-2">
                  {fila.ausentes.map((eleitor) => (
                    <button
                      key={eleitor.id}
                      onClick={() => handleRegistrarRetorno(eleitor)}
                      className="w-full flex items-center justify-between text-sm bg-red-50 hover:bg-red-100 p-2 rounded transition-colors"
                    >
                      <span className="font-mono font-semibold">{String(eleitor.senha).padStart(3, '0')}</span>
                      <span className="text-gray-600 truncate ml-2">{eleitor.nome}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}