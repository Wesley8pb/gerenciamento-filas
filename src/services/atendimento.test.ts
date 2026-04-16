import { beforeEach, describe, expect, it, vi } from 'vitest'

const fromMock = vi.fn()
const rpcMock = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
  },
}))

describe('atendimento service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('registrarRetorno', () => {
    it('usa RPC atômica registrar_retorno_atomico (sem SELECT prévio que causaria race)', async () => {
      // Arrange: mock do chain .rpc(...).single()
      const singleMock = vi.fn().mockResolvedValue({
        data: {
          id: 'eleitor-1',
          status: 'aguardando',
          fila: 'retorno',
          retorno_count: 3,
        },
        error: null,
      })
      rpcMock.mockReturnValue({ single: singleMock })

      // Act
      const { registrarRetorno } = await import('./atendimento')
      const result = await registrarRetorno('eleitor-1', 'servidor-1')

      // Assert: RPC chamada com os parâmetros esperados
      expect(rpcMock).toHaveBeenCalledOnce()
      expect(rpcMock).toHaveBeenCalledWith('registrar_retorno_atomico', {
        p_eleitor_id: 'eleitor-1',
        p_servidor_id: 'servidor-1',
        p_horario_retorno: expect.any(String),
      })

      // Nenhum from() direto (evita SELECT + UPDATE não atômico)
      expect(fromMock).not.toHaveBeenCalled()

      expect(result.retorno_count).toBe(3)
    })

    it('propaga erro da RPC', async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Eleitor não encontrado' },
      })
      rpcMock.mockReturnValue({ single: singleMock })

      const { registrarRetorno } = await import('./atendimento')
      await expect(registrarRetorno('x', 'y')).rejects.toMatchObject({
        message: 'Eleitor não encontrado',
      })
    })
  })
})
