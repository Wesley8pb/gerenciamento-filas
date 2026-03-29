import { describe, it, expect, vi, beforeEach } from 'vitest'
import toast from 'react-hot-toast'
import { notify, getFriendlyError, errorMessages } from './toast'

// Mock do react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    promise: vi.fn(),
  },
}))

describe('toast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('notify', () => {
    it('deve chamar toast.success', () => {
      notify.success('Sucesso!')
      expect(toast.success).toHaveBeenCalledWith('Sucesso!')
      expect(toast.success).toHaveBeenCalledTimes(1)
    })

    it('deve chamar toast.error', () => {
      notify.error('Erro!')
      expect(toast.error).toHaveBeenCalledWith('Erro!')
    })

    it('deve chamar toast.loading', () => {
      notify.loading('Carregando...')
      expect(toast.loading).toHaveBeenCalledWith('Carregando...')
    })

    it('deve chamar toast.dismiss sem id', () => {
      notify.dismiss()
      expect(toast.dismiss).toHaveBeenCalledWith(undefined)
    })

    it('deve chamar toast.dismiss com id', () => {
      notify.dismiss('toast-123')
      expect(toast.dismiss).toHaveBeenCalledWith('toast-123')
    })

    it('deve chamar toast.promise', () => {
      const promise = Promise.resolve('result')
      const messages = {
        loading: 'Carregando...',
        success: 'Sucesso!',
        error: 'Erro!',
      }
      notify.promise(promise, messages)
      expect(toast.promise).toHaveBeenCalledWith(promise, messages)
    })
  })

  describe('errorMessages', () => {
    it('deve conter mensagem para credenciais inválidas', () => {
      expect(errorMessages['Invalid login credentials']).toBe('E-mail ou senha incorretos')
    })

    it('deve conter mensagem para email não confirmado', () => {
      expect(errorMessages['Email not confirmed']).toBe('E-mail não confirmado')
    })

    it('deve conter mensagem para usuário já registrado', () => {
      expect(errorMessages['User already registered']).toBe('Este e-mail já está cadastrado')
    })

    it('deve conter mensagem para senha curta', () => {
      expect(errorMessages['Password should be at least 6 characters']).toBe('A senha deve ter pelo menos 6 caracteres')
    })

    it('deve conter mensagem para formato de email inválido', () => {
      expect(errorMessages['Unable to validate email address: invalid format']).toBe('Formato de e-mail inválido')
    })

    it('deve conter mensagens de negócio', () => {
      expect(errorMessages['Limite de vagas atingido para este dia']).toBe('Limite de vagas atingido para este dia')
      expect(errorMessages['Limite de senhas para hoje atingido']).toBe('Limite de senhas para hoje atingido')
      expect(errorMessages['Eleitor já cadastrado hoje']).toBe('Este eleitor já foi cadastrado hoje')
      expect(errorMessages['Erro ao chamar próximo']).toBe('Não foi possível chamar o próximo eleitor')
      expect(errorMessages['Erro ao agendar']).toBe('Não foi possível realizar o agendamento')
      expect(errorMessages['Agendamento não liberado']).toBe('O agendamento ainda não está liberado')
    })

    it('deve conter mensagens de rede', () => {
      expect(errorMessages['Network request failed']).toBe('Sem conexão com a internet')
      expect(errorMessages['Failed to fetch']).toBe('Falha na conexão. Verifique sua internet')
    })
  })

  describe('getFriendlyError', () => {
    it('deve retornar mensagem amigável para erro conhecido', () => {
      const erro = new Error('Invalid login credentials')
      expect(getFriendlyError(erro)).toBe('E-mail ou senha incorretos')
    })

    it('deve retornar mensagem original para erro desconhecido', () => {
      const erro = new Error('Erro desconhecido')
      expect(getFriendlyError(erro)).toBe('Erro desconhecido')
    })

    it('deve retornar mensagem padrão para erro sem mensagem', () => {
      const erro = new Error('')
      expect(getFriendlyError(erro)).toBe('Ocorreu um erro inesperado')
    })

    it('deve retornar mensagem amigável para string conhecida', () => {
      expect(getFriendlyError('Eleitor já cadastrado hoje')).toBe('Este eleitor já foi cadastrado hoje')
    })

    it('deve retornar string original para mensagem desconhecida', () => {
      expect(getFriendlyError('Mensagem qualquer')).toBe('Mensagem qualquer')
    })

    it('deve retornar mensagem padrão para null', () => {
      expect(getFriendlyError(null)).toBe('Ocorreu um erro inesperado')
    })

    it('deve retornar mensagem padrão para undefined', () => {
      expect(getFriendlyError(undefined)).toBe('Ocorreu um erro inesperado')
    })

    it('deve retornar mensagem padrão para objeto', () => {
      expect(getFriendlyError({})).toBe('Ocorreu um erro inesperado')
    })

    it('deve retornar mensagem padrão para número', () => {
      expect(getFriendlyError(123)).toBe('Ocorreu um erro inesperado')
    })

    it('deve retornar mensagem padrão para boolean', () => {
      expect(getFriendlyError(true)).toBe('Ocorreu um erro inesperado')
    })

    it('deve retornar mensagem padrão para array', () => {
      expect(getFriendlyError([1, 2, 3])).toBe('Ocorreu um erro inesperado')
    })
  })
})
