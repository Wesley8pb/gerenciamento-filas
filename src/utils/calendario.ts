import { format, parseISO, isToday, isAfter } from 'date-fns';

// Dias ativos do Período 1 (13/04 a 06/05, excluindo feriados)
const PERIODO_1_ATIVOS: string[] = [
  '2026-04-13', '2026-04-14', '2026-04-15', '2026-04-16', '2026-04-17',
  '2026-04-20',
  '2026-04-22', '2026-04-23', '2026-04-24',
  '2026-04-27', '2026-04-28', '2026-04-29', '2026-04-30',
  '2026-05-02', // Sábado especial
  '2026-05-04', '2026-05-05', '2026-05-06',
];

// Dias bloqueados (feriados)
const DIAS_BLOQUEADOS: string[] = [
  '2026-04-21', // Tiradentes
  '2026-05-01', // Dia do Trabalho
];

// Dia especial (sábado)
const DIA_ESPECIAL: string = '2026-05-02';

// Dias ativos do Período 2 (07/05 a 20/05)
const PERIODO_2_ATIVOS: string[] = [
  '2026-05-07', '2026-05-08',
  '2026-05-11', '2026-05-12', '2026-05-13', '2026-05-14', '2026-05-15',
  '2026-05-18', '2026-05-19', '2026-05-20',
];

/**
 * Verifica se uma data é um dia ativo de atendimento
 */
export function isDiaAtivo(date: Date): boolean {
  const dateStr = format(date, 'yyyy-MM-dd');

  // Verifica se está bloqueado (feriado)
  if (DIAS_BLOQUEADOS.includes(dateStr)) {
    return false;
  }

  // Verifica se está no Período 1 ou 2
  if (PERIODO_1_ATIVOS.includes(dateStr) || PERIODO_2_ATIVOS.includes(dateStr)) {
    return true;
  }

  // Verifica fim de semana (exceto sábado especial)
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0) return false; // Domingo
  if (dayOfWeek === 6 && dateStr !== DIA_ESPECIAL) return false; // Sábado (exceto especial)

  return false;
}

/**
 * Retorna o período (1 ou 2) de uma data, ou null se fora dos períodos
 */
export function getPeriodo(date: Date): 1 | 2 | null {
  const dateStr = format(date, 'yyyy-MM-dd');

  if (PERIODO_1_ATIVOS.includes(dateStr) || DIAS_BLOQUEADOS.includes(dateStr)) {
    return 1;
  }

  if (PERIODO_2_ATIVOS.includes(dateStr)) {
    return 2;
  }

  return null;
}

/**
 * Verifica se uma data é o dia especial (02/05 - sábado)
 */
export function isDiaEspecial(date: Date): boolean {
  const dateStr = format(date, 'yyyy-MM-dd');
  return dateStr === DIA_ESPECIAL;
}

/**
 * Verifica se uma data está bloqueada (feriado)
 */
export function isDiaBloqueado(date: Date): boolean {
  const dateStr = format(date, 'yyyy-MM-dd');
  return DIAS_BLOQUEADOS.includes(dateStr);
}

/**
 * Retorna todos os dias ativos do Período 1
 */
export function getDiasPeriodo1(): Date[] {
  return PERIODO_1_ATIVOS.map(d => parseISO(d));
}

/**
 * Retorna todos os dias ativos do Período 2
 */
export function getDiasPeriodo2(): Date[] {
  return PERIODO_2_ATIVOS.map(d => parseISO(d));
}

/**
 * Retorna todos os dias bloqueados
 */
export function getDiasBloqueados(): Date[] {
  return DIAS_BLOQUEADOS.map(d => parseISO(d));
}

/**
 * Verifica se é dia de agendamento liberado (06/05 após 18h)
 */
export function isAgendamentoLiberado(serverTime: Date): boolean {
  const liberacao = parseISO('2026-05-06T18:00:00');
  return isAfter(serverTime, liberacao) || isToday(serverTime) && serverTime.getHours() >= 18;
}

/**
 * Formata data para exibição brasileira
 */
export function formatarData(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd/MM/yyyy');
}

/**
 * Formata data completa com dia da semana
 */
export function formatarDataCompleta(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, "EEEE, dd/MM/yyyy");
}

/**
 * Retorna a data atual formatada para consulta no banco
 */
export function getDataAtualISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}