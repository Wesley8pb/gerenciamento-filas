import { useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import type { Profile } from '../types';

// Flag global no nível do módulo — compartilhada entre TODOS os componentes
let authInitialized = false;

export function useAuth() {
  const { user, isLoading, isAuthenticated, setUser, setLoading, clear } = useAuthStore();

  // Fetch user profile with timeout
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      console.log('[useAuth] Fetching profile for user:', userId);

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('fetchProfile timeout')), 5000)
      );

      const query = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      const { data, error } = await Promise.race([query, timeout]) as Awaited<typeof query>;

      if (error) {
        console.error('[useAuth] Error fetching profile:', error);
        return null;
      }

      console.log('[useAuth] Profile fetched successfully:', data);
      return data as Profile;
    } catch (err) {
      console.error('[useAuth] Exception fetching profile:', err);
      return null;
    }
  }, []);

  // Initialize auth state once (globally)
  useEffect(() => {
    // Escutar mudanças de autenticação sempre, independente da inicialização global
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[useAuth] Auth state changed:', event, session?.user?.id || 'none');

      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        const profile = await fetchProfile(session.user.id);
        setUser(profile);
      } else if (event === 'SIGNED_OUT') {
        clear();
      }
    });

    // Só roda o initAuth uma única vez no ciclo de vida da aplicação
    if (!authInitialized) {
      authInitialized = true;

      const initAuth = async () => {
        console.log('[useAuth] Initializing auth...');
        setLoading(true);

        try {
          const sessionTimeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('getSession timeout')), 3000)
          );

          const { data: { session } } = await Promise.race([
            supabase.auth.getSession(),
            sessionTimeout,
          ]) as Awaited<ReturnType<typeof supabase.auth.getSession>>;

          console.log('[useAuth] Initial session:', session?.user?.id || 'none');

          if (session?.user) {
            const profile = await fetchProfile(session.user.id);
            setUser(profile);
          } else {
            setUser(null);
          }
        } catch (err) {
          console.error('[useAuth] Init error (timeout ou falha):', err);
          // Limpar sessão problemática
          try { await supabase.auth.signOut(); } catch (_) { /* ignore */ }
          setUser(null);
        }
      };

      // Timeout global de segurança
      const globalTimeout = setTimeout(() => {
        console.warn('[useAuth] Global timeout - forçando fim do loading');
        setUser(null);
      }, 5000);

      initAuth().finally(() => clearTimeout(globalTimeout));
    }

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile, setUser, setLoading, clear]);

  // Login function
  const login = async (email: string, password: string) => {
    console.log('[useAuth] Login attempt for:', email);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[useAuth] Login error:', error);
        throw error;
      }

      console.log('[useAuth] Login successful, user:', data.user?.id);

      // O onAuthStateChange vai cuidar de buscar o profile
      // Aguardamos um pouco para garantir que o estado foi atualizado
      return data;
    } catch (err) {
      console.error('[useAuth] Login exception:', err);
      throw err;
    }
  };

  // Logout function
  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    clear();
  };

  // Update password function
  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;

    // Update profile to mark primeiro_acesso as false
    if (user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ primeiro_acesso: false })
        .eq('id', user.id);

      if (profileError) throw profileError;

      setUser({ ...user, primeiro_acesso: false });
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    updatePassword,
    primeiroAcesso: user?.primeiro_acesso ?? false,
  };
}