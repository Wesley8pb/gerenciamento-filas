import { vi } from 'vitest'
import type { Profile, ConfiguracaoDia } from '../types'

// ---------------------------------------------------------------------------
// Factories de fixtures — padrão "builder com defaults + override parcial"
// Centraliza a criação de objetos de teste. Se o tipo mudar, só ajusta aqui.
// ---------------------------------------------------------------------------

/**
 * Cria um Profile completo com valores padrão seguros para testes.
 * Passe somente os campos que importam para o cenário sendo testado.
 */
export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: '1',
    nome: 'Usuário Teste',
    email: 'teste@example.com',
    perfil: 'atendente',
    ativo: true,
    primeiro_acesso: false,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

/**
 * Cria uma ConfiguracaoDia completa com valores padrão seguros para testes.
 * Passe somente os campos que importam para o cenário sendo testado.
 */
export function makeConfiguracaoDia(overrides: Partial<ConfiguracaoDia> = {}): ConfiguracaoDia {
  return {
    id: 1,
    data: '2026-04-15',
    limite_senhas: 100,
    bloqueado: false,
    periodo: 1,
    dia_especial: false,
    observacao: null,
    ciclo_atual: 0,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

export const mockSupabaseClient = {
  auth: {
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } }
    })),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(),
        order: vi.fn(() => ({
          limit: vi.fn(),
        })),
      })),
      order: vi.fn(() => ({
        limit: vi.fn(),
      })),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(),
    })),
  })),
  rpc: vi.fn(),
}

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabaseClient,
}))
