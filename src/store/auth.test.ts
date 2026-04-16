import { describe, it, expect } from 'vitest'
import { useAuthStore, hasPerfil, isAdmin, precisaTrocarSenha } from './auth'
import { makeProfile } from '../test/mocks'

describe('auth store', () => {
  describe('hasPerfil', () => {
    it('deve retornar false quando usuário é null', () => {
      expect(hasPerfil(null, ['admin'])).toBe(false)
    })

    it('deve retornar true quando usuário tem o perfil', () => {
      const user = makeProfile({ perfil: 'admin' })
      expect(hasPerfil(user, ['admin'])).toBe(true)
    })

    it('deve retornar false quando usuário não tem o perfil', () => {
      const user = makeProfile({ perfil: 'atendente' })
      expect(hasPerfil(user, ['admin'])).toBe(false)
    })

    it('deve retornar true quando um dos perfis coincide', () => {
      const user = makeProfile({ perfil: 'atendente' })
      expect(hasPerfil(user, ['admin', 'atendente'])).toBe(true)
    })
  })

  describe('isAdmin', () => {
    it('deve retornar true para admin', () => {
      const user = makeProfile({ perfil: 'admin', email: 'admin@example.com' })
      expect(isAdmin(user)).toBe(true)
    })

    it('deve retornar false para atendente', () => {
      const user = makeProfile({ perfil: 'atendente', email: 'atendente@example.com' })
      expect(isAdmin(user)).toBe(false)
    })
  })

  describe('precisaTrocarSenha', () => {
    it('deve retornar true quando primeiro_acesso é true', () => {
      const user = makeProfile({ primeiro_acesso: true })
      expect(precisaTrocarSenha(user)).toBe(true)
    })

    it('deve retornar false quando primeiro_acesso é false', () => {
      const user = makeProfile({ primeiro_acesso: false })
      expect(precisaTrocarSenha(user)).toBe(false)
    })

    it('deve retornar false quando primeiro_acesso não está definido (default)', () => {
      // makeProfile já seta primeiro_acesso: false por padrão — comportamento esperado
      const user = makeProfile()
      expect(precisaTrocarSenha(user)).toBe(false)
    })
  })

  describe('useAuthStore', () => {
    it('deve ter estado inicial correto', () => {
      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.isLoading).toBe(true)
      expect(state.isAuthenticated).toBe(false)
    })

    it('deve atualizar usuário corretamente', () => {
      const user = makeProfile({ perfil: 'admin' })

      useAuthStore.getState().setUser(user)

      const state = useAuthStore.getState()
      expect(state.user).toEqual(user)
      expect(state.isAuthenticated).toBe(true)
      expect(state.isLoading).toBe(false)
    })

    it('deve limpar estado corretamente', () => {
      const user = makeProfile({ perfil: 'admin' })

      useAuthStore.getState().setUser(user)
      useAuthStore.getState().clear()

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(state.isLoading).toBe(false)
    })

    it('deve atualizar loading corretamente', () => {
      useAuthStore.getState().setLoading(false)
      expect(useAuthStore.getState().isLoading).toBe(false)

      useAuthStore.getState().setLoading(true)
      expect(useAuthStore.getState().isLoading).toBe(true)
    })
  })
})
