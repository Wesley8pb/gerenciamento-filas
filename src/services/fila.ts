import { supabase } from '../lib/supabase';
import type { EleitorFila, LogAcao, Profile } from '../types';



interface CadastrarEleitorParams {
  dia_atendimento: string;
  nome: string;
  data_nascimento: string;
  pcd: boolean;
  prioritario: boolean;
  servidor_cadastro_id: string;
}

interface CadastrarEleitorResult {
  success: boolean;
  eleitor: EleitorFila;
  senha: number;
  fila: 'prioritaria' | 'normal';
  posicao: number;
}

/**
 * Busca eleitores da fila de um dia específico
 */
export async function fetchFilaDia(data: string): Promise<EleitorFila[]> {
  const { data: result, error } = await supabase
    .from('eleitores_fila')
    .select('*')
    .eq('dia_atendimento', data)
    // Respeitar ordem manual quando definida (NULLs ficam por último)
    // Fallback: order de chegada (senha)
    .order('ordem_manual', { ascending: true, nullsFirst: false })
    .order('senha', { ascending: true });

  if (error) throw error;
  return result;
}

/**
 * Exclui eleitor da fila (status = cancelado)
 */
export async function excluirEleitorFila(
  eleitorId: string,
  justificativa: string,
  servidorId: string
): Promise<void> {
  // Atualizar status
  const { error: updateError } = await supabase
    .from('eleitores_fila')
    .update({ status: 'cancelado' })
    .eq('id', eleitorId);

  if (updateError) throw updateError;

  // Registrar log
  const { error: logError } = await supabase
    .from('log_acoes')
    .insert({
      servidor_id: servidorId,
      acao: 'exclusao_fila',
      eleitor_id: eleitorId,
      detalhes: { justificativa }
    });

  if (logError) throw logError;
}

/**
 * Altera ordem do eleitor na fila
 */
export async function alterarOrdemFila(
  eleitorId: string,
  novaOrdem: number,
  justificativa: string,
  servidorId: string
): Promise<void> {
  // Buscar ordem anterior
  const { data: eleitor, error: fetchError } = await supabase
    .from('eleitores_fila')
    .select('ordem_manual')
    .eq('id', eleitorId)
    .single();

  if (fetchError) throw fetchError;

  // Atualizar ordem
  const { error: updateError } = await supabase
    .from('eleitores_fila')
    .update({ ordem_manual: novaOrdem })
    .eq('id', eleitorId);

  if (updateError) throw updateError;

  // Registrar log
  const { error: logError } = await supabase
    .from('log_acoes')
    .insert({
      servidor_id: servidorId,
      acao: 'alteracao_ordem',
      eleitor_id: eleitorId,
      detalhes: {
        ordem_anterior: eleitor.ordem_manual,
        nova_ordem: novaOrdem,
        justificativa
      }
    });

  if (logError) throw logError;
}

/**
 * Busca logs de ações
 */
export async function fetchLogs(filtros?: {
  servidor_id?: string;
  data_inicio?: string;
  data_fim?: string;
  acao?: string;
}): Promise<(LogAcao & { servidor?: Profile })[]> {
  let query = supabase
    .from('log_acoes')
    .select(`
      *,
      servidor:profiles!log_acoes_servidor_id_fkey(id, nome, email, perfil)
    `)
    .order('timestamp', { ascending: false })
    .limit(100);

  if (filtros?.servidor_id) {
    query = query.eq('servidor_id', filtros.servidor_id);
  }
  if (filtros?.data_inicio) {
    query = query.gte('timestamp', filtros.data_inicio);
  }
  if (filtros?.data_fim) {
    query = query.lte('timestamp', filtros.data_fim);
  }
  if (filtros?.acao) {
    query = query.eq('acao', filtros.acao);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

/**
 * Cadastra eleitor na fila via Edge Function
 */
export async function cadastrarEleitor(params: CadastrarEleitorParams): Promise<CadastrarEleitorResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Usuário não autenticado');
  }

  const { data, error } = await supabase.functions.invoke('gerar-senha', {
    body: params,
  });

  if (error) {
    throw new Error(error.message || 'Erro ao cadastrar eleitor');
  }

  return data;
}

/**
 * Busca contagem de eleitores na fila do dia
 */
export async function fetchContagemFila(dia: string): Promise<{
  total: number;
  prioritarios: number;
  normais: number;
  aguardando: number;
}> {
  const { count: total, error: errorTotal } = await supabase
    .from('eleitores_fila')
    .select('*', { count: 'exact', head: true })
    .eq('dia_atendimento', dia)
    .neq('status', 'cancelado');

  if (errorTotal) throw errorTotal;

  const { count: prioritarios, error: errorPrio } = await supabase
    .from('eleitores_fila')
    .select('*', { count: 'exact', head: true })
    .eq('dia_atendimento', dia)
    .eq('fila', 'prioritaria')
    .eq('status', 'aguardando');

  if (errorPrio) throw errorPrio;

  const { count: normais, error: errorNorm } = await supabase
    .from('eleitores_fila')
    .select('*', { count: 'exact', head: true })
    .eq('dia_atendimento', dia)
    .eq('fila', 'normal')
    .eq('status', 'aguardando');

  if (errorNorm) throw errorNorm;

  const { count: aguardando, error: errorAgu } = await supabase
    .from('eleitores_fila')
    .select('*', { count: 'exact', head: true })
    .eq('dia_atendimento', dia)
    .eq('status', 'aguardando');

  if (errorAgu) throw errorAgu;

  return {
    total: total || 0,
    prioritarios: prioritarios || 0,
    normais: normais || 0,
    aguardando: aguardando || 0,
  };
}

/**
 * Busca configuração do dia (limite)
 */
export async function fetchConfigDia(dia: string): Promise<{ limite: number; bloqueado: boolean }> {
  const { data, error } = await supabase
    .from('configuracao_dias')
    .select('limite_senhas, bloqueado')
    .eq('data', dia)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return { limite: 0, bloqueado: true };
    }
    throw error;
  }

  return {
    limite: data?.limite_senhas || 0,
    bloqueado: data?.bloqueado || false,
  };
}

/**
 * Verifica duplicidade de eleitor no dia
 */
export async function verificarDuplicidade(
  dia: string,
  nome: string,
  dataNascimento: string
): Promise<EleitorFila | null> {
  const { data, error } = await supabase
    .from('eleitores_fila')
    .select('*')
    .eq('dia_atendimento', dia)
    .eq('nome', nome)
    .eq('data_nascimento', dataNascimento)
    .neq('status', 'cancelado')
    .maybeSingle();

  if (error) throw error;
  return data;
}