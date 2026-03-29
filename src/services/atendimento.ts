import { supabase } from '../lib/supabase';
import type { EleitorFila } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * Chama o próximo eleitor da fila
 */
export async function chamarProximo(diaAtendimento: string, servidorId: string): Promise<EleitorFila> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/chamar-proximo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
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
 */
export async function registrarRetorno(
  eleitorId: string,
  servidorId: string
): Promise<EleitorFila> {
  const now = new Date().toISOString();

  // Buscar retorno_count atual
  const { data: eleitorAtual } = await supabase
    .from('eleitores_fila')
    .select('retorno_count')
    .eq('id', eleitorId)
    .single();

  const novoRetornoCount = (eleitorAtual?.retorno_count || 0) + 1;

  const { data, error } = await supabase
    .from('eleitores_fila')
    .update({
      status: 'aguardando',
      fila: 'retorno',
      horario_retorno: now,
      retorno_count: novoRetornoCount,
    })
    .eq('id', eleitorId)
    .select()
    .single();

  if (error) throw error;

  // Registrar log
  await supabase.from('log_acoes').insert({
    servidor_id: servidorId,
    acao: 'registro_retorno',
    eleitor_id: eleitorId,
    detalhes: { horario_retorno: now },
  });

  return data;
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