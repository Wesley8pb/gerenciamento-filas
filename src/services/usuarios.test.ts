import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSessionMock = vi.fn()
const invokeMock = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
    functions: {
      invoke: invokeMock,
    },
  },
}))

describe('usuarios service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('cria usuário usando supabase.functions.invoke com a sessão atual', async () => {
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'token-admin',
        },
      },
    })

    invokeMock.mockResolvedValue({
      data: {
        usuario: {
          id: 'user-123',
          nome: 'Maria',
          email: 'maria@example.com',
        },
      },
      error: null,
    })

    const { criarUsuario } = await import('./usuarios')

    await expect(criarUsuario({ nome: 'Maria', email: 'maria@example.com', senha: 'senha123' })).resolves.toEqual({
      id: 'user-123',
      nome: 'Maria',
      email: 'maria@example.com',
    })

    expect(invokeMock).toHaveBeenCalledWith('admin-criar-usuario', {
      body: { nome: 'Maria', email: 'maria@example.com', senha: 'senha123' },
    })
  })

  it('reseta senha usando supabase.functions.invoke com a sessão atual', async () => {
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'token-admin',
        },
      },
    })

    invokeMock.mockResolvedValue({
      data: { success: true },
      error: null,
    })

    const { resetarSenha } = await import('./usuarios')

    await expect(resetarSenha('user-123', 'novaSenha123')).resolves.toBeUndefined()

    expect(invokeMock).toHaveBeenCalledWith('admin-resetar-senha', {
      body: { userId: 'user-123', novaSenha: 'novaSenha123' },
      headers: {
        Authorization: 'Bearer token-admin',
      },
    })
  })
})
