import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

interface CreateUserData {
  nome: string;
  email: string;
  senha: string;
}

interface CreateUserResult {
  id: string;
  nome: string;
  email: string;
}

/**
 * Busca todos os usuários
 */
export async function fetchUsuarios(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Cria um novo usuário (atendente) via Edge Function segura
 * A Service Role Key é usada apenas no servidor (Edge Function)
 */
export async function criarUsuario(dados: CreateUserData): Promise<CreateUserResult> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Sessão não encontrada. Faça login novamente.');
  }

  const { data, error } = await supabase.functions.invoke('admin-criar-usuario', {
    body: dados,
  });

  if (error) {
    throw new Error(error.message || 'Erro ao criar usuário');
  }

  return data.usuario;
}

/**
 * Atualiza dados do usuário
 */
export async function atualizarUsuario(id: string, dados: { nome?: string; email?: string }): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(dados)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Desativa/reativa usuário
 */
export async function toggleUsuarioAtivo(id: string, ativo: boolean): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ativo })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Reseta senha do usuário via Edge Function segura
 * A Service Role Key é usada apenas no servidor (Edge Function)
 */
export async function resetarSenha(userId: string, novaSenha: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Sessão não encontrada. Faça login novamente.');
  }

  const { error } = await supabase.functions.invoke('admin-resetar-senha', {
    body: { userId, novaSenha },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    throw new Error(error.message || 'Erro ao resetar senha');
  }
}