import { describe, expect, it } from 'vitest';
import { aplicarMascaraDataNascimento, converterDataNascimentoParaISO } from './dataNascimento';

describe('dataNascimento', () => {
  it('aplica mascara DD/MM/AAAA mantendo apenas numeros', () => {
    expect(aplicarMascaraDataNascimento('01011980')).toBe('01/01/1980');
    expect(aplicarMascaraDataNascimento('01a02b2003')).toBe('01/02/2003');
    expect(aplicarMascaraDataNascimento('311219901234')).toBe('31/12/1990');
  });

  it('permite preenchimento parcial da mascara', () => {
    expect(aplicarMascaraDataNascimento('1')).toBe('1');
    expect(aplicarMascaraDataNascimento('120')).toBe('12/0');
    expect(aplicarMascaraDataNascimento('1205')).toBe('12/05');
  });

  it('converte data valida para ISO', () => {
    expect(converterDataNascimentoParaISO('05/04/1980')).toBe('1980-04-05');
  });

  it('recusa datas incompletas ou inexistentes', () => {
    expect(converterDataNascimentoParaISO('05/04/')).toBeNull();
    expect(converterDataNascimentoParaISO('31/02/1980')).toBeNull();
    expect(converterDataNascimentoParaISO('99/99/1980')).toBeNull();
  });
});
