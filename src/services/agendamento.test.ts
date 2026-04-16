import { beforeEach, describe, expect, it, vi } from 'vitest'

const fromMock = vi.fn()
const rpcMock = vi.fn()
const getSessionMock = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
    auth: {
      getSession: getSessionMock,
    },
  },
}))

describe('agendamento service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('remarcarAgendamento', () => {
    it('usa RPC atômica remarcar_atomico para evitar senhas duplicadas em remarcação concorrente', async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: {
          id: 'eleitor-1',
          dia_atendimento: '2026-05-07',
          senha: 42,
          remarcacao_count: 1,
          status: 'aguardando',
        },
        error: null,
      })
      rpcMock.mockReturnValue({ single: singleMock })

      const { remarcarAgendamento } = await import('./agendamento')
      const result = await remarcarAgendamento('eleitor-1', '2026-05-07', 'servidor-1')

      expect(rpcMock).toHaveBeenCalledOnce()
      expect(rpcMock).toHaveBeenCalledWith('remarcar_atomico', {
        p_eleitor_id: 'eleitor-1',
        p_novo_dia: '2026-05-07',
        p_servidor_id: 'servidor-1',
      })

      // Não pode ter feito SELECT/UPDATE diretos (fonte da race)
      expect(fromMock).not.toHaveBeenCalled()

      expect(result.senha).toBe(42)
    })

    it('propaga mensagem de erro da RPC (ex: limite de vagas atingido)', async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Limite de vagas atingido para este dia' },
      })
      rpcMock.mockReturnValue({ single: singleMock })

      const { remarcarAgendamento } = await import('./agendamento')
      await expect(
        remarcarAgendamento('eleitor-1', '2026-05-07', 'servidor-1')
      ).rejects.toMatchObject({ message: 'Limite de vagas atingido para este dia' })
    })
  })
})
