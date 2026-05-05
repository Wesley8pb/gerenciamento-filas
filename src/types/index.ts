export type Perfil = 'admin' | 'atendente';

export type Status = 'aguardando' | 'chamado' | 'atendido' | 'ausente' | 'cancelado';

export type Fila = 'prioritaria' | 'normal' | 'retorno';

export type Tipo = 'presencial' | 'agendado';

export interface Profile {
  id: string;
  nome: string;
  email: string;
  perfil: Perfil;
  ativo: boolean;
  primeiro_acesso: boolean;
  created_at: string;
}

export interface ConfiguracaoDia {
  id: number;
  data: string;
  limite_senhas: number;
  bloqueado: boolean;
  periodo: 1 | 2;
  dia_especial: boolean;
  observacao: string | null;
  ciclo_atual: number;
  created_at: string;
}

export interface EleitorFila {
  id: string;
  nome: string;
  data_nascimento: string;
  pcd: boolean;
  gestante_crianca_colo: boolean;
  prioritario: boolean;
  dia_atendimento: string;
  senha: number;
  tipo: Tipo;
  fila: Fila;
  ordem_manual: number | null;
  status: Status;
  horario_cadastro: string;
  horario_retorno: string | null;
  horario_chamada: string | null;
  horario_finalizacao: string | null;
  remarcado_de: string | null;
  remarcacao_count: number;
  retorno_count: number;
  servidor_cadastro_id: string;
  servidor_atendimento_id: string | null;
}

export interface LogAcao {
  id: number;
  servidor_id: string;
  acao: string;
  eleitor_id: string | null;
  timestamp: string;
  detalhes: Record<string, unknown> | null;
}

export interface ConfiguracaoSistema {
  id: number;
  chave: string;
  valor: string;
  created_at: string;
  updated_at: string;
}
