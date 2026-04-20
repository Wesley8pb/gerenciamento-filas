import { supabase, SUPABASE_URL } from '../lib/supabase';
import type { EleitorFila } from '../types';

/**
 * Chama o próximo eleitor da fila
 */
export async function chamarProximo(diaAtendimento: string, servidorId: string): Promise<EleitorFila> {
  // Obter token JWT do usuário logado
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Usuário não autenticado');
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/chamar-proximo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      dia_atendimento: diaAtendimento,
      servidor_id: servidorId,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Erro ao chamar próximo');
  }

  return result.eleitor;
}

/**
 * Finaliza atendimento (atendido ou ausente)
 */
export async function finalizarAtendimento(
  eleitorId: string,
  status: 'atendido' | 'ausente',
  servidorId: string
): Promise<EleitorFila> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('eleitores_fila')
    .update({
      status,
      horario_finalizacao: now,
      servidor_atendimento_id: servidorId,
    })
    .eq('id', eleitorId)
    .select()
    .single();

  if (error) throw error;

  // Registrar log
  await supabase.from('log_acoes').insert({
    servidor_id: servidorId,
    acao: 'atendimento',
    eleitor_id: eleitorId,
    detalhes: { status },
  });

  return data;
}

/**
 * Registra retorno de ausente
 * Usa increment atômico via SQL para evitar race condition em retorno_count
 * (quando chamado em rápida sucessão por múltiplas sessões).
 */
export async function registrarRetorno(
  eleitorId: string,
  servidorId: string
): Promise<EleitorFila> {
  const now = new Date().toISOString();

  // UPDATE atômico: sem SELECT prévio. retorno_count é incrementado via RPC
  // registrar_retorno_atomico (migration). Enquanto a RPC não é obrigatória,
  // delegamos via expressão de SQL crua usando a propriedade do supabase-js
  // de aceitar um objeto sem o campo e depois fazer uma segunda operação não
  // resolveria a corrida. Por isso o padrão correto é via RPC.
  const { data, error } = await supabase
    .rpc('registrar_retorno_atomico', {
      p_eleitor_id: eleitorId,
      p_servidor_id: servidorId,
      p_horario_retorno: now,
    })
    .single();

  if (error) throw error;

  return data as EleitorFila;
}

/**
 * Desfaz última ação (dentro da janela de 2 minutos)
 */
export async function desfazerAcao(
  eleitorId: string,
  statusAnterior: 'aguardando' | 'chamado'
): Promise<EleitorFila> {
  const { data, error } = await supabase
    .from('eleitores_fila')
    .update({
      status: statusAnterior,
      horario_finalizacao: null,
      servidor_atendimento_id: null,
    })
    .eq('id', eleitorId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

/**
 * Busca fila completa do dia
 */
export async function fetchFilaCompleta(dia: string): Promise<{
  prioritarios: EleitorFila[];
  normais: EleitorFila[];
  retornos: EleitorFila[];
  chamados: EleitorFila[];
  ausentes: EleitorFila[];
}> {
  const { data, error } = await supabase
    .from('eleitores_fila')
    .select('*')
    .eq('dia_atendimento', dia)
    .order('senha', { ascending: true });

  if (error) throw error;

  return {
    prioritarios: data.filter(e => e.fila === 'prioritaria' && e.status === 'aguardando'),
    normais: data.filter(e => e.fila === 'normal' && e.status === 'aguardando'),
    retornos: data.filter(e => e.fila === 'retorno' && e.status === 'aguardando'),
    chamados: data.filter(e => e.status === 'chamado'),
    ausentes: data.filter(e => e.status === 'ausente'),
  };
}

/**
 * Busca histórico de atendidos do dia
 */
export async function fetchHistoricoAtendidos(dia: string, limite: number = 10): Promise<EleitorFila[]> {
  const { data, error } = await supabase
    .from('eleitores_fila')
    .select('*')
    .eq('dia_atendimento', dia)
    .in('status', ['atendido', 'ausente'])
    .order('horario_finalizacao', { ascending: false })
    .limit(limite);

  if (error) throw error;
  return data;
}