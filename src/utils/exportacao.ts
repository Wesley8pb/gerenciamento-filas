import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { EleitorFila } from '../types';
import type { ResumoDiario, DiaResumo, RemarcacaoHistorico, FiltrosRelatorio } from '../services/relatorio';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const HEADER_INSTITUCIONAL = '56ª Zona Eleitoral — Juazeirinho/PB';

/**
 * Gera PDF do Resumo Diário
 */
export function exportarResumoDiarioPDF(resumo: ResumoDiario, filtros: FiltrosRelatorio): void {
  const doc = new jsPDF();

  // Cabeçalho institucional
  doc.setFontSize(16);
  doc.text(HEADER_INSTITUCIONAL, 105, 20, { align: 'center' });

  doc.setFontSize(12);
  doc.text('Relatório: Resumo Diário', 105, 30, { align: 'center' });

  // Filtros aplicados
  doc.setFontSize(10);
  doc.setTextColor(100);
  const filtrosTexto = gerarTextoFiltros(filtros);
  doc.text(`Filtros: ${filtrosTexto}`, 14, 40);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, 14, 46);
  doc.setTextColor(0);

  // Cards resumo
  autoTable(doc, {
    startY: 55,
    head: [['Indicador', 'Valor']],
    body: [
      ['Total de Senhas Emitidas', resumo.total_emitidas.toString()],
      ['Atendidos', resumo.total_atendidos.toString()],
      ['Ausentes', resumo.total_ausentes.toString()],
      ['Aguardando', resumo.total_aguardando.toString()],
      ['Taxa de Comparecimento', `${resumo.taxa_comparecimento}%`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [66, 139, 202] },
  });

  // Breakdown por categoria
  const breakdownY = (doc as any).lastAutoTable.finalY + 10;
  autoTable(doc, {
    startY: breakdownY,
    head: [['Categoria', 'Atendidos', 'Ausentes']],
    body: [
      ['Prioritários', resumo.prioritarios_atendidos.toString(), resumo.prioritarios_ausentes.toString()],
      ['Normais', resumo.normais_atendidos.toString(), resumo.normais_ausentes.toString()],
      ['PCD', resumo.pcd_atendidos.toString(), `${resumo.pcd_total} total`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [245, 158, 11] },
  });

  // Rodapé
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
  }

  doc.save(`relatorio_resumo_${format(new Date(), 'ddMMyyyy')}.pdf`);
}

/**
 * Gera PDF da Lista Nominal
 */
export function exportarListaNominalPDF(eleitores: EleitorFila[], filtros: FiltrosRelatorio): void {
  const doc = new jsPDF({ orientation: 'landscape' });

  // Cabeçalho institucional
  doc.setFontSize(16);
  doc.text(HEADER_INSTITUCIONAL, 148, 20, { align: 'center' });

  doc.setFontSize(12);
  doc.text('Relatório: Lista Nominal', 148, 30, { align: 'center' });

  // Filtros
  doc.setFontSize(10);
  doc.setTextColor(100);
  const filtrosTexto = gerarTextoFiltros(filtros);
  doc.text(`Filtros: ${filtrosTexto}`, 14, 40);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} | Total: ${eleitores.length} registros`, 14, 46);
  doc.setTextColor(0);

  // Tabela de dados
  const rows = eleitores.map(e => [
    String(e.senha).padStart(3, '0'),
    e.nome,
    format(parseISO(e.data_nascimento), 'dd/MM/yyyy'),
    e.pcd ? 'Sim' : 'Não',
    e.fila === 'prioritaria' ? 'Prioritário' : 'Normal',
    e.status.charAt(0).toUpperCase() + e.status.slice(1),
    e.horario_finalizacao ? format(parseISO(e.horario_finalizacao), 'HH:mm') : '-',
    (e as any).servidor_atendimento?.nome || '-',
  ]);

  autoTable(doc, {
    startY: 55,
    head: [['Senha', 'Nome', 'Nascimento', 'PCD', 'Categoria', 'Status', 'Horário', 'Servidor']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [66, 139, 202], fontSize: 9 },
    styles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 50 },
      2: { cellWidth: 30 },
      3: { cellWidth: 20 },
      4: { cellWidth: 30 },
      5: { cellWidth: 25 },
      6: { cellWidth: 25 },
      7: { cellWidth: 40 },
    },
  });

  // Rodapé
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
  }

  doc.save(`relatorio_lista_nominal_${format(new Date(), 'ddMMyyyy')}.pdf`);
}

/**
 * Gera PDF da Visão por Período
 */
export function exportarVisaoPeriodoPDF(dias: DiaResumo[], filtros: FiltrosRelatorio): void {
  const doc = new jsPDF({ orientation: 'landscape' });

  // Cabeçalho institucional
  doc.setFontSize(16);
  doc.text(HEADER_INSTITUCIONAL, 148, 20, { align: 'center' });

  doc.setFontSize(12);
  doc.text('Relatório: Visão por Período', 148, 30, { align: 'center' });

  // Filtros
  doc.setFontSize(10);
  doc.setTextColor(100);
  const filtrosTexto = gerarTextoFiltros(filtros);
  doc.text(`Filtros: ${filtrosTexto}`, 14, 40);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, 14, 46);
  doc.setTextColor(0);

  // Tabela resumo por dia
  const rows = dias.map(d => [
    format(parseISO(d.data), "dd/MM/yyyy (EEEE)", { locale: ptBR }),
    d.limite.toString(),
    d.emitidas.toString(),
    d.atendidos.toString(),
    d.ausentes.toString(),
    d.aguardando.toString(),
    `${d.taxa_comparecimento}%`,
  ]);

  autoTable(doc, {
    startY: 55,
    head: [['Dia', 'Limite', 'Emitidas', 'Atendidos', 'Ausentes', 'Aguardando', 'Taxa (%)']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [66, 139, 202], fontSize: 10 },
    styles: { fontSize: 9 },
  });

  // Rodapé
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
  }

  doc.save(`relatorio_visao_periodo_${format(new Date(), 'ddMMyyyy')}.pdf`);
}

/**
 * Gera PDF do Histórico de Remarcações
 */
export function exportarRemarcacoesPDF(remarcacoes: RemarcacaoHistorico[]): void {
  const doc = new jsPDF({ orientation: 'landscape' });

  // Cabeçalho institucional
  doc.setFontSize(16);
  doc.text(HEADER_INSTITUCIONAL, 148, 20, { align: 'center' });

  doc.setFontSize(12);
  doc.text('Relatório: Histórico de Remarcações', 148, 30, { align: 'center' });

  // Filtros
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Total de remarcações: ${remarcacoes.length}`, 14, 40);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, 14, 46);
  doc.setTextColor(0);

  // Tabela
  const rows = remarcacoes.map(r => [
    r.nome,
    format(parseISO(r.data_nascimento), 'dd/MM/yyyy'),
    r.pcd ? 'Sim' : 'Não',
    r.fila === 'prioritaria' ? 'Prioritário' : 'Normal',
    format(parseISO(r.dia_original), 'dd/MM/yyyy'),
    format(parseISO(r.dia_remarcado), 'dd/MM/yyyy'),
    r.remarcao_count.toString(),
  ]);

  autoTable(doc, {
    startY: 55,
    head: [['Nome', 'Nascimento', 'PCD', 'Categoria', 'Dia Original', 'Dia Remarcado', 'Remarcações']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [239, 68, 68], fontSize: 10 },
    styles: { fontSize: 9 },
  });

  // Rodapé
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
  }

  doc.save(`relatorio_remarcacoes_${format(new Date(), 'ddMMyyyy')}.pdf`);
}

/**
 * Gera XLSX da Lista Nominal
 */
export function exportarListaNominalXLSX(eleitores: EleitorFila[]): void {
  const rows = eleitores.map(e => ({
    'Senha': String(e.senha).padStart(3, '0'),
    'Nome': e.nome,
    'Data Nascimento': format(parseISO(e.data_nascimento), 'dd/MM/yyyy'),
    'PCD': e.pcd ? 'Sim' : 'Não',
    'Categoria': e.fila === 'prioritaria' ? 'Prioritário' : 'Normal',
    'Status': e.status.charAt(0).toUpperCase() + e.status.slice(1),
    'Horário Atendimento': e.horario_finalizacao ? format(parseISO(e.horario_finalizacao), 'HH:mm') : '-',
    'Servidor': (e as any).servidor_atendimento?.nome || '-',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Lista Nominal');

  XLSX.writeFile(wb, `relatorio_lista_nominal_${format(new Date(), 'ddMMyyyy')}.xlsx`);
}

/**
 * Gera XLSX da Visão por Período
 */
export function exportarVisaoPeriodoXLSX(dias: DiaResumo[]): void {
  const rows = dias.map(d => ({
    'Dia': format(parseISO(d.data), 'dd/MM/yyyy'),
    'Limite': d.limite,
    'Emitidas': d.emitidas,
    'Atendidos': d.atendidos,
    'Ausentes': d.ausentes,
    'Aguardando': d.aguardando,
    'Taxa (%)': d.taxa_comparecimento,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Visão Período');

  XLSX.writeFile(wb, `relatorio_visao_periodo_${format(new Date(), 'ddMMyyyy')}.xlsx`);
}

/**
 * Gera XLSX do Histórico de Remarcações
 */
export function exportarRemarcacoesXLSX(remarcacoes: RemarcacaoHistorico[]): void {
  const rows = remarcacoes.map(r => ({
    'Nome': r.nome,
    'Data Nascimento': format(parseISO(r.data_nascimento), 'dd/MM/yyyy'),
    'PCD': r.pcd ? 'Sim' : 'Não',
    'Categoria': r.fila === 'prioritaria' ? 'Prioritário' : 'Normal',
    'Dia Original': format(parseISO(r.dia_original), 'dd/MM/yyyy'),
    'Dia Remarcado': format(parseISO(r.dia_remarcado), 'dd/MM/yyyy'),
    'Total Remarcações': r.remarcao_count,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Remarcações');

  XLSX.writeFile(wb, `relatorio_remarcacoes_${format(new Date(), 'ddMMyyyy')}.xlsx`);
}

/**
 * Gera texto descritivo dos filtros aplicados
 */
function gerarTextoFiltros(filtros: FiltrosRelatorio): string {
  const partes: string[] = [];

  if (filtros.tipo_data === 'unica') {
    partes.push(`Data: ${format(parseISO(filtros.data_inicio), 'dd/MM/yyyy')}`);
  } else if (filtros.tipo_data === 'intervalo') {
    partes.push(`Período: ${format(parseISO(filtros.data_inicio), 'dd/MM/yyyy')} a ${format(parseISO(filtros.data_fim), 'dd/MM/yyyy')}`);
  } else if (filtros.tipo_data === 'periodo1') {
    partes.push('Período 1 (13/04 - 06/05)');
  } else if (filtros.tipo_data === 'periodo2') {
    partes.push('Período 2 (07/05 - 20/05)');
  }

  if (filtros.status.length > 0) {
    const statusLabels = filtros.status.map(s => s.charAt(0).toUpperCase() + s.slice(1));
    partes.push(`Status: ${statusLabels.join(', ')}`);
  }

  if (filtros.categoria !== 'todos') {
    const catLabels = { 'prioritaria': 'Prioritários', 'normal': 'Normais', 'pcd': 'PCD' };
    partes.push(`Categoria: ${catLabels[filtros.categoria]}`);
  }

  return partes.join(' | ');
}