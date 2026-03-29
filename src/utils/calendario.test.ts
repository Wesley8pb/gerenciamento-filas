import { describe, it, expect } from 'vitest'
import {
  isDiaAtivo,
  getPeriodo,
  isDiaEspecial,
  isDiaBloqueado,
  getDiasPeriodo1,
  getDiasPeriodo2,
  getDiasBloqueados,
  isAgendamentoLiberado,
  formatarData,
  formatarDataCompleta,
  getDataAtualISO,
} from './calendario'

// Helper para criar data local a partir de string YYYY-MM-DD
function criarDataLocal(dataStr: string): Date {
  const [ano, mes, dia] = dataStr.split('-').map(Number)
  return new Date(ano, mes - 1, dia, 12, 0, 0) // Meio-dia para evitar problemas de fuso
}

describe('calendario', () => {
  describe('isDiaAtivo', () => {
    it('deve retornar true para dias do período 1', () => {
      const dia = criarDataLocal('2026-04-15')
      expect(isDiaAtivo(dia)).toBe(true)
    })

    it('deve retornar true para dias do período 2', () => {
      const dia = criarDataLocal('2026-05-11')
      expect(isDiaAtivo(dia)).toBe(true)
    })

    it('deve retornar false para feriado (Tiradentes)', () => {
      const tiradentes = criarDataLocal('2026-04-21')
      expect(isDiaAtivo(tiradentes)).toBe(false)
    })

    it('deve retornar false para Dia do Trabalho', () => {
      const trabalho = criarDataLocal('2026-05-01')
      expect(isDiaAtivo(trabalho)).toBe(false)
    })

    it('deve retornar true para sábado especial (02/05)', () => {
      const sabadoEspecial = criarDataLocal('2026-05-02')
      expect(isDiaAtivo(sabadoEspecial)).toBe(true)
    })

    it('deve retornar false para domingo', () => {
      const domingo = criarDataLocal('2026-04-12')
      expect(isDiaAtivo(domingo)).toBe(false)
    })

    it('deve retornar false para sábado normal (não especial)', () => {
      const sabadoNormal = criarDataLocal('2026-04-18')
      expect(isDiaAtivo(sabadoNormal)).toBe(false)
    })

    it('deve retornar false para data fora dos períodos', () => {
      const foraPeriodo = criarDataLocal('2026-06-01')
      expect(isDiaAtivo(foraPeriodo)).toBe(false)
    })
  })

  describe('getPeriodo', () => {
    it('deve retornar 1 para dia do período 1', () => {
      const dia = criarDataLocal('2026-04-15')
      expect(getPeriodo(dia)).toBe(1)
    })

    it('deve retornar 1 para feriado no período 1', () => {
      const feriado = criarDataLocal('2026-04-21')
      expect(getPeriodo(feriado)).toBe(1)
    })

    it('deve retornar 2 para dia do período 2', () => {
      const dia = criarDataLocal('2026-05-11')
      expect(getPeriodo(dia)).toBe(2)
    })

    it('deve retornar null para data fora dos períodos', () => {
      const foraPeriodo = criarDataLocal('2026-06-01')
      expect(getPeriodo(foraPeriodo)).toBeNull()
    })
  })

  describe('isDiaEspecial', () => {
    it('deve retornar true para 02/05/2026', () => {
      const dia = criarDataLocal('2026-05-02')
      expect(isDiaEspecial(dia)).toBe(true)
    })

    it('deve retornar false para outros dias', () => {
      const outroDia = criarDataLocal('2026-05-03')
      expect(isDiaEspecial(outroDia)).toBe(false)
    })
  })

  describe('isDiaBloqueado', () => {
    it('deve retornar true para Tiradentes', () => {
      const tiradentes = criarDataLocal('2026-04-21')
      expect(isDiaBloqueado(tiradentes)).toBe(true)
    })

    it('deve retornar true para Dia do Trabalho', () => {
      const trabalho = criarDataLocal('2026-05-01')
      expect(isDiaBloqueado(trabalho)).toBe(true)
    })

    it('deve retornar false para dia ativo', () => {
      const diaAtivo = criarDataLocal('2026-04-15')
      expect(isDiaBloqueado(diaAtivo)).toBe(false)
    })
  })

  describe('getDiasPeriodo1', () => {
    it('deve retornar array com 17 dias', () => {
      const dias = getDiasPeriodo1()
      expect(dias.length).toBe(17)
    })

    it('deve retornar datas válidas', () => {
      const dias = getDiasPeriodo1()
      expect(dias[0]).toBeInstanceOf(Date)
    })
  })

  describe('getDiasPeriodo2', () => {
    it('deve retornar array com 10 dias', () => {
      const dias = getDiasPeriodo2()
      expect(dias.length).toBe(10)
    })
  })

  describe('getDiasBloqueados', () => {
    it('deve retornar array com 2 feriados', () => {
      const dias = getDiasBloqueados()
      expect(dias.length).toBe(2)
    })
  })

  describe('isAgendamentoLiberado', () => {
    it('deve retornar true após 06/05 às 18h', () => {
      const depoisLiberacao = new Date('2026-05-06T19:00:00')
      expect(isAgendamentoLiberado(depoisLiberacao)).toBe(true)
    })

    it('deve retornar false antes de 06/05 às 18h', () => {
      const antesLiberacao = new Date('2026-05-06T17:00:00')
      expect(isAgendamentoLiberado(antesLiberacao)).toBe(false)
    })

    it('deve retornar false em dia anterior', () => {
      const diaAnterior = new Date('2026-05-05T20:00:00')
      expect(isAgendamentoLiberado(diaAnterior)).toBe(false)
    })
  })

  describe('formatarData', () => {
    it('deve formatar data no padrão brasileiro', () => {
      const data = criarDataLocal('2026-04-15')
      const resultado = formatarData(data)
      expect(resultado).toBe('15/04/2026')
    })

    it('deve aceitar string ISO', () => {
      const resultado = formatarData('2026-04-15')
      expect(resultado).toBe('15/04/2026')
    })
  })

  describe('formatarDataCompleta', () => {
    it('deve incluir dia da semana', () => {
      const data = criarDataLocal('2026-04-15')
      const resultado = formatarDataCompleta(data)
      expect(resultado).toContain('15/04/2026')
      expect(resultado.length).toBeGreaterThan(10)
    })
  })

  describe('getDataAtualISO', () => {
    it('deve retornar string no formato ISO', () => {
      const resultado = getDataAtualISO()
      expect(resultado).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })
})
