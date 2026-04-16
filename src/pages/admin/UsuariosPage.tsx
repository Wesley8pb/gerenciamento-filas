import { useState, useEffect } from 'react';
import { Layout } from '../../components/Layout';
import { ConfirmModal } from '../../components/ConfirmModal';
import { fetchUsuarios, criarUsuario, atualizarUsuario, toggleUsuarioAtivo, resetarSenha } from '../../services/usuarios';
import { notify, getFriendlyError } from '../../utils/toast';
import type { Profile } from '../../types';
import { Plus, Pencil, Key, UserX, UserCheck, AlertCircle, Loader2 } from 'lucide-react';

export function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'criar' | 'editar' | 'resetar'>('criar');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

  // Form states
  const [formData, setFormData] = useState({ nome: '', email: '', senha: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Confirm modal states
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmUser, setConfirmUser] = useState<Profile | null>(null);

  // Carregar usuários
  const loadUsuarios = async () => {
    try {
      setLoading(true);
      const data = await fetchUsuarios();
      setUsuarios(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsuarios();
  }, []);

  // Abrir modal de criar
  const handleCriar = () => {
    setFormData({ nome: '', email: '', senha: '' });
    setModalType('criar');
    setSelectedUser(null);
    setFormError(null);
    setShowModal(true);
  };

  // Abrir modal de editar
  const handleEditar = (usuario: Profile) => {
    setFormData({ nome: usuario.nome, email: usuario.email, senha: '' });
    setModalType('editar');
    setSelectedUser(usuario);
    setFormError(null);
    setShowModal(true);
  };

  // Abrir modal de resetar senha
  const handleResetarSenha = (usuario: Profile) => {
    setFormData({ nome: '', email: '', senha: '' });
    setModalType('resetar');
    setSelectedUser(usuario);
    setFormError(null);
    setShowModal(true);
  };

  // Fechar modal
  const closeModal = () => {
    setShowModal(false);
    setSelectedUser(null);
    setFormData({ nome: '', email: '', senha: '' });
    setFormError(null);
  };

  // Submeter formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);

    try {
      if (modalType === 'criar') {
        await criarUsuario(formData);
        notify.success('Servidor criado com sucesso!');
      } else if (modalType === 'editar' && selectedUser) {
        await atualizarUsuario(selectedUser.id, {
          nome: formData.nome,
          email: formData.email,
        });
        notify.success('Dados atualizados!');
      } else if (modalType === 'resetar' && selectedUser) {
        if (formData.senha.length < 6) {
          throw new Error('A senha deve ter pelo menos 6 caracteres');
        }
        await resetarSenha(selectedUser.id, formData.senha);
        notify.success('Senha redefinida com sucesso!');
      }

      await loadUsuarios();
      closeModal();
    } catch (err: unknown) {
      setFormError(getFriendlyError(err));
    } finally {
      setFormLoading(false);
    }
  };

  // Toggle ativo/inativo - abrir confirmação
  const handleToggleAtivo = (usuario: Profile) => {
    setConfirmUser(usuario);
    setShowConfirm(true);
  };

  // Executar toggle
  const confirmToggleAtivo = async () => {
    if (!confirmUser) return;
    try {
      await toggleUsuarioAtivo(confirmUser.id, !confirmUser.ativo);
      notify.success(confirmUser.ativo ? 'Servidor desativado' : 'Servidor reativado');
      await loadUsuarios();
    } catch (err: unknown) {
      notify.error(getFriendlyError(err));
    } finally {
      setShowConfirm(false);
      setConfirmUser(null);
    }
  };

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gestão de Usuários</h1>
          <p className="text-gray-500">Gerencie os servidores do cartório</p>
        </div>
        <button
          onClick={handleCriar}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          <span>Novo Servidor</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center space-x-2 text-red-700">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="animate-spin mx-auto text-blue-600" size={32} />
            <p className="text-gray-500 mt-2">Carregando...</p>
          </div>
        ) : usuarios.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Nenhum usuário cadastrado.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">E-mail</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Perfil</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {usuarios.map((usuario) => (
                <tr key={usuario.id} className={!usuario.ativo ? 'bg-gray-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="font-medium text-gray-900">{usuario.nome}</span>
                      {usuario.primeiro_acesso && (
                        <span className="ml-2 px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full">
                          Aguardando troca de senha
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">{usuario.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      usuario.perfil === 'admin'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {usuario.perfil === 'admin' ? 'Administrador' : 'Atendente'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      usuario.ativo
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {usuario.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {usuario.perfil !== 'admin' && (
                        <>
                          <button
                            onClick={() => handleEditar(usuario)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Editar"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleResetarSenha(usuario)}
                            className="p-1.5 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded"
                            title="Resetar Senha"
                          >
                            <Key size={16} />
                          </button>
                          <button
                            onClick={() => handleToggleAtivo(usuario)}
                            className={`p-1.5 rounded ${
                              usuario.ativo
                                ? 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                                : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                            }`}
                            title={usuario.ativo ? 'Desativar' : 'Reativar'}
                          >
                            {usuario.ativo ? <UserX size={16} /> : <UserCheck size={16} />}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              {modalType === 'criar' && 'Novo Servidor'}
              {modalType === 'editar' && 'Editar Servidor'}
              {modalType === 'resetar' && 'Resetar Senha'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {modalType === 'criar' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                    <input
                      type="text"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Senha Provisória</label>
                    <input
                      type="password"
                      value={formData.senha}
                      onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                      minLength={6}
                    />
                    <p className="text-xs text-gray-500 mt-1">Mínimo 6 caracteres</p>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
                    <p>O servidor será criado como <strong>Atendente</strong> e deverá trocar a senha no primeiro login.</p>
                  </div>
                </>
              )}

              {modalType === 'editar' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                    <input
                      type="text"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </>
              )}

              {modalType === 'resetar' && (
                <>
                  <p className="text-gray-600">
                    Defina uma nova senha provisória para <strong>{selectedUser?.nome}</strong>.
                    O servidor será obrigado a trocar no próximo login.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nova Senha Provisória</label>
                    <input
                      type="password"
                      value={formData.senha}
                      onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                      minLength={6}
                    />
                    <p className="text-xs text-gray-500 mt-1">Mínimo 6 caracteres</p>
                  </div>
                </>
              )}

              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2 text-red-700 text-sm">
                  <AlertCircle size={16} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  {formLoading && <Loader2 className="animate-spin" size={16} />}
                  <span>
                    {modalType === 'criar' && 'Criar'}
                    {modalType === 'editar' && 'Salvar'}
                    {modalType === 'resetar' && 'Resetar Senha'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação */}
      <ConfirmModal
        isOpen={showConfirm}
        title={confirmUser?.ativo ? 'Desativar Servidor' : 'Reativar Servidor'}
        message={`Tem certeza que deseja ${confirmUser?.ativo ? 'desativar' : 'reativar'} ${confirmUser?.nome}?`}
        confirmLabel={confirmUser?.ativo ? 'Desativar' : 'Reativar'}
        confirmVariant={confirmUser?.ativo ? 'danger' : 'primary'}
        onConfirm={confirmToggleAtivo}
        onCancel={() => {
          setShowConfirm(false);
          setConfirmUser(null);
        }}
      />
    </Layout>
  );
}