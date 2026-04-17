-- Migration: Correção de cast de tipo_enum na função gerar_senha_atomica
-- Data: 2026-04-17
-- CAUSA DO BUG: A expressão CASE WHEN retornava TEXT puro, mas a coluna `tipo` na
--               tabela `eleitores_fila` é do tipo `tipo_enum`. O PostgreSQL não faz
--               cast implícito de text para enum personalizado, gerando erro 42804.
-- SINTOMA: Edge Function `gerar-senha` retornava HTTP 400 (Bad Request) em todo cadastro.
--
-- Correções adicionais incluídas:
--   1. Cast explícito no CASE WHEN: (...)::tipo_enum
--   2. Cast explícito em fila: v_fila::fila_enum
--   3. Cast explícito em status: 'aguardando'::status_enum
--   4. Verificação de limite_senhas: só aplica se > 0 (evita bloquear dias com limite = 0)

CREATE OR REPLACE FUNCTION public.gerar_senha_atomica(
    p_dia_atendimento DATE,
    p_nome TEXT,
    p_data_nascimento DATE,
    p_pcd BOOLEAN,
    p_prioritario BOOLEAN,
    p_servidor_cadastro_id UUID,
    p_tipo TEXT DEFAULT 'presencial'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_config RECORD;
    v_total_senhas INTEGER;
    v_proxima_senha INTEGER;
    v_fila TEXT;
    v_idade INTEGER;
    v_prioritario_calculado BOOLEAN;
    v_eleitor_id UUID;
    v_result JSONB;
BEGIN
    -- 1. Travar a linha de configuração do dia (FOR UPDATE impede leitura concorrente)
    SELECT limite_senhas, bloqueado, periodo
    INTO v_config
    FROM configuracao_dias
    WHERE data = p_dia_atendimento
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Dia % não configurado.', p_dia_atendimento;
    END IF;

    IF v_config.bloqueado THEN
        RAISE EXCEPTION 'O dia % está bloqueado para novos atendimentos.', p_dia_atendimento;
    END IF;

    -- 2. Contar senhas ativas para o dia (dentro da mesma transação travada)
    SELECT COUNT(*)
    INTO v_total_senhas
    FROM eleitores_fila
    WHERE dia_atendimento = p_dia_atendimento
      AND status != 'cancelado';

    -- Verificar limite apenas quando configurado (> 0)
    IF v_config.limite_senhas IS NOT NULL AND v_config.limite_senhas > 0 AND v_total_senhas >= v_config.limite_senhas THEN
        RAISE EXCEPTION 'Limite de senhas (%) atingido para o dia %.', v_config.limite_senhas, p_dia_atendimento;
    END IF;

    -- 3. Calcular prioridade no SERVIDOR (ignora campo enviado pelo cliente)
    v_idade := DATE_PART('year', AGE(CURRENT_DATE, p_data_nascimento))::INTEGER;
    v_prioritario_calculado := (v_idade >= 60) OR p_pcd;

    -- 4. Determinar a fila
    v_fila := CASE WHEN v_prioritario_calculado THEN 'prioritaria' ELSE 'normal' END;

    -- 5. Gerar próxima senha de forma atômica
    SELECT COALESCE(MAX(senha), 0) + 1
    INTO v_proxima_senha
    FROM eleitores_fila
    WHERE dia_atendimento = p_dia_atendimento;

    -- 6. Inserir eleitor
    --    CORREÇÃO: Cast explícito para enums personalizados (tipo_enum, fila_enum, status_enum)
    --    O PostgreSQL não converte TEXT para enum implicitamente — requer ::tipo_enum
    INSERT INTO eleitores_fila (
        nome, data_nascimento, pcd, prioritario,
        dia_atendimento, senha, tipo, fila,
        servidor_cadastro_id, status
    ) VALUES (
        p_nome, p_data_nascimento, p_pcd, v_prioritario_calculado,
        p_dia_atendimento, v_proxima_senha,
        (CASE WHEN v_config.periodo = 2 THEN 'agendado' ELSE p_tipo END)::tipo_enum,
        v_fila::fila_enum, p_servidor_cadastro_id, 'aguardando'::status_enum
    )
    RETURNING id INTO v_eleitor_id;

    -- 7. Registrar log
    INSERT INTO log_acoes (servidor_id, acao, eleitor_id, detalhes)
    VALUES (
        p_servidor_cadastro_id,
        'cadastro_fila',
        v_eleitor_id,
        jsonb_build_object('senha', v_proxima_senha, 'fila', v_fila, 'prioritario_calculado', v_prioritario_calculado)
    );

    -- 8. Montar resultado
    SELECT jsonb_build_object(
        'success', true,
        'eleitor_id', v_eleitor_id,
        'senha', v_proxima_senha,
        'fila', v_fila,
        'prioritario', v_prioritario_calculado,
        'posicao', v_total_senhas + 1
    ) INTO v_result;

    RETURN v_result;
END;
$$;
