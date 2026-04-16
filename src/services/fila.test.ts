import { beforeEach, describe, expect, it, vi } from 'vitest'

const fromMock = vi.fn()
const invokeMock = vi.fn()
const getSessionMock = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: fromMock,
    auth: { getSession: getSessionMock },
    functions: { invoke: invokeMock },
  },
}))

describe('fila service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('cadastrarEleitor', () => {
    it('exige sessão autenticada antes de invocar a Edge Function', async () => {
      getSessionMock.mockResolvedValue({ data: { session: null } })

      const { cadastrarEleitor } = await import('./fila')
      await expect(
        cadastrarEleitor({
          dia_atendimento: '2026-04-15',
          nome: 'João',
          data_nascimento: '1960-01-01',
          pcd: false,
          prioritario: false,
          servidor_cadastro_id: 'srv-1',
        })
      ).rejects.toThrow(/Usuário não autenticado/)

      expect(invokeMock).not.toHaveBeenCalled()
    })

    it('invoca a Edge Function gerar-senha com o body recebido', async () => {
      getSessionMock.mockResolvedValue({
        data: { session: { access_token: 'token-1' } },
      })
      invokeMock.mockResolvedValue({
        data: {
          success: true,
          eleitor: { id: 'e-1', senha: 10 },
          senha: 10,
          fila: 'normal',
          posicao: 5,
        },
        error: null,
      })

      const { cadastrarEleitor } = await import('./fila')
      const params = {
        dia_atendimento: '2026-04-15',
        nome: 'Maria',
        data_nascimento: '1970-05-20',
        pcd: false,
        prioritario: false,
        servidor_cadastro_id: 'srv-1',
      }
      const result = await cadastrarEleitor(params)

      expect(invokeMock).toHaveBeenCalledWith('gerar-senha', { body: params })
      expect(result.senha).toBe(10)
    })

    it('propaga erro quando a Edge Function falha', async () => {
      getSessionMock.mockResolvedValue({
        data: { session: { access_token: 'token-1' } },
      })
      invokeMock.mockResolvedValue({
        data: null,
        error: { message: 'Limite atingido' },
      })

      const { cadastrarEleitor } = await import('./fila')
      await expect(
        cadastrarEleitor({
          dia_atendimento: '2026-04-15',
          nome: 'A',
          data_nascimento: '2000-01-01',
          pcd: false,
          prioritario: false,
          servidor_cadastro_id: 'srv-1',
        })
      ).rejects.toThrow('Limite atingido')
    })
  })

  describe('fetchConfigDia', () => {
    it('retorna {limite:0, bloqueado:true} quando configuração do dia não existe', async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      })
      fromMock.mockReturnValue({
        select: () => ({ eq: () => ({ single: singleMock }) }),
      })

      const { fetchConfigDia } = await import('./fila')
      const result = await fetchConfigDia('2026-04-15')
      expect(result).toEqual({ limite: 0, bloqueado: true })
    })
  })
})
