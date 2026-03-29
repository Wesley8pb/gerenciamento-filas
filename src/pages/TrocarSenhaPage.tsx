import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Lock, AlertCircle, CheckCircle } from 'lucide-react';

export function TrocarSenhaPage() {
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { updatePassword, user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validações
    if (novaSenha.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (novaSenha !== confirmacao) {
      setError('As senhas não coincidem.');
      return;
    }

    setIsLoading(true);

    try {
      await updatePassword(novaSenha);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar senha. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 to-orange-400 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="bg-orange-100 rounded-full p-4 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
            <Lock className="text-orange-500" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Trocar Senha</h1>
          <p className="text-gray-500 mt-1">
            Olá, {user?.nome}! Você precisa definir uma nova senha antes de continuar.
          </p>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-2">
            <AlertCircle className="text-orange-500 mt-0.5" size={18} />
            <p className="text-sm text-orange-700">
              Esta é uma senha provisória definida pelo administrador.
              Por segurança, você deve criar sua própria senha (mínimo 6 caracteres).
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="novaSenha" className="block text-sm font-medium text-gray-700 mb-1">
              Nova Senha
            </label>
            <input
              id="novaSenha"
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="••••••••"
              required
              minLength={6}
            />
            {novaSenha.length >= 6 && (
              <div className="flex items-center space-x-1 text-green-600 mt-1">
                <CheckCircle size={14} />
                <p className="text-xs">Senha válida</p>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="confirmacao" className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar Nova Senha
            </label>
            <input
              id="confirmacao"
              type="password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="••••••••"
              required
              minLength={6}
            />
            {confirmacao && novaSenha === confirmacao && (
              <div className="flex items-center space-x-1 text-green-600 mt-1">
                <CheckCircle size={14} />
                <p className="text-xs">Senhas coincidem</p>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle size={18} />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center space-x-2 bg-orange-500 text-white py-3 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                <Lock size={18} />
                <span>Salvar Nova Senha</span>
              </>
            )}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Não há opção de pular esta etapa. Você deve trocar a senha para continuar.
        </p>
      </div>
    </div>
  );
}