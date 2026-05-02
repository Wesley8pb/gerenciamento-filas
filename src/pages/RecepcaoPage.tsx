import { useState, useEffect, useCallback } from 'react';
import { Layout } from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { useDiaAtivo } from '../hooks/useDiaAtivo';
import { cadastrarEleitor, fetchContagemFila, fetchConfigDia, verificarDuplicidade } from '../services/fila';
import { supabase } from '../lib/supabase';
import { notify, getFriendlyError } from '../utils/toast';
import { format, differenceInYears, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, AlertCircle, Loader2, Users, Clock, Accessibility, Check, UserPlus, AlertTriangle } from 'lucide-react';

interface FormData {
  nome: string;
  dataNascimento: string;
  pcd: boolean;
}

interface CadastroResultado {
  senha: number;
  nome: string;
  fila: 'prioritaria' | 'normal';
  pcd: boolean;
  prioritario: boolean;
}

export function RecepcaoPage() {
  const { user } = useAuth();
  const { isAtivo, motivo, loading: loadingDia, dataAtual } = useDiaAtivo();

  // Estados do formulário
  const [formData, setFormData] = useState<FormData>({
    nome: '',
    dataNascimento: '',
    pcd: false,
  });
  const [idade, setIdade] = useState<number | null>(null);
  const [isPrioritario, setIsPrioritario] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados de contagem
  const [contagem, setContagem] = useState({ total: 0, prioritarios: 0, normais: 0, aguardando: 0 });
  const [limite, setLimite] = useState(0);

  // Estado de confirmação
  const [resultado, setResultado] = useState<CadastroResultado | null>(null);
  const [showConfirmacao, setShowConfirmacao] = useState(false);

  // Estado de duplicidade
  const [duplicidade, setDuplicidade] = useState<{ nome: string; senha: number } | null>(null);

  // Carregar contagem e configuração
  const carregarDados = useCallback(async () => {
    if (!dataAtual) return;
    try {
      const [contagemData, configData] = await Promise.all([
        fetchContagemFila(dataAtual),
        fetchConfigDia(dataAtual),
      ]);
      setContagem(contagemData);
      setLimite(configData.limite);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    }
  }, [dataAtual]);

  useEffect(() => {
    carregarDados();

    // Realtime subscription para atualizar contagem
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

  // Calcular idade e prioridade
  useEffect(() => {
    if (formData.dataNascimento) {
      const dataNasc = parseISO(formData.dataNascimento);
      if (isValid(dataNasc)) {
        const hoje = new Date();
        const anos = differenceInYears(hoje, dataNasc);
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

  // Calcular vagas restantes
  const vagasRestantes = limite > 0 ? limite - contagem.total : null;
  const limiteAtingido = limite > 0 && contagem.total >= limite;
  const poucasVagas = vagasRestantes !== null && vagasRestantes <= 5 && vagasRestantes > 0;

  // Handler do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !dataAtual) return;

    // Validações
    if (formData.nome.trim().length < 3) {
      setError('Nome deve ter pelo menos 3 caracteres');
      return;
    }

    if (!formData.dataNascimento) {
      setError('Data de nascimento é obrigatória');
      return;
    }

    if (limiteAtingido) {
      setError('Limite de senhas para hoje atingido');
      return;
    }

    setLoading(true);
    setError(null);
    setDuplicidade(null);

    try {
      // Verificar duplicidade
      const existente = await verificarDuplicidade(
        dataAtual,
        formData.nome.trim(),
        formData.dataNascimento
      );

      if (existente) {
        setDuplicidade({ nome: formData.nome, senha: existente.senha });
        setLoading(false);
        return;
      }

      // Cadastrar
      const result = await cadastrarEleitor({
        dia_atendimento: dataAtual,
        nome: formData.nome.trim(),
        data_nascimento: formData.dataNascimento,
        pcd: formData.pcd,
        prioritario: isPrioritario,
        servidor_cadastro_id: user.id,
      });

      setResultado({
        senha: result.senha,
        nome: formData.nome.trim(),
        fila: result.fila,
        pcd: formData.pcd,
        prioritario: isPrioritario,
      });
      setShowConfirmacao(true);
      notify.success(`Senha ${String(result.senha).padStart(3, '0')} gerada!`);

      // Limpar formulário
      setFormData({ nome: '', dataNascimento: '', pcd: false });
      setIdade(null);
      setIsPrioritario(false);

    } catch (err: unknown) {
      notify.error(getFriendlyError(err));
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar eleitor');
    } finally {
      setLoading(false);
    }
  };

  // Novo cadastro
  const handleNovoCadastro = () => {
    setShowConfirmacao(false);
    setResultado(null);
    carregarDados();
  };

  // Handler do formulário
  if (!loadingDia && !isAtivo) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
            <Calendar size={48} className="mx-auto text-yellow-500 mb-4" />
            <h2 className="text-xl font-semibold text-yellow-800 mb-2">
              Cadastro Indisponível
            </h2>
            <p className="text-yellow-700">{motivo}</p>
            <p className="text-sm text-yellow-600 mt-4">
              O cadastro presencial está disponível apenas nos dias úteis do Período 1 (13/04 a 06/05).
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Recepção</h1>
        <p className="text-gray-500">Cadastro de eleitores na fila</p>
        {dataAtual && (
          <p className="text-sm text-gray-400 mt-1">
            {format(parseISO(dataAtual), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        )}
      </div>

      {/* Indicadores de vagas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total na Fila</p>
              <p className="text-2xl font-bold text-gray-800">{contagem.total}</p>
            </div>
            <Users className="text-blue-600" size={24} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Prioritários</p>
              <p className="text-2xl font-bold text-orange-600">{contagem.prioritarios}</p>
            </div>
            <Clock className="text-orange-600" size={24} />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Normais</p>
              <p className="text-2xl font-bold text-blue-600">{contagem.normais}</p>
            </div>
            <Users className="text-blue-600" size={24} />
          </div>
        </div>

        <div className={`rounded-lg shadow p-4 ${
          limiteAtingido ? 'bg-red-50' :
          poucasVagas ? 'bg-orange-50' : 'bg-white'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Vagas Restantes</p>
              <p className={`text-2xl font-bold ${
                limiteAtingido ? 'text-red-600' :
                poucasVagas ? 'text-orange-600' : 'text-green-600'
              }`}>
                {limite > 0 ? vagasRestantes : '∞'}
              </p>
            </div>
            {limiteAtingido ? (
              <AlertTriangle className="text-red-600" size={24} />
            ) : poucasVagas ? (
              <AlertCircle className="text-orange-600" size={24} />
            ) : (
              <Check className="text-green-600" size={24} />
            )}
          </div>
          {limite > 0 && (
            <p className="text-xs text-gray-500 mt-1">Limite: {limite}</p>
          )}
        </div>
      </div>

      {/* Alerta de limite atingido */}
      {limiteAtingido && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center space-x-2 text-red-700">
          <AlertTriangle size={18} />
          <span>Limite de senhas para hoje atingido. Não é possível cadastrar mais eleitores.</span>
        </div>
      )}

      {/* Alerta de poucas vagas */}
      {poucasVagas && !limiteAtingido && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 flex items-center space-x-2 text-orange-700">
          <AlertCircle size={18} />
          <span>Atenção: Restam apenas {vagasRestantes} vagas para hoje!</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulário */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <UserPlus size={20} className="mr-2" />
            Cadastrar Eleitor
          </h2>

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
                disabled={loading || limiteAtingido}
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
                disabled={loading || limiteAtingido}
                required
              />
              {idade !== null && (
                <p className="text-sm text-gray-500 mt-1">Idade: {idade} anos</p>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="pcd"
                checked={formData.pcd}
                onChange={(e) => setFormData({ ...formData, pcd: e.target.checked })}
                className="w-4 h-4 rounded"
                disabled={loading || limiteAtingido}
              />
              <label htmlFor="pcd" className="text-sm text-gray-700 flex items-center">
                <Accessibility size={16} className="mr-1 text-purple-600" />
                Pessoa com Deficiência (PCD)
              </label>
            </div>

            {/* Badge de Prioridade */}
            {isPrioritario && (
              <div className="bg-orange-100 border border-orange-300 rounded-lg p-3 flex items-center space-x-2">
                <span className="px-2 py-1 bg-orange-500 text-white text-xs font-bold rounded">PRIORIDADE</span>
                <span className="text-sm text-orange-700">
                  {idade !== null && idade >= 80 ? 'Idoso (80+)' : idade !== null && idade >= 60 ? 'Idoso (60+)' : ''}
                  {idade !== null && idade >= 60 && formData.pcd ? ' e ' : ''}
                  {formData.pcd ? 'PCD' : ''}
                </span>
              </div>
            )}

            {/* Indicador de fila */}
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">
                Entrará na fila: <span className={`font-semibold ${isPrioritario ? 'text-orange-600' : 'text-blue-600'}`}>
                  {isPrioritario ? 'Prioritária' : 'Normal'}
                </span>
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2 text-red-700">
                <AlertCircle size={16} />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {duplicidade && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-center space-x-2 text-yellow-700 mb-2">
                  <AlertCircle size={16} />
                  <span className="text-sm font-medium">Eleitor já cadastrado hoje</span>
                </div>
                <p className="text-sm text-yellow-600">
                  <strong>{duplicidade.nome}</strong> já possui a senha <strong>{String(duplicidade.senha).padStart(3, '0')}</strong>.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || limiteAtingido}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  <UserPlus size={20} />
                  <span>Cadastrar e Gerar Senha</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Informações */}
        <div className="bg-blue-50 rounded-lg p-6">
          <h3 className="font-semibold text-blue-800 mb-3">Informações</h3>
          <ul className="text-sm text-blue-700 space-y-2">
            <li>• Idosos (60 anos ou mais) têm direito à fila prioritária</li>
            <li>• Pessoas com 80 anos ou mais são chamadas antes das demais prioridades</li>
            <li>• Pessoas com Deficiência (PCD) também têm prioridade</li>
            <li>• A senha é gerada automaticamente</li>
            <li>• O cadastro é válido apenas para o dia atual</li>
          </ul>

          <div className="mt-6 p-4 bg-white rounded-lg">
            <h4 className="font-medium text-gray-800 mb-2">Regra de Prioridade</h4>
            <p className="text-sm text-gray-600">
              A fila prioritária é chamada antes da normal, com precedência interna para pessoas com
              <strong> 80 anos ou mais</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Modal de Confirmação */}
      {showConfirmacao && resultado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md text-center">
            <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Check className="text-green-600" size={32} />
            </div>

            <h2 className="text-2xl font-bold text-gray-800 mb-2">Cadastro Realizado!</h2>
            <p className="text-gray-500 mb-6">Comunique os dados abaixo ao eleitor</p>

            <div className="bg-blue-600 text-white rounded-lg p-6 mb-6">
              <p className="text-sm opacity-80 mb-1">Senha</p>
              <p className="text-5xl font-bold">{String(resultado.senha).padStart(3, '0')}</p>
            </div>

            <div className="text-left bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600 mb-1"><strong>Nome:</strong> {resultado.nome}</p>
              <p className="text-sm text-gray-600 mb-1">
                <strong>Fila:</strong>{' '}
                <span className={resultado.fila === 'prioritaria' ? 'text-orange-600' : 'text-blue-600'}>
                  {resultado.fila === 'prioritaria' ? 'Prioritária' : 'Normal'}
                </span>
              </p>
              {resultado.pcd && (
                <p className="text-sm text-purple-600"><strong>PCD:</strong> Sim</p>
              )}
            </div>

            <button
              onClick={handleNovoCadastro}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
            >
              <UserPlus size={20} />
              <span>Novo Cadastro</span>
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
