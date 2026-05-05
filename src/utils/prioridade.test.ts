import { describe, expect, it } from 'vitest';
import type { EleitorFila } from '../types';
import { calcularIdade, compararOrdemAtendimento, temPrioridade80Mais, temPrioridadeGeral } from './prioridade';

const eleitorBase: EleitorFila = {
  id: 'e-1',
  nome: 'Eleitor',
  data_nascimento: '1960-01-01',
  pcd: false,
  gestante_crianca_colo: false,
  prioritario: true,
  dia_atendimento: '2026-05-01',
  senha: 1,
  tipo: 'presencial',
  fila: 'prioritaria',
  ordem_manual: null,
  status: 'aguardando',
  horario_cadastro: '2026-05-01T08:00:00Z',
  horario_retorno: null,
  horario_chamada: null,
  horario_finalizacao: null,
  remarcado_de: null,
  remarcacao_count: 0,
  retorno_count: 0,
  servidor_cadastro_id: 'srv-1',
  servidor_atendimento_id: null,
};

describe('prioridade', () => {
  const referencia = new Date(2026, 4, 1);

  it('identifica prioridade especial a partir de 80 anos completos', () => {
    expect(calcularIdade('1946-05-01', referencia)).toBe(80);
    expect(temPrioridade80Mais({ data_nascimento: '1946-05-01' }, referencia)).toBe(true);
    expect(temPrioridade80Mais({ data_nascimento: '1946-05-02' }, referencia)).toBe(false);
  });

  it('identifica prioridade geral por idade, PCD ou gestante/criança de colo', () => {
    expect(temPrioridadeGeral({
      data_nascimento: '1990-01-01',
      pcd: false,
      gestante_crianca_colo: true,
    }, referencia)).toBe(true);

    expect(temPrioridadeGeral({
      data_nascimento: '1990-01-01',
      pcd: true,
      gestante_crianca_colo: false,
    }, referencia)).toBe(true);

    expect(temPrioridadeGeral({
      data_nascimento: '1990-01-01',
      pcd: false,
      gestante_crianca_colo: false,
    }, referencia)).toBe(false);
  });

  it('ordena pessoas com 80 anos ou mais antes das demais prioridades', () => {
    const prioridade60: EleitorFila = {
      ...eleitorBase,
      id: 'prioridade-60',
      data_nascimento: '1960-01-01',
      senha: 1,
      ordem_manual: 1,
    };
    const prioridade80: EleitorFila = {
      ...eleitorBase,
      id: 'prioridade-80',
      data_nascimento: '1940-01-01',
      senha: 2,
      ordem_manual: null,
    };

    const ordenados = [prioridade60, prioridade80].sort((a, b) => compararOrdemAtendimento(a, b, referencia));

    expect(ordenados.map((eleitor) => eleitor.id)).toEqual(['prioridade-80', 'prioridade-60']);
  });

  it('mantem ordem manual e senha entre pessoas da mesma faixa de prioridade', () => {
    const primeiro: EleitorFila = { ...eleitorBase, id: 'primeiro', data_nascimento: '1940-01-01', senha: 3 };
    const segundo: EleitorFila = {
      ...eleitorBase,
      id: 'segundo',
      data_nascimento: '1940-01-01',
      senha: 2,
      ordem_manual: 2,
    };

    const ordenados = [primeiro, segundo].sort((a, b) => compararOrdemAtendimento(a, b, referencia));

    expect(ordenados.map((eleitor) => eleitor.id)).toEqual(['segundo', 'primeiro']);
  });

  it('mantem retorno resgatado depois dos normais que ja aguardavam', () => {
    const normalSenha5: EleitorFila = {
      ...eleitorBase,
      id: 'normal-senha-5',
      prioritario: false,
      fila: 'normal',
      senha: 5,
    };
    const normalManual9: EleitorFila = {
      ...eleitorBase,
      id: 'normal-manual-9',
      prioritario: false,
      fila: 'normal',
      senha: 20,
      ordem_manual: 9,
    };
    const retornoResgatado: EleitorFila = {
      ...eleitorBase,
      id: 'retorno-resgatado',
      prioritario: false,
      fila: 'normal',
      senha: 1,
      ordem_manual: 10,
      retorno_count: 1,
    };

    const ordenados = [retornoResgatado, normalManual9, normalSenha5]
      .sort((a, b) => compararOrdemAtendimento(a, b, referencia));

    expect(ordenados.map((eleitor) => eleitor.id)).toEqual([
      'normal-senha-5',
      'normal-manual-9',
      'retorno-resgatado',
    ]);
  });
});
