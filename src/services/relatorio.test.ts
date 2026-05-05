import { describe, expect, it } from 'vitest';
import type { EleitorFila } from '../types';
import { calcularResumoDiario } from './relatorio';

const eleitorBase: EleitorFila = {
  id: 'e-1',
  nome: 'Eleitor',
  data_nascimento: '1990-01-01',
  pcd: false,
  gestante_crianca_colo: false,
  prioritario: false,
  dia_atendimento: '2026-05-05',
  senha: 1,
  tipo: 'presencial',
  fila: 'normal',
  ordem_manual: null,
  status: 'atendido',
  horario_cadastro: '2026-05-05T08:00:00Z',
  horario_retorno: null,
  horario_chamada: null,
  horario_finalizacao: '2026-05-05T08:10:00Z',
  remarcado_de: null,
  remarcacao_count: 0,
  retorno_count: 0,
  servidor_cadastro_id: 'srv-1',
  servidor_atendimento_id: 'srv-2',
};

describe('relatorio service', () => {
  it('mantem gestante/criança de colo dentro dos prioritarios gerais e PCD separado', () => {
    const gestante: EleitorFila = {
      ...eleitorBase,
      id: 'gestante',
      gestante_crianca_colo: true,
      prioritario: true,
      fila: 'prioritaria',
    };
    const pcd: EleitorFila = {
      ...eleitorBase,
      id: 'pcd',
      pcd: true,
      prioritario: true,
      fila: 'prioritaria',
    };

    const resumo = calcularResumoDiario([gestante, pcd]);

    expect(resumo.prioritarios_atendidos).toBe(2);
    expect(resumo.pcd_atendidos).toBe(1);
    expect(resumo.pcd_total).toBe(1);
  });
});
