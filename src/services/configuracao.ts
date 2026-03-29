import { supabase } from '../lib/supabase';
import type { ConfiguracaoDia } from '../types';

/**
 * Busca configuração de todos os dias
 */
export async function fetchConfiguracaoDias(): Promise<ConfiguracaoDia[]> {
  const { data, error } = await supabase
    .from('configuracao_dias')
    .select('*')
    .order('data', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Busca configuração de um dia específico
 */
export async function fetchConfiguracaoDia(data: string): Promise<ConfiguracaoDia | null> {
  const { data: result, error } = await supabase
    .from('configuracao_dias')
    .select('*')
    .eq('data', data)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return result;
}

/**
 * Atualiza configuração de um dia
 */
export async function atualizarConfiguracaoDia(
  id: number,
  dados: Partial<ConfiguracaoDia>
): Promise<ConfiguracaoDia> {
  const { data, error } = await supabase
    .from('configuracao_dias')
    .update(dados)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Aplica mesmo limite para todos os dias ativos
 */
export async function aplicarLimiteTodosDias(limite: number): Promise<void> {
  const { error } = await supabase
    .from('configuracao_dias')
    .update({ limite_senhas: limite })
    .eq('bloqueado', false);

  if (error) throw error;
}

/**
 * Cria uma nova configuração de dia
 */
export async function criarConfiguracaoDia(
  dados: Omit<ConfiguracaoDia, 'id' | 'created_at'>
): Promise<ConfiguracaoDia> {
  // Verifica se a data já existe
  const { data: existente } = await supabase
    .from('configuracao_dias')
    .select('id')
    .eq('data', dados.data)
    .maybeSingle();

  if (existente) {
    throw new Error('Já existe uma configuração para esta data');
  }

  const { data, error } = await supabase
    .from('configuracao_dias')
    .insert(dados)
    .select()
    .single();

  if (error) throw error;
  return data;
}
export async function fetchConfiguracaoSistema(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('configuracao_sistema')
    .select('chave, valor');

  if (error) throw error;

  const config: Record<string, string> = {};
  data.forEach(item => {
    config[item.chave] = item.valor;
  });
  return config;
}

/**
 * Atualiza configuração do sistema
 */
export async function atualizarConfiguracaoSistema(chave: string, valor: string): Promise<void> {
  const { error } = await supabase
    .from('configuracao_sistema')
    .update({ valor, updated_at: new Date().toISOString() })
    .eq('chave', chave);

  if (error) throw error;
}