import { useState, useCallback } from 'react';
import { Layout } from '../components/Layout';
import { FiltrosRelatorio } from '../components/FiltrosRelatorio';
import {
  fetchEleitoresFiltrados,
  fetchResumoPeriodo,
  fetchRemarcacoesHistorico,
  calcularResumoDiario,
  type FiltrosRelatorio as FiltrosType,
  type ResumoDiario,
  type DiaResumo,
  type RemarcacaoHistorico,
} from '../services/relatorio';
import {
  exportarResumoDiarioPDF,
  exportarListaNominalPDF,
  exportarVisaoPeriodoPDF,
  exportarRemarcacoesPDF,
  exportarListaNominalXLSX,
  exportarVisaoPeriodoXLSX,
  exportarRemarcacoesXLSX,
} from '../utils/exportacao';
import type { EleitorFila } from '../types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Download, Loader2, Users, CheckCircle, XCircle, Clock, PieChart, BarChart3, History, Table, ChevronUp, ChevronDown, Accessibility } from 'lucide-react';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

type TabType = 'resumo' | 'lista' | 'periodo' | 'remarcacoes';

export function RelatoriosPage() {
  // Estados
  const [filtros, setFiltros] = useState<FiltrosType>({
    tipo_data: 'unica',
    data_inicio: '',
    data_fim: '',
    status: ['atendido', 'ausente'],
    categoria: 'todos',
  });
  const [activeTab, setActiveTab] = useState<TabType>('resumo');
  const [loading, setLoading] = useState(false);

  // Dados
  const [eleitores, setEleitores] = useState<EleitorFila[]>([]);
  const [resumo, setResumo] = useState<ResumoDiario | null>(null);
  const [diasResumo, setDiasResumo] = useState<DiaResumo[]>([]);
  const [remarcacoes, setRemarcacoes] = useState<RemarcacaoHistorico[]>([]);

  // Paginação lista nominal
  const [pagina, setPagina] = useState(1);
  const [ordemCampo, setOrdemCampo] = useState<'senha' | 'nome' | 'horario_finalizacao'>('senha');
  const [ordemDirecao, setOrdemDirecao] = useState<'asc' | 'desc'>('asc');
  const POR_PAGINA = 50;

  // Carregar dados quando filtros mudam
  const handleFiltrosChange = useCallback(async (novosFiltros: FiltrosType) => {
    setFiltros(novosFiltros);

    // Validar se há data selecionada
    if (!novosFiltros.data_inicio && novosFiltros.tipo_data === 'unica') return;
    if (!novosFiltros.data_inicio && novosFiltros.tipo_data === 'intervalo') return;

    setLoading(true);
    try {
      // Carregar eleitores
      const eleitoresData = await fetchEleitoresFiltrados(novosFiltros);
      setEleitores(eleitoresData);

      // Calcular resumo
      const resumoData = calcularResumoDiario(eleitoresData);
      setResumo(resumoData);

      // Carregar resumo por período
      const diasData = await fetchResumoPeriodo(novosFiltros);
      setDiasResumo(diasData);

      // Carregar remarcações se for relevante
      const periodo = novosFiltros.tipo_data === 'periodo1' ? 'periodo1' :
                      novosFiltros.tipo_data === 'periodo2' ? 'periodo2' : undefined;
      const remarcoesData = await fetchRemarcacoesHistorico(periodo);
      setRemarcacoes(remarcoesData);

      setPagina(1);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Ordenar lista nominal
  const eleitoresOrdenados = [...eleitores].sort((a, b) => {
    let valorA: any;
    let valorB: any;

    if (ordemCampo === 'senha') {
      valorA = a.senha;
      valorB = b.senha;
    } else if (ordemCampo === 'nome') {
      valorA = a.nome.toLowerCase();
      valorB = b.nome.toLowerCase();
    } else {
      valorA = a.horario_finalizacao || '';
      valorB = b.horario_finalizacao || '';
    }

    if (ordemDirecao === 'asc') {
      return valorA < valorB ? -1 : valorA > valorB ? 1 : 0;
    } else {
      return valorA > valorB ? -1 : valorA < valorB ? 1 : 0;
    }
  });

  // Paginar
  const totalPaginas = Math.ceil(eleitoresOrdenados.length / POR_PAGINA);
  const eleitoresPaginados = eleitoresOrdenados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  // Alternar ordenação
  const toggleOrdem = (campo: 'senha' | 'nome' | 'horario_finalizacao') => {
    if (ordemCampo === campo) {
      setOrdemDirecao(ordemDirecao === 'asc' ? 'desc' : 'asc');
    } else {
      setOrdemCampo(campo);
      setOrdemDirecao('asc');
    }
  };

  // Dados para gráfico pizza
  const dadosPizza = resumo ? [
    { name: 'Atendidos', value: resumo.total_atendidos, color: '#22c55e' },
    { name: 'Ausentes', value: resumo.total_ausentes, color: '#ef4444' },
    { name: 'Aguardando', value: resumo.total_aguardando, color: '#3b82f6' },
  ] : [];

  // Dados para gráfico barras
  const dadosBarras = diasResumo.map(d => ({
    name: format(parseISO(d.data), 'dd/MM'),
    atendidos: d.atendidos,
    ausentes: d.ausentes,
  }));

  // Tabs
  const tabs = [
    { id: 'resumo', label: 'Resumo Diário', icon: PieChart },
    { id: 'lista', label: 'Lista Nominal', icon: Table },
    { id: 'periodo', label: 'Visão Período', icon: BarChart3 },
    { id: 'remarcacoes', label: 'Remarcações', icon: History },
  ];

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Relatórios</h1>
        <p className="text-gray-500">Análise e exportação de dados do sistema</p>
      </div>

      {/* Filtros */}
      <FiltrosRelatorio onFiltrosChange={handleFiltrosChange} />

      {/* Tabs */}
      <div className="flex space-x-2 mb-6 border-b">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`px-4 py-2 flex items-center space-x-2 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon size={18} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-blue-600" size={32} />
        </div>
      )}

      {/* Conteúdo das tabs */}
      {!loading && (
        <>
          {/* Tab Resumo Diário */}
          {activeTab === 'resumo' && resumo && (
            <div>
              {/* Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <FileText className="text-gray-400" size={18} />
                    <span className="text-sm text-gray-500">Total Emitidas</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-800">{resumo.total_emitidas}</p>
                </div>

                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <CheckCircle className="text-green-500" size={18} />
                    <span className="text-sm text-gray-500">Atendidos</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600">{resumo.total_atendidos}</p>
                </div>

                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <XCircle className="text-red-500" size={18} />
                    <span className="text-sm text-gray-500">Ausentes</span>
                  </div>
                  <p className="text-2xl font-bold text-red-600">{resumo.total_ausentes}</p>
                </div>

                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Clock className="text-blue-500" size={18} />
                    <span className="text-sm text-gray-500">Aguardando</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">{resumo.total_aguardando}</p>
                </div>

                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Users className="text-purple-500" size={18} />
                    <span className="text-sm text-gray-500">Comparecimento</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-600">{resumo.taxa_comparecimento}%</p>
                </div>
              </div>

              {/* Breakdown */}
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h3 className="font-semibold text-gray-700 mb-4">Detalhamento por Categoria</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-orange-50 rounded-lg p-4">
                    <p className="text-sm text-orange-600 mb-2">Prioritários</p>
                    <div className="flex space-x-4">
                      <div>
                        <span className="text-sm text-gray-500">Atendidos</span>
                        <p className="text-lg font-semibold text-orange-700">{resumo.prioritarios_atendidos}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Ausentes</span>
                        <p className="text-lg font-semibold text-red-600">{resumo.prioritarios_ausentes}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm text-blue-600 mb-2">Normais</p>
                    <div className="flex space-x-4">
                      <div>
                        <span className="text-sm text-gray-500">Atendidos</span>
                        <p className="text-lg font-semibold text-blue-700">{resumo.normais_atendidos}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Ausentes</span>
                        <p className="text-lg font-semibold text-red-600">{resumo.normais_ausentes}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-purple-50 rounded-lg p-4">
                    <p className="text-sm text-purple-600 mb-2 flex items-center">
                      <Accessibility size={14} className="mr-1" /> PCD
                    </p>
                    <div className="flex space-x-4">
                      <div>
                        <span className="text-sm text-gray-500">Atendidos</span>
                        <p className="text-lg font-semibold text-purple-700">{resumo.pcd_atendidos}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Total</span>
                        <p className="text-lg font-semibold text-gray-700">{resumo.pcd_total}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Gráfico Pizza */}
              {resumo.total_emitidas > 0 && (
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                  <h3 className="font-semibold text-gray-700 mb-4">Proporção Atendidos x Ausentes</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie
                          data={dadosPizza}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          fill="#8884d8"
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent ? percent * 100 : 0).toFixed(0)}%`}
                        >
                          {dadosPizza.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Exportar */}
              <div className="flex space-x-2">
                <button
                  onClick={() => exportarResumoDiarioPDF(resumo, filtros)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center space-x-2"
                >
                  <FileText size={18} />
                  <span>Exportar PDF</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab Lista Nominal */}
          {activeTab === 'lista' && (
            <div>
              <div className="bg-white rounded-lg shadow overflow-hidden mb-4">
                <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    {eleitores.length} registros encontrados
                  </span>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => exportarListaNominalPDF(eleitores, filtros)}
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 flex items-center space-x-1 text-sm"
                    >
                      <FileText size={14} />
                      <span>PDF</span>
                    </button>
                    <button
                      onClick={() => exportarListaNominalXLSX(eleitores)}
                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 flex items-center space-x-1 text-sm"
                    >
                      <Download size={14} />
                      <span>XLSX</span>
                    </button>
                  </div>
                </div>

                {/* Tabela */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">
                          <button onClick={() => toggleOrdem('senha')} className="flex items-center space-x-1 hover:text-gray-800">
                            <span>Senha</span>
                            {ordemCampo === 'senha' && (ordemDirecao === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                          </button>
                        </th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">
                          <button onClick={() => toggleOrdem('nome')} className="flex items-center space-x-1 hover:text-gray-800">
                            <span>Nome</span>
                            {ordemCampo === 'nome' && (ordemDirecao === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                          </button>
                        </th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Nascimento</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">PCD</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Categoria</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Status</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">
                          <button onClick={() => toggleOrdem('horario_finalizacao')} className="flex items-center space-x-1 hover:text-gray-800">
                            <span>Horário</span>
                            {ordemCampo === 'horario_finalizacao' && (ordemDirecao === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                          </button>
                        </th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Servidor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {eleitoresPaginados.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                            Nenhum registro encontrado
                          </td>
                        </tr>
                      ) : (
                        eleitoresPaginados.map((eleitor) => (
                          <tr key={eleitor.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-mono font-semibold">{String(eleitor.senha).padStart(3, '0')}</td>
                            <td className="px-4 py-2 text-gray-700">{eleitor.nome}</td>
                            <td className="px-4 py-2 text-sm text-gray-600">
                              {format(parseISO(eleitor.data_nascimento), 'dd/MM/yyyy')}
                            </td>
                            <td className="px-4 py-2">
                              {eleitor.pcd ? (
                                <span className="text-purple-600 flex items-center">
                                  <Accessibility size={14} className="mr-1" /> Sim
                                </span>
                              ) : (
                                <span className="text-gray-400">Não</span>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs ${
                                eleitor.fila === 'prioritaria'
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {eleitor.fila === 'prioritaria' ? 'Prioritário' : 'Normal'}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs ${
                                eleitor.status === 'atendido' ? 'bg-green-100 text-green-700' :
                                eleitor.status === 'ausente' ? 'bg-red-100 text-red-700' :
                                eleitor.status === 'aguardando' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {eleitor.status.charAt(0).toUpperCase() + eleitor.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600">
                              {eleitor.horario_finalizacao
                                ? format(parseISO(eleitor.horario_finalizacao), 'HH:mm')
                                : '-'}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600">
                              {(eleitor as any).servidor_atendimento?.nome || '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Paginação */}
                {totalPaginas > 1 && (
                  <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      Página {pagina} de {totalPaginas}
                    </span>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setPagina(p => Math.max(1, p - 1))}
                        disabled={pagina === 1}
                        className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Anterior
                      </button>
                      <button
                        onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                        disabled={pagina === totalPaginas}
                        className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Próxima
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab Visão por Período */}
          {activeTab === 'periodo' && (
            <div>
              {/* Gráfico de barras */}
              {diasResumo.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6 mb-6">
                  <h3 className="font-semibold text-gray-700 mb-4">Atendidos e Ausentes por Dia</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dadosBarras}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="atendidos" fill="#22c55e" name="Atendidos" />
                        <Bar dataKey="ausentes" fill="#ef4444" name="Ausentes" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Tabela resumo */}
              <div className="bg-white rounded-lg shadow overflow-hidden mb-4">
                <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    {diasResumo.length} dias no período
                  </span>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => exportarVisaoPeriodoPDF(diasResumo, filtros)}
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 flex items-center space-x-1 text-sm"
                    >
                      <FileText size={14} />
                      <span>PDF</span>
                    </button>
                    <button
                      onClick={() => exportarVisaoPeriodoXLSX(diasResumo)}
                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 flex items-center space-x-1 text-sm"
                    >
                      <Download size={14} />
                      <span>XLSX</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Dia</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Limite</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Emitidas</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Atendidos</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Ausentes</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Aguardando</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Taxa (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {diasResumo.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                            Nenhum dia encontrado
                          </td>
                        </tr>
                      ) : (
                        diasResumo.map((dia) => (
                          <tr key={dia.data} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-gray-700">
                              {format(parseISO(dia.data), "dd/MM/yyyy (EEEE)", { locale: ptBR })}
                            </td>
                            <td className="px-4 py-2 text-gray-600">{dia.limite || '∞'}</td>
                            <td className="px-4 py-2 text-gray-600">{dia.emitidas}</td>
                            <td className="px-4 py-2 text-green-600">{dia.atendidos}</td>
                            <td className="px-4 py-2 text-red-600">{dia.ausentes}</td>
                            <td className="px-4 py-2 text-blue-600">{dia.aguardando}</td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs ${
                                dia.taxa_comparecimento >= 80 ? 'bg-green-100 text-green-700' :
                                dia.taxa_comparecimento >= 50 ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {dia.taxa_comparecimento}%
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tab Remarcações */}
          {activeTab === 'remarcacoes' && (
            <div>
              <div className="bg-white rounded-lg shadow overflow-hidden mb-4">
                <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    {remarcacoes.length} remarcações registradas
                  </span>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => exportarRemarcacoesPDF(remarcacoes)}
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 flex items-center space-x-1 text-sm"
                    >
                      <FileText size={14} />
                      <span>PDF</span>
                    </button>
                    <button
                      onClick={() => exportarRemarcacoesXLSX(remarcacoes)}
                      className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 flex items-center space-x-1 text-sm"
                    >
                      <Download size={14} />
                      <span>XLSX</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Nome</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Nascimento</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">PCD</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Categoria</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Dia Original</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Dia Remarcado</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Remarcações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {remarcacoes.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                            Nenhuma remarcação registrada
                          </td>
                        </tr>
                      ) : (
                        remarcacoes.map((r) => (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-gray-700">{r.nome}</td>
                            <td className="px-4 py-2 text-sm text-gray-600">
                              {format(parseISO(r.data_nascimento), 'dd/MM/yyyy')}
                            </td>
                            <td className="px-4 py-2">
                              {r.pcd ? (
                                <span className="text-purple-600 flex items-center">
                                  <Accessibility size={14} className="mr-1" /> Sim
                                </span>
                              ) : (
                                <span className="text-gray-400">Não</span>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs ${
                                r.fila === 'prioritaria'
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {r.fila === 'prioritaria' ? 'Prioritário' : 'Normal'}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600">
                              {format(parseISO(r.dia_original), 'dd/MM/yyyy')}
                            </td>
                            <td className="px-4 py-2 text-sm text-blue-600">
                              {format(parseISO(r.dia_remarcado), 'dd/MM/yyyy')}
                            </td>
                            <td className="px-4 py-2">
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">
                                {r.remarcao_count}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}