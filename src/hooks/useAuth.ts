import { useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import type { Profile } from '../types';

// Flag global no nível do módulo — compartilhada entre TODOS os componentes
let authInitialized = false;

// Mutex simples: evita fetchProfile paralelos quando múltiplos eventos auth disparam juntos
let isFetchingProfile = false;

export function useAuth() {
  const { user, isLoading, isAuthenticated, setUser, setLoading, clear } = useAuthStore();

  // Fetch user profile with timeout, mutex e retry
  const fetchProfile = useCallback(async (userId: string, retries = 2): Promise<Profile | null> => {
    // Se já há uma busca em andamento, aguardar ela terminar antes de continuar
    if (isFetchingProfile) {
      console.log('[useAuth] fetchProfile já em andamento, aguardando...');
      await new Promise<void>(resolve => {
        const check = setInterval(() => {
          if (!isFetchingProfile) {
            clearInterval(check);
            resolve();
          }
        }, 100);
      });
      // Retornar o perfil já carregado na store (se disponível)
      const stored = useAuthStore.getState().user;
      if (stored) return stored;
    }

    isFetchingProfile = true;

    try {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          if (attempt > 0) {
            console.log(`[useAuth] Retrying fetchProfile, attempt ${attempt + 1}/${retries + 1}`);
            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
          }

          console.log('[useAuth] Fetching profile for user:', userId);

          const timeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('fetchProfile timeout')), 8000)
          );

          const query = supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

          const { data, error } = await Promise.race([query, timeout]) as Awaited<typeof query>;

          if (error) {
            if (error.code === 'PGRST116') {
              console.error('[useAuth] Profile not found for user:', userId);
              return null;
            }
            console.error('[useAuth] Error fetching profile (attempt ' + (attempt + 1) + '):', error);
            if (attempt === retries) return null;
            continue;
          }

          console.log('[useAuth] Profile fetched successfully:', data);
          return data as Profile;
        } catch (err) {
          console.error('[useAuth] Exception fetching profile (attempt ' + (attempt + 1) + '):', err);
          if (attempt === retries) return null;
        }
      }
      return null;
    } finally {
      isFetchingProfile = false;
    }
  }, []);

  // Initialize auth state once (globally)
  useEffect(() => {
    // Escutar mudanças de autenticação sempre, independente da inicialização global
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[useAuth] Auth state changed:', event, session?.user?.id || 'none');

      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        const profile = await fetchProfile(session.user.id);

        if (profile) {
          setUser(profile);
        } else {
          // Se não encontrou o perfil mas tem sessão válida, não deslogar
          // Apenas marcar como não autenticado mas manter a sessão do Supabase
          // Isso evita o logout silencioso quando há instabilidade na rede
          console.warn('[useAuth] Profile not found but session exists. Keeping session, marking as unauthenticated.');

          // Se for INITIAL_SESSION e não achou perfil, pode ser um usuário órfão
          // Tentar recriar o perfil a partir dos metadados do usuário
          if (event === 'INITIAL_SESSION') {
            const userMetadata = session.user.user_metadata;
            if (userMetadata?.nome || session.user.email) {
              console.log('[useAuth] Attempting to recreate profile from user metadata');
              try {
                const { error: insertError } = await supabase.from('profiles').insert({
                  id: session.user.id,
                  email: session.user.email!,
                  nome: userMetadata.nome || session.user.email!.split('@')[0],
                  perfil: userMetadata.perfil || 'atendente',
                  ativo: true,
                  primeiro_acesso: true
                });

                if (!insertError) {
                  // Tentar buscar o perfil novamente
                  const newProfile = await fetchProfile(session.user.id, 0);
                  if (newProfile) {
                    setUser(newProfile);
                    return;
                  }
                }
              } catch (e) {
                console.error('[useAuth] Failed to recreate profile:', e);
              }
            }
          }

          // Se chegou aqui, não conseguiu recuperar o perfil
          // Marcar como não autenticado mas NÃO fazer signOut
          setLoading(false);
        }
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

            if (profile) {
              setUser(profile);
            } else {
              // Se não encontrou o perfil mas tem sessão válida, tentar recriar
              console.warn('[useAuth] Profile not found during init. Attempting to recreate from metadata.');

              const userMetadata = session.user.user_metadata;
              if (userMetadata?.nome || session.user.email) {
                try {
                  const { error: insertError } = await supabase.from('profiles').insert({
                    id: session.user.id,
                    email: session.user.email!,
                    nome: userMetadata.nome || session.user.email!.split('@')[0],
                    perfil: userMetadata.perfil || 'atendente',
                    ativo: true,
                    primeiro_acesso: true
                  });

                  if (!insertError) {
                    const newProfile = await fetchProfile(session.user.id, 0);
                    if (newProfile) {
                      setUser(newProfile);
                      return;
                    }
                  }
                } catch (e) {
                  console.error('[useAuth] Failed to recreate profile during init:', e);
                }
              }

              // Se não conseguiu recuperar, apenas marcar como não autenticado
              // NÃO fazer signOut - isso evita o logout silencioso
              console.warn('[useAuth] Could not recover profile. User needs to login again.');
              setUser(null);
            }
          } else {
            setUser(null);
          }
        } catch (err) {
          console.error('[useAuth] Init error (timeout ou falha):', err);
          // Em caso de timeout, NÃO fazer signOut automaticamente
          // Apenas marcar como não autenticado
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