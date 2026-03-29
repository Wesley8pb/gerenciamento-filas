import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fetchConfiguracaoDias,
  fetchConfiguracaoDia,
  atualizarConfiguracaoDia,
  aplicarLimiteTodosDias,
  fetchConfiguracaoSistema,
  atualizarConfiguracaoSistema,
} from './configuracao'
import type { ConfiguracaoDia } from '../types'

// Mock do supabase - usando factory function
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

// Importar o mock após a definição
import { supabase } from '../lib/supabase'
const mockSupabase = supabase as { from: ReturnType<typeof vi.fn> }

describe('configuracao service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('fetchConfiguracaoDias', () => {
    it('deve retornar lista de configurações', async () => {
      const mockData: ConfiguracaoDia[] = [
        { id: 1, data: '2026-04-15', limite_senhas: 100, bloqueado: false },
        { id: 2, data: '2026-04-16', limite_senhas: 100, bloqueado: false },
      ]

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        }),
      })

      const result = await fetchConfiguracaoDias()
      expect(result).toEqual(mockData)
      expect(result.length).toBe(2)
    })

    it('deve lançar erro quando houver falha', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: new Error('DB Error') }),
        }),
      })

      await expect(fetchConfiguracaoDias()).rejects.toThrow('DB Error')
    })
  })

  describe('fetchConfiguracaoDia', () => {
    it('deve retornar configuração de um dia específico', async () => {
      const mockData: ConfiguracaoDia = {
        id: 1,
        data: '2026-04-15',
        limite_senhas: 100,
        bloqueado: false,
      }

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      })

      const result = await fetchConfiguracaoDia('2026-04-15')
      expect(result).toEqual(mockData)
    })

    it('deve retornar null quando não encontrar (PGRST116)', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'Not found' },
            }),
          }),
        }),
      })

      const result = await fetchConfiguracaoDia('2026-04-15')
      expect(result).toBeNull()
    })
  })

  describe('atualizarConfiguracaoDia', () => {
    it('deve atualizar configuração com sucesso', async () => {
      const mockData: ConfiguracaoDia = {
        id: 1,
        data: '2026-04-15',
        limite_senhas: 150,
        bloqueado: false,
      }

      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
            }),
          }),
        }),
      })

      const result = await atualizarConfiguracaoDia(1, { limite_senhas: 150 })
      expect(result).toEqual(mockData)
    })
  })

  describe('aplicarLimiteTodosDias', () => {
    it('deve aplicar limite a todos os dias não bloqueados', async () => {
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      })

      await expect(aplicarLimiteTodosDias(200)).resolves.not.toThrow()
    })
  })

  describe('fetchConfiguracaoSistema', () => {
    it('deve retornar configurações como objeto', async () => {
      const mockData = [
        { chave: 'max_senhas', valor: '100' },
        { chave: 'horario_inicio', valor: '08:00' },
      ]

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      })

      const result = await fetchConfiguracaoSistema()
      expect(result).toEqual({
        max_senhas: '100',
        horario_inicio: '08:00',
      })
    })
  })

  describe('atualizarConfiguracaoSistema', () => {
    it('deve atualizar configuração do sistema', async () => {
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      })

      await expect(atualizarConfiguracaoSistema('max_senhas', '150')).resolves.not.toThrow()
    })
  })
})
