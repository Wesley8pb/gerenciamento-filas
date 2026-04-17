import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import type { Profile } from '../types';

// ================================================================
// SINGLETON — executado UMA VEZ quando o módulo é importado
// ================================================================

/**
 * Mutex: garante que apenas UMA chamada ao banco ocorra por vez,
 * mesmo quando múltiplos eventos auth disparam simultaneamente.
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
    // Reutiliza o perfil já carregado, sem nova requisição
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
 * Tenta recriar o perfil de um usuário auth "órfão"
 * (existe no auth mas não tem registro na tabela profiles).
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
 *
 * IMPORTANTE: o Supabase já dispara INITIAL_SESSION automaticamente
 * no onAuthStateChange com a sessão existente (ou null se não há sessão).
 * Por isso, NÃO precisamos de um initAuth() separado — isso causaria
 * race condition (duas chamadas paralelas ao fetchProfile).
 */
let authSystemInitialized = false;

function initAuthSystem() {
  if (authSystemInitialized) return;
  authSystemInitialized = true;

  // Timeout de segurança: evita loading infinito se onAuthStateChange falhar
  const globalTimeout = setTimeout(() => {
    console.warn('[useAuth] Global timeout - forçando fim do loading');
    if (useAuthStore.getState().isLoading) {
      useAuthStore.getState().setUser(null);
    }
  }, 8000);

  // Listener único — cobre tanto a sessão inicial (INITIAL_SESSION)
  // quanto mudanças subsequentes (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED)
  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('[useAuth] Auth state changed:', event, session?.user?.id || 'none');

    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {

      if (session?.user) {
        const profile = await fetchProfileSingleton(session.user.id);

        if (profile) {
          useAuthStore.getState().setUser(profile);
        } else {
          console.warn('[useAuth] Profile not found.');

          // Tenta recriar perfil para usuário órfão (somente no carregamento inicial)
          if (event === 'INITIAL_SESSION') {
            const userMetadata = session.user.user_metadata;
            const newProfile = await tryRecreateProfile(
              session.user.id,
              session.user.email ?? '',
              userMetadata
            );
            if (newProfile) {
              useAuthStore.getState().setUser(newProfile);
              clearTimeout(globalTimeout);
              return;
            }
          }

          // Sem perfil: para o loading sem deslogar (pode ser instabilidade)
          useAuthStore.getState().setLoading(false);
        }
      } else {
        // INITIAL_SESSION sem sessão = não há usuário logado
        useAuthStore.getState().setUser(null);
      }

      clearTimeout(globalTimeout);

    } else if (event === 'SIGNED_OUT') {
      clearTimeout(globalTimeout);
      useAuthStore.getState().clear();
    }
  });
}

// Executa imediatamente ao importar o módulo
initAuthSystem();

// ================================================================
// HOOK — apenas lê a store e expõe funções de ação
// Sem listeners, sem useEffect de auth, sem duplicação
// ================================================================

export function useAuth() {
  const { user, isLoading, isAuthenticated } = useAuthStore();

  /** Login com email e senha. O onAuthStateChange atualiza a store. */
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

  /** Logout e limpeza da store. */
  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    useAuthStore.getState().clear();
  };

  /** Atualiza senha e marca primeiro_acesso como false. */
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