import { create } from 'zustand';
import type { Profile, Perfil } from '../types';

interface AuthState {
  user: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
  setLoading: (loading) => set({ isLoading: loading }),
  clear: () => set({ user: null, isAuthenticated: false, isLoading: false }),
}));

/**
 * Verifica se o usuário tem um perfil específico
 */
export function hasPerfil(user: Profile | null, perfis: Perfil[]): boolean {
  if (!user) return false;
  return perfis.includes(user.perfil);
}

/**
 * Verifica se o usuário é admin
 */
export function isAdmin(user: Profile | null): boolean {
  return hasPerfil(user, ['admin']);
}

/**
 * Verifica se o usuário precisa trocar senha
 */
export function precisaTrocarSenha(user: Profile | null): boolean {
  return user?.primeiro_acesso === true;
}