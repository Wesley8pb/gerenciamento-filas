import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { isDiaAtivo, getPeriodo } from '../utils/calendario';
import { fetchConfiguracaoDia } from '../services/configuracao';

interface DiaAtivoState {
  isAtivo: boolean;
  periodo: 1 | 2 | null;
  motivo: string;
  loading: boolean;
  dataAtual: string;
}

/**
 * Hook que verifica se o dia atual é um dia ativo de atendimento
 * Usa timestamp do servidor Supabase para evitar manipulação do cliente
 * Busca configuração do banco de dados para suportar datas dinâmicas
 */
export function useDiaAtivo(): DiaAtivoState {
  const [state, setState] = useState<DiaAtivoState>({
    isAtivo: false,
    periodo: null,
    motivo: '',
    loading: true,
    dataAtual: '',
  });

  useEffect(() => {
    const verificarDia = async () => {
      try {
        // Obter data/hora do servidor
        const { data, error } = await supabase.rpc('get_server_timestamp');

        if (error) {
          console.error('Erro ao obter timestamp do servidor:', error);
          setState({
            isAtivo: false,
            periodo: null,
            motivo: 'Erro ao verificar data do servidor',
            loading: false,
            dataAtual: '',
          });
          return;
        }

        const serverDate = new Date(data as string);
        const dataStr = serverDate.toISOString().split('T')[0];

        // Buscar configuração do dia no banco de dados
        const configDia = await fetchConfiguracaoDia(dataStr);

        // Se existe configuração no banco, usar ela
        if (configDia) {
          const periodo = configDia.periodo;
          const ativo = !configDia.bloqueado;

          let motivo = '';
          if (!ativo) {
            motivo = configDia.observacao || 'Dia bloqueado. Não há atendimento.';
          }

          setState({
            isAtivo: ativo && periodo === 1,
            periodo,
            motivo,
            loading: false,
            dataAtual: dataStr,
          });
          return;
        }

        // Fallback: verificar período e datas hardcoded (para compatibilidade)
        const periodo = getPeriodo(serverDate);
        const ativo = isDiaAtivo(serverDate);

        let motivo = '';
        if (!ativo) {
          if (serverDate.getDay() === 0 || (serverDate.getDay() === 6 && dataStr !== '2026-05-02')) {
            motivo = 'Hoje é fim de semana. Não há atendimento.';
          } else if (dataStr === '2026-04-21') {
            motivo = 'Feriado de Tiradentes. Não há atendimento.';
          } else if (dataStr === '2026-05-01') {
            motivo = 'Feriado do Dia do Trabalho. Não há atendimento.';
          } else if (periodo === 2) {
            motivo = 'O Período 2 é exclusivo para agendamentos. O cadastro presencial não está disponível.';
          } else {
            motivo = 'Hoje não é um dia de atendimento. O cadastro presencial está disponível apenas nos dias úteis do Período 1 (13/04 a 06/05).';
          }
        }

        setState({
          isAtivo: ativo && periodo === 1,
          periodo,
          motivo,
          loading: false,
          dataAtual: dataStr,
        });
      } catch (err) {
        console.error('Erro ao verificar dia ativo:', err);
        setState({
          isAtivo: false,
          periodo: null,
          motivo: 'Erro ao verificar disponibilidade',
          loading: false,
          dataAtual: '',
        });
      }
    };

    verificarDia();
  }, []);

  return state;
}