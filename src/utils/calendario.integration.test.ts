import { describe, it, expect } from 'vitest'
import {
  isDiaAtivo,
  getPeriodo,
  isDiaBloqueado,
  isDiaEspecial,
} from './calendario'

// Helper para criar data local a partir de string YYYY-MM-DD
function criarDataLocal(dataStr: string): Date {
  const [ano, mes, dia] = dataStr.split('-').map(Number)
  return new Date(ano, mes - 1, dia, 12, 0, 0) // Meio-dia para evitar problemas de fuso
}

describe('Integração: Calendário completo', () => {
  it('deve calcular corretamente todo o calendário eleitoral 2026', () => {
    // Período 1 completo
    const periodo1Dias = [
      '2026-04-13', '2026-04-14', '2026-04-15', '2026-04-16', '2026-04-17',
      '2026-04-20',
      '2026-04-22', '2026-04-23', '2026-04-24',
      '2026-04-27', '2026-04-28', '2026-04-29', '2026-04-30',
      '2026-05-02', // Sábado especial
      '2026-05-04', '2026-05-05', '2026-05-06',
    ]

    // Todos os dias do período 1 devem estar ativos
    periodo1Dias.forEach(dataStr => {
      const data = criarDataLocal(dataStr)
      expect(isDiaAtivo(data), `Esperado ativo: ${dataStr}`).toBe(true)
      expect(getPeriodo(data)).toBe(1)
    })

    // Feriados
    expect(isDiaBloqueado(criarDataLocal('2026-04-21'))).toBe(true)
    expect(isDiaBloqueado(criarDataLocal('2026-05-01'))).toBe(true)

    // Sábado especial
    expect(isDiaEspecial(criarDataLocal('2026-05-02'))).toBe(true)

    // Período 2 (usando datas que são dias úteis)
    const periodo2Dias = [
      '2026-05-07', '2026-05-08',
      '2026-05-11', '2026-05-12', '2026-05-13', '2026-05-14', '2026-05-15',
      '2026-05-18', '2026-05-19', '2026-05-20',
    ]

    periodo2Dias.forEach(dataStr => {
      const data = criarDataLocal(dataStr)
      expect(isDiaAtivo(data), `Esperado ativo: ${dataStr}`).toBe(true)
      expect(getPeriodo(data)).toBe(2)
    })
  })

  it('deve calcular corretamente finais de semana', () => {
    // Domingos - devem estar inativos
    const domingos = ['2026-04-12', '2026-04-19', '2026-04-26', '2026-05-03', '2026-05-10']
    domingos.forEach(dataStr => {
      const data = criarDataLocal(dataStr)
      expect(isDiaAtivo(data), `Esperado inativo: ${dataStr}`).toBe(false)
    })

    // Sábados normais (exceto 02/05) - devem estar inativos
    const sabadosNormais = ['2026-04-11', '2026-04-18', '2026-04-25', '2026-05-09']
    sabadosNormais.forEach(dataStr => {
      const data = criarDataLocal(dataStr)
      expect(isDiaAtivo(data), `Esperado inativo: ${dataStr}`).toBe(false)
    })
  })
})
