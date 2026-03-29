import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

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

import { createClient } from '@supabase/supabase-js';

const SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const adminClient = SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
}) : null;

/**
 * Cria um novo usuário (atendente) usando a Admin API em vez das Edge Functions
 */
export async function criarUsuario(dados: CreateUserData): Promise<CreateUserResult> {
  if (!adminClient) throw new Error('Service Role Key não configurada no .env');

  const { data, error } = await adminClient.auth.admin.createUser({
    email: dados.email,
    password: dados.senha,
    email_confirm: true,
    user_metadata: { nome: dados.nome }
  });

  if (error) {
    throw new Error(error.message || 'Erro ao criar usuário');
  }

  // Se o trigger do Supabase não criar o profile automaticamente (o que ocorreu), precisamos inseri-lo manualmente!
  if (data.user) {
    const { error: profileError } = await adminClient.from('profiles').insert({
      id: data.user.id,
      email: dados.email,
      nome: dados.nome,
      perfil: 'atendente',
      ativo: true,
      primeiro_acesso: true
    });
    
    if (profileError) {
      console.error('Falha ao inserir profile, mas auth user foi criado:', profileError);
    }
  }

  return { id: data.user!.id, nome: dados.nome, email: dados.email };
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
 * Reseta senha do usuário usando a Admin API
 */
export async function resetarSenha(userId: string, novaSenha: string): Promise<void> {
  if (!adminClient) throw new Error('Service Role Key não configurada no .env');

  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    password: novaSenha
  });

  if (error) {
    throw new Error(error.message || 'Erro ao resetar senha');
  }

  // Obrigar o usuário a trocar a senha novamente
  await adminClient.from('profiles').update({
    primeiro_acesso: true
  }).eq('id', userId);
}