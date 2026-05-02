export function aplicarMascaraDataNascimento(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 8);
  const partes = [
    digitos.slice(0, 2),
    digitos.slice(2, 4),
    digitos.slice(4, 8),
  ].filter(Boolean);

  return partes.join('/');
}

export function converterDataNascimentoParaISO(valor: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor);
  if (!match) return null;

  const [, diaTexto, mesTexto, anoTexto] = match;
  const dia = Number(diaTexto);
  const mes = Number(mesTexto);
  const ano = Number(anoTexto);
  const data = new Date(ano, mes - 1, dia);

  if (
    data.getFullYear() !== ano ||
    data.getMonth() !== mes - 1 ||
    data.getDate() !== dia
  ) {
    return null;
  }

  return `${anoTexto}-${mesTexto}-${diaTexto}`;
}
