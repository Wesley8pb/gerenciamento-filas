import { supabase } from '../lib/supabase';
import type { EleitorFila } from '../types';

export interface FiltrosRelatorio {
  tipo_data: 'unica' | 'intervalo' | 'periodo1' | 'periodo2';
  data_inicio: string;
  data_fim: string;
  status: ('atendido' | 'ausente' | 'aguardando' | 'chamado' | 'cancelado')[];
  categoria: ('todos' | 'prioritaria' | 'normal' | 'pcd');
}

export interface ResumoDiario {
  total_emitidas: number;
  total_atendidos: number;
  total_ausentes: number;
  total_aguardando: number;
  taxa_comparecimento: number;
  prioritarios_atendidos: number;
  prioritarios_ausentes: number;
  normais_atendidos: number;
  normais_ausentes: number;
  pcd_atendidos: number;
  pcd_total: number;
}

export interface DiaResumo {
  data: string;
  limite: number;
  emitidas: number;
  atendidos: number;
  ausentes: number;
  aguardando: number;
  taxa_comparecimento: number;
}

export interface RemarcacaoHistorico {
  id: string;
  nome: string;
  data_nascimento: string;
  fila: 'prioritaria' | 'normal';
  pcd: boolean;
  dia_original: string;
  dia_remarcado: string;
  remarcacao_count: number;
}

/**
 * Busca eleitores filtrados
 */
export async function fetchEleitoresFiltrados(filtros: FiltrosRelatorio): Promise<EleitorFila[]> {
  let query = supabase
    .from('eleitores_fila')
    .select(`
      *,
      servidor_cadastro:profiles!eleitores_fila_servidor_cadastro_id_fkey(nome),
      servidor_atendimento:profiles!eleitores_fila_servidor_atendimento_id_fkey(nome)
    `);

  // Filtro de data
  if (filtros.tipo_data === 'unica') {
    query = query.eq('dia_atendimento', filtros.data_inicio);
  } else if (filtros.tipo_data === 'intervalo') {
    query = query.gte('dia_atendimento', filtros.data_inicio).lte('dia_atendimento', filtros.data_fim);
  } else if (filtros.tipo_data === 'periodo1') {
    query = query.gte('dia_atendimento', '2026-04-13').lte('dia_atendimento', '2026-05-06');
  } else if (filtros.tipo_data === 'periodo2') {
    query = query.gte('dia_atendimento', '2026-05-07').lte('dia_atendimento', '2026-05-20');
  }

  // Filtro de status
  if (filtros.status.length > 0) {
    query = query.in('status', filtros.status);
  }

  // Filtro de categoria
  if (filtros.categoria === 'prioritaria') {
    query = query.eq('fila', 'prioritaria');
  } else if (filtros.categoria === 'normal') {
    query = query.eq('fila', 'normal');
  } else if (filtros.categoria === 'pcd') {
    query = query.eq('pcd', true);
  }

  const { data, error } = await query.order('senha', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Calcula resumo diário
 */
export function calcularResumoDiario(eleitores: EleitorFila[]): ResumoDiario {
  const total_emitidas = eleitores.length;
  const total_atendidos = eleitores.filter(e => e.status === 'atendido').length;
  const total_ausentes = eleitores.filter(e => e.status === 'ausente').length;
  const total_aguardando = eleitores.filter(e => e.status === 'aguardando' || e.status === 'chamado').length;

  const taxa_comparecimento = total_atendidos + total_ausentes > 0
    ? Math.round((total_atendidos / (total_atendidos + total_ausentes)) * 100)
    : 0;

  const prioritarios_atendidos = eleitores.filter(e => e.fila === 'prioritaria' && e.status === 'atendido').length;
  const prioritarios_ausentes = eleitores.filter(e => e.fila === 'prioritaria' && e.status === 'ausente').length;
  const normais_atendidos = eleitores.filter(e => e.fila === 'normal' && e.status === 'atendido').length;
  const normais_ausentes = eleitores.filter(e => e.fila === 'normal' && e.status === 'ausente').length;
  const pcd_atendidos = eleitores.filter(e => e.pcd && e.status === 'atendido').length;
  const pcd_total = eleitores.filter(e => e.pcd).length;

  return {
    total_emitidas,
    total_atendidos,
    total_ausentes,
    total_aguardando,
    taxa_comparecimento,
    prioritarios_atendidos,
    prioritarios_ausentes,
    normais_atendidos,
    normais_ausentes,
    pcd_atendidos,
    pcd_total,
  };
}

/**
 * Busca resumo por período (múltiplos dias)
 */
export async function fetchResumoPeriodo(filtros: FiltrosRelatorio): Promise<DiaResumo[]> {
  // Buscar configuração de dias
  let configQuery = supabase
    .from('configuracao_dias')
    .select('data, limite_senhas')
    .order('data', { ascending: true });

  if (filtros.tipo_data === 'unica') {
    configQuery = configQuery.eq('data', filtros.data_inicio);
  } else if (filtros.tipo_data === 'intervalo') {
    configQuery = configQuery.gte('data', filtros.data_inicio).lte('data', filtros.data_fim);
  } else if (filtros.tipo_data === 'periodo1') {
    configQuery = configQuery.gte('data', '2026-04-13').lte('data', '2026-05-06');
  } else if (filtros.tipo_data === 'periodo2') {
    configQuery = configQuery.gte('data', '2026-05-07').lte('data', '2026-05-20');
  }

  const { data: configDias, error: errorConfig } = await configQuery;
  if (errorConfig) throw errorConfig;

  // Buscar eleitores
  const eleitores = await fetchEleitoresFiltrados({
    ...filtros,
    status: ['atendido', 'ausente', 'aguardando', 'chamado', 'cancelado'],
  });

  // Agrupar por dia
  const resumoPorDia: Record<string, DiaResumo> = {};

  configDias?.forEach(dia => {
    const eleitoresDia = eleitores.filter(e => e.dia_atendimento === dia.data);
    const atendidos = eleitoresDia.filter(e => e.status === 'atendido').length;
    const ausentes = eleitoresDia.filter(e => e.status === 'ausente').length;
    const aguardando = eleitoresDia.filter(e => e.status === 'aguardando' || e.status === 'chamado').length;
    const emitidas = eleitoresDia.length;
    const finalizados = atendidos + ausentes;
    const taxa = finalizados > 0 ? Math.round((atendidos / finalizados) * 100) : 0;

    resumoPorDia[dia.data] = {
      data: dia.data,
      limite: dia.limite_senhas || 0,
      emitidas,
      atendidos,
      ausentes,
      aguardando,
      taxa_comparecimento: taxa,
    };
  });

  return Object.values(resumoPorDia);
}

/**
 * Busca histórico de remarcações
 */
export async function fetchRemarcacoesHistorico(periodo?: 'periodo1' | 'periodo2'): Promise<RemarcacaoHistorico[]> {
  let query = supabase
    .from('eleitores_fila')
    .select('id, nome, data_nascimento, fila, pcd, remarcado_de, dia_atendimento, remarcacao_count')
    .not('remarcado_de', 'is', null)
    .gt('remarcacao_count', 0)
    .order('dia_atendimento', { ascending: true });

  if (periodo === 'periodo1') {
    query = query.gte('dia_atendimento', '2026-04-13').lte('dia_atendimento', '2026-05-06');
  } else if (periodo === 'periodo2') {
    query = query.gte('dia_atendimento', '2026-05-07').lte('dia_atendimento', '2026-05-20');
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(e => ({
    id: e.id,
    nome: e.nome,
    data_nascimento: e.data_nascimento,
    fila: e.fila,
    pcd: e.pcd,
    dia_original: e.remarcado_de || '',
    dia_remarcado: e.dia_atendimento,
    remarcacao_count: e.remarcacao_count || 0,
  }));
}