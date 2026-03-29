import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar, Filter, X } from 'lucide-react';
import type { FiltrosRelatorio } from '../services/relatorio';

interface FiltrosRelatorioProps {
  onFiltrosChange: (filtros: FiltrosRelatorio) => void;
}

export function FiltrosRelatorio({ onFiltrosChange }: FiltrosRelatorioProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Estados dos filtros
  const [tipoData, setTipoData] = useState<'unica' | 'intervalo' | 'periodo1' | 'periodo2'>(
    () => (searchParams.get('tipo_data') as 'unica' | 'intervalo' | 'periodo1' | 'periodo2') || 'unica'
  );
  const [dataInicio, setDataInicio] = useState(() => searchParams.get('data_inicio') || '');
  const [dataFim, setDataFim] = useState(() => searchParams.get('data_fim') || '');
  const [statusSelecionados, setStatusSelecionados] = useState<
    ('atendido' | 'ausente' | 'aguardando' | 'chamado' | 'cancelado')[]
  >(() => {
    const statusParam = searchParams.get('status');
    if (statusParam) {
      return statusParam.split(',').filter(s =>
        ['atendido', 'ausente', 'aguardando', 'chamado', 'cancelado'].includes(s)
      ) as ('atendido' | 'ausente' | 'aguardando' | 'chamado' | 'cancelado')[];
    }
    return ['atendido', 'ausente'];
  });
  const [categoria, setCategoria] = useState<'todos' | 'prioritaria' | 'normal' | 'pcd'>(
    () => (searchParams.get('categoria') as 'todos' | 'prioritaria' | 'normal' | 'pcd') || 'todos'
  );

  // Opções de status
  const statusOptions = [
    { value: 'atendido', label: 'Atendidos', color: 'bg-green-100 text-green-700' },
    { value: 'ausente', label: 'Ausentes', color: 'bg-red-100 text-red-700' },
    { value: 'aguardando', label: 'Aguardando', color: 'bg-blue-100 text-blue-700' },
    { value: 'chamado', label: 'Chamados', color: 'bg-yellow-100 text-yellow-700' },
    { value: 'cancelado', label: 'Cancelados', color: 'bg-gray-100 text-gray-700' },
  ];

  // Opções de categoria
  const categoriaOptions = [
    { value: 'todos', label: 'Todos' },
    { value: 'prioritaria', label: 'Prioritários' },
    { value: 'normal', label: 'Normais' },
    { value: 'pcd', label: 'PCD' },
  ];

  // Opções de tipo de data
  const tipoDataOptions = [
    { value: 'unica', label: 'Data Única' },
    { value: 'intervalo', label: 'Intervalo' },
    { value: 'periodo1', label: 'Período 1 (13/04 - 06/05)' },
    { value: 'periodo2', label: 'Período 2 (07/05 - 20/05)' },
  ];

  // Atualizar URL quando filtros mudam
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('tipo_data', tipoData);
    if (tipoData === 'unica' && dataInicio) {
      params.set('data_inicio', dataInicio);
    } else if (tipoData === 'intervalo') {
      if (dataInicio) params.set('data_inicio', dataInicio);
      if (dataFim) params.set('data_fim', dataFim);
    }
    if (statusSelecionados.length > 0) {
      params.set('status', statusSelecionados.join(','));
    }
    if (categoria !== 'todos') {
      params.set('categoria', categoria);
    }
    setSearchParams(params);
  }, [tipoData, dataInicio, dataFim, statusSelecionados, categoria, setSearchParams]);

  // Notificar pai quando filtros mudam
  useEffect(() => {
    let dataInicioFinal = dataInicio;
    let dataFimFinal = dataFim;

    if (tipoData === 'periodo1') {
      dataInicioFinal = '2026-04-13';
      dataFimFinal = '2026-05-06';
    } else if (tipoData === 'periodo2') {
      dataInicioFinal = '2026-05-07';
      dataFimFinal = '2026-05-20';
    } else if (tipoData === 'unica') {
      dataFimFinal = dataInicio;
    }

    onFiltrosChange({
      tipo_data: tipoData,
      data_inicio: dataInicioFinal,
      data_fim: dataFimFinal,
      status: statusSelecionados,
      categoria,
    });
  }, [tipoData, dataInicio, dataFim, statusSelecionados, categoria, onFiltrosChange]);

  // Toggle status
  const toggleStatus = (status: 'atendido' | 'ausente' | 'aguardando' | 'chamado' | 'cancelado') => {
    setStatusSelecionados(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  // Limpar filtros
  const limparFiltros = () => {
    setTipoData('unica');
    setDataInicio('');
    setDataFim('');
    setStatusSelecionados(['atendido', 'ausente']);
    setCategoria('todos');
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Filter size={20} className="text-gray-500" />
          <h3 className="font-semibold text-gray-700">Filtros</h3>
        </div>
        <button
          onClick={limparFiltros}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center space-x-1"
        >
          <X size={14} />
          <span>Limpar</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Tipo de Data */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Período</label>
          <select
            value={tipoData}
            onChange={(e) => setTipoData(e.target.value as 'unica' | 'intervalo' | 'periodo1' | 'periodo2')}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {tipoDataOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Data Início */}
        {(tipoData === 'unica' || tipoData === 'intervalo') && (
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1 flex items-center">
              <Calendar size={14} className="mr-1" />
              {tipoData === 'unica' ? 'Data' : 'Data Início'}
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Data Fim */}
        {tipoData === 'intervalo' && (
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1 flex items-center">
              <Calendar size={14} className="mr-1" />
              Data Fim
            </label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              min={dataInicio}
            />
          </div>
        )}

        {/* Categoria */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Categoria</label>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as 'todos' | 'prioritaria' | 'normal' | 'pcd')}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {categoriaOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Status (badges clicáveis) */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-600 mb-2">Status</label>
        <div className="flex flex-wrap gap-2">
          {statusOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => toggleStatus(opt.value as 'atendido' | 'ausente' | 'aguardando' | 'chamado' | 'cancelado')}
              className={`px-3 py-1 rounded-full text-sm transition-all ${
                statusSelecionados.includes(opt.value as 'atendido' | 'ausente' | 'aguardando' | 'chamado' | 'cancelado')
                  ? opt.color + ' ring-2 ring-offset-1'
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}