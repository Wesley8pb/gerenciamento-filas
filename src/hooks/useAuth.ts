import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import type { Profile } from '../types';

// ================================================================
// SINGLETON — executado UMA VEZ quando o módulo é primeiro importado
// Independente de quantos componentes chamam useAuth()
// Resolve o problema de múltiplos listeners concorrentes
// ================================================================

/**
 * Mutex simples: garante que apenas uma chamada ao banco
 * aconteça por vez, mesmo com múltiplos eventos auth simultâneos.
 */
let isFetchingProfile = false;

async function fetchProfileSingleton(userId: string, retries = 2): Promise<Profile | null> {
  // Se já está buscando, aguardar e reusar o resultado da store
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
}

/**
 * Tenta recriar o perfil de um usuário auth sem perfil cadastrado.
 * Útil para usuários "órfãos" onde auth existe mas profile não.
 */
async function tryRecreateProfile(
  userId: string,
  email: string,
  userMetadata: Record<string, unknown>
): Promise<Profile | null> {
  if (!userMetadata?.nome && !email) return null;

  try {
    const { error: insertError } = await supabase.from('profiles').insert({
      id: userId,
      email,
      nome: (userMetadata.nome as string) || email.split('@')[0],
      perfil: (userMetadata.perfil as string) || 'atendente',
      ativo: true,
      primeiro_acesso: true,
    });

    if (!insertError) {
      return fetchProfileSingleton(userId, 0);
    }
  } catch (e) {
    console.error('[useAuth] Failed to recreate profile:', e);
  }
  return null;
}

/**
 * Inicializa o sistema de autenticação UMA ÚNICA VEZ.
 * Registra o onAuthStateChange globalmente e faz a leitura
 * inicial da sessão. Idempotente — chamadas subsequentes são no-op.
 */
let authSystemInitialized = false;

function initAuthSystem() {
  if (authSystemInitialized) return;
  authSystemInitialized = true;

  // ---- Listener de mudanças de auth (registrado uma única vez) ----
  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('[useAuth] Auth state changed:', event, session?.user?.id || 'none');

    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
      const profile = await fetchProfileSingleton(session.user.id);

      if (profile) {
        useAuthStore.getState().setUser(profile);
      } else {
        console.warn('[useAuth] Profile not found but session exists.');

        if (event === 'INITIAL_SESSION') {
          const userMetadata = session.user.user_metadata;
          const newProfile = await tryRecreateProfile(
            session.user.id,
            session.user.email ?? '',
            userMetadata
          );
          if (newProfile) {
            useAuthStore.getState().setUser(newProfile);
            return;
          }
        }

        // Se não conseguiu recuperar, marcar como não autenticado sem signOut
        useAuthStore.getState().setLoading(false);
      }
    } else if (event === 'SIGNED_OUT') {
      useAuthStore.getState().clear();
    }
  });

  // ---- Inicialização da sessão existente ----
  const initAuth = async () => {
    console.log('[useAuth] Initializing auth...');
    useAuthStore.getState().setLoading(true);

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
        const profile = await fetchProfileSingleton(session.user.id);

        if (profile) {
          useAuthStore.getState().setUser(profile);
        } else {
          console.warn('[useAuth] Profile not found during init. Attempting to recreate from metadata.');
          const userMetadata = session.user.user_metadata;
          const newProfile = await tryRecreateProfile(
            session.user.id,
            session.user.email ?? '',
            userMetadata
          );

          if (newProfile) {
            useAuthStore.getState().setUser(newProfile);
            return;
          }

          console.warn('[useAuth] Could not recover profile. User needs to login again.');
          useAuthStore.getState().setUser(null);
        }
      } else {
        useAuthStore.getState().setUser(null);
      }
    } catch (err) {
      console.error('[useAuth] Init error (timeout ou falha):', err);
      useAuthStore.getState().setUser(null);
    }
  };

  // Timeout global de segurança: evita loading infinito
  const globalTimeout = setTimeout(() => {
    console.warn('[useAuth] Global timeout - forçando fim do loading');
    useAuthStore.getState().setUser(null);
  }, 8000);

  initAuth().finally(() => clearTimeout(globalTimeout));
}

// Executa a inicialização imediatamente ao importar o módulo
initAuthSystem();

// ================================================================
// HOOK — apenas lê a store Zustand e expõe funções de ação
// Não registra nenhum listener, não tem useEffect de auth
// ================================================================

export function useAuth() {
  const { user, isLoading, isAuthenticated } = useAuthStore();

  /**
   * Realiza login com email e senha.
   * O onAuthStateChange (singleton) cuida de atualizar a store.
   */
  const login = async (email: string, password: string) => {
    console.log('[useAuth] Login attempt for:', email);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        console.error('[useAuth] Login error:', error);
        throw error;
      }

      console.log('[useAuth] Login successful, user:', data.user?.id);
      return data;
    } catch (err) {
      console.error('[useAuth] Login exception:', err);
      throw err;
    }
  };

  /** Realiza logout e limpa a store. */
  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    useAuthStore.getState().clear();
  };

  /**
   * Atualiza a senha do usuário logado e
   * marca primeiro_acesso como false no perfil.
   */
  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;

    const currentUser = useAuthStore.getState().user;
    if (currentUser) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ primeiro_acesso: false })
        .eq('id', currentUser.id);

      if (profileError) throw profileError;

      useAuthStore.getState().setUser({ ...currentUser, primeiro_acesso: false });
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