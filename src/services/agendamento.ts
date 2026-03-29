import { supabase } from '../lib/supabase';
import type { EleitorFila } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface AgendamentoStatus {
  liberado: boolean;
  motivo: string;
  abre_em: {
    total_segundos: number;
    dias: number;
    horas: number;
    minutos: number;
    segundos: number;
    timestamp: string;
  } | null;
}

interface AgendarEleitorParams {
  dia_atendimento: string;
  nome: string;
  data_nascimento: string;
  pcd: boolean;
  prioritario: boolean;
  servidor_cadastro_id: string;
}

/**
 * Verifica se o agendamento está liberado
 */
export async function checkAgendamentoLiberado(): Promise<AgendamentoStatus> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/check-agendamento-liberado`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const result = await response.json();
  return result;
}

/**
 * Agenda um eleitor
 */
export async function agendarEleitor(params: AgendarEleitorParams): Promise<{
  success: boolean;
  eleitor: EleitorFila;
  senha: number;
  fila: 'prioritaria' | 'normal';
}> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/agendar-eleitor`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(params),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Erro ao agendar');
  }

  return result;
}

/**
 * Busca dias disponíveis para agendamento (Período 2)
 */
export async function fetchDiasAgendamento(): Promise<{
  data: string;
  limite: number;
  ocupadas: number;
  disponiveis: number;
}[]> {
  const { data: configDias, error } = await supabase
    .from('configuracao_dias')
    .select('data, limite_senhas, bloqueado')
    .eq('periodo', 2)
    .order('data', { ascending: true });

  if (error) throw error;

  // Buscar contagem por dia
  const { data: contagens, error: errorCont } = await supabase
    .from('eleitores_fila')
    .select('dia_atendimento')
    .in('dia_atendimento', configDias.map(d => d.data))
    .neq('status', 'cancelado');

  if (errorCont) throw errorCont;

  // Agrupar contagens
  const contagemPorDia: Record<string, number> = {};
  (contagens || []).forEach((item) => {
    const dia = item.dia_atendimento;
    contagemPorDia[dia] = (contagemPorDia[dia] || 0) + 1;
  });

  return configDias
    .filter(d => !d.bloqueado)
    .map(d => ({
      data: d.data,
      limite: d.limite_senhas || 0,
      ocupadas: contagemPorDia[d.data] || 0,
      disponiveis: d.limite_senhas > 0 ? d.limite_senhas - (contagemPorDia[d.data] || 0) : 999,
    }));
}

/**
 * Busca agendamentos de um eleitor (por nome + data nascimento)
 */
export async function buscarAgendamentosEleitor(
  nome: string,
  dataNascimento: string
): Promise<EleitorFila[]> {
  const { data, error } = await supabase
    .from('eleitores_fila')
    .select('*')
    .eq('nome', nome)
    .eq('data_nascimento', dataNascimento)
    .eq('tipo', 'agendado')
    .neq('status', 'cancelado')
    .order('dia_atendimento', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Remarcar agendamento
 */
export async function remarcarAgendamento(
  eleitorId: string,
  novoDia: string,
  servidorId: string
): Promise<EleitorFila> {
  // Buscar agendamento atual
  const { data: atual, error: errorBusca } = await supabase
    .from('eleitores_fila')
    .select('*')
    .eq('id', eleitorId)
    .single();

  if (errorBusca) throw errorBusca;

  // Verificar limite do novo dia
  const { data: configDia } = await supabase
    .from('configuracao_dias')
    .select('limite_senhas')
    .eq('data', novoDia)
    .single();

  if (configDia && configDia.limite_senhas > 0) {
    const { count } = await supabase
      .from('eleitores_fila')
      .select('*', { count: 'exact', head: true })
      .eq('dia_atendimento', novoDia)
      .neq('status', 'cancelado');

    if (count && count >= configDia.limite_senhas) {
      throw new Error('Limite de vagas atingido para este dia');
    }
  }

  // Gerar nova senha
  const { data: ultimaSenha } = await supabase
    .from('eleitores_fila')
    .select('senha')
    .eq('dia_atendimento', novoDia)
    .order('senha', { ascending: false })
    .limit(1)
    .maybeSingle();

  const novaSenha = (ultimaSenha?.senha || 0) + 1;

  // Atualizar
  const { data, error } = await supabase
    .from('eleitores_fila')
    .update({
      dia_atendimento: novoDia,
      senha: novaSenha,
      remarcado_de: atual.dia_atendimento,
      remarcao_count: (atual.remarcao_count || 0) + 1,
      status: 'aguardando',
    })
    .eq('id', eleitorId)
    .select()
    .single();

  if (error) throw error;

  // Registrar log
  await supabase.from('log_acoes').insert({
    servidor_id: servidorId,
    acao: 'remarcacao_agendamento',
    eleitor_id: eleitorId,
    detalhes: {
      dia_anterior: atual.dia_atendimento,
      novo_dia: novoDia,
      nova_senha: novaSenha
    }
  });

  return data;
}

/**
 * Buscar ausentes do Período 2
 */
export async function fetchAusentesPeriodo2(): Promise<EleitorFila[]> {
  const { data: configPeriodo2 } = await supabase
    .from('configuracao_dias')
    .select('data')
    .eq('periodo', 2);

  const diasPeriodo2 = (configPeriodo2 || []).map(d => d.data);

  const { data, error } = await supabase
    .from('eleitores_fila')
    .select('*')
    .in('dia_atendimento', diasPeriodo2)
    .eq('status', 'ausente')
    .order('horario_finalizacao', { ascending: false });

  if (error) throw error;
  return data || [];
}