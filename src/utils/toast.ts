import toast from 'react-hot-toast';

// Funções auxiliares para toast notifications
export const notify = {
  success: (message: string) => toast.success(message),
  error: (message: string) => toast.error(message),
  loading: (message: string) => toast.loading(message),
  dismiss: (toastId?: string) => toast.dismiss(toastId),

  // Promises com toast automático
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    }
  ) => toast.promise(promise, messages),
};

// Mensagens de erro amigáveis (não técnicas)
export const errorMessages: Record<string, string> = {
  'Invalid login credentials': 'E-mail ou senha incorretos',
  'Email not confirmed': 'E-mail não confirmado',
  'User already registered': 'Este e-mail já está cadastrado',
  'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres',
  'Unable to validate email address: invalid format': 'Formato de e-mail inválido',
  'Limite de vagas atingido para este dia': 'Limite de vagas atingido para este dia',
  'Limite de senhas para hoje atingido': 'Limite de senhas para hoje atingido',
  'Eleitor já cadastrado hoje': 'Este eleitor já foi cadastrado hoje',
  'Erro ao chamar próximo': 'Não foi possível chamar o próximo eleitor',
  'Erro ao agendar': 'Não foi possível realizar o agendamento',
  'Agendamento não liberado': 'O agendamento ainda não está liberado',
  'Network request failed': 'Sem conexão com a internet',
  'Failed to fetch': 'Falha na conexão. Verifique sua internet',
};

// Função para obter mensagem de erro amigável
export function getFriendlyError(error: unknown): string {
  if (error instanceof Error) {
    return errorMessages[error.message] || error.message || 'Ocorreu um erro inesperado';
  }
  if (typeof error === 'string') {
    return errorMessages[error] || error;
  }
  return 'Ocorreu um erro inesperado';
}