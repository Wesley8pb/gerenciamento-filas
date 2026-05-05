import type { EleitorFila } from '../types';

export function calcularIdade(dataNascimento: string, referencia: Date = new Date()): number {
  const [ano, mes, dia] = dataNascimento.split('-').map(Number);
  const aniversarioJaPassou =
    referencia.getMonth() + 1 > mes ||
    (referencia.getMonth() + 1 === mes && referencia.getDate() >= dia);

  return referencia.getFullYear() - ano - (aniversarioJaPassou ? 0 : 1);
}

export function temPrioridade80Mais(eleitor: Pick<EleitorFila, 'data_nascimento'>, referencia?: Date): boolean {
  return calcularIdade(eleitor.data_nascimento, referencia) >= 80;
}

export function temPrioridadeGeral(
  eleitor: Pick<EleitorFila, 'data_nascimento' | 'pcd' | 'gestante_crianca_colo'>,
  referencia?: Date
): boolean {
  return calcularIdade(eleitor.data_nascimento, referencia) >= 60 || eleitor.pcd || eleitor.gestante_crianca_colo;
}

export function compararOrdemAtendimento(a: EleitorFila, b: EleitorFila, referencia?: Date): number {
  if (a.fila !== b.fila) {
    const ordemFila = { prioritaria: 0, normal: 1, retorno: 2 };
    return ordemFila[a.fila] - ordemFila[b.fila];
  }

  if (a.fila === 'prioritaria') {
    const prioridade80 = Number(temPrioridade80Mais(b, referencia)) - Number(temPrioridade80Mais(a, referencia));
    if (prioridade80 !== 0) return prioridade80;
  }

  const ordemManualA = a.ordem_manual ?? a.senha;
  const ordemManualB = b.ordem_manual ?? b.senha;
  if (ordemManualA !== ordemManualB) return ordemManualA - ordemManualB;

  return a.senha - b.senha;
}
