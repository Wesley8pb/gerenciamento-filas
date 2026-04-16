-- Migration: Correção de race conditions na geração de senhas e no ciclo de atendimento
-- Referência: RELATORIO_TECNICO_AUDITORIA.md — Problemas Críticos #1 e #5

-- =============================================================================
-- 1. FUNÇÃO RPC ATÔMICA PARA GERAR SENHA
-- Resolve: Race condition onde duas requisições simultâneas podem obter a mesma senha
-- Solução: Usa SELECT MAX(senha) ... FOR UPDATE dentro de transação
-- =============================================================================

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

    IF v_total_senhas >= v_config.limite_senhas THEN
        RAISE EXCEPTION 'Limite de senhas (%) atingido para o dia %.', v_config.limite_senhas, p_dia_atendimento;
    END IF;

    -- 3. Calcular prioridade no SERVIDOR (ignora campo enviado pelo cliente)
    --    Resolve: Problema Crítico #4 — bypass da regra de prioridade
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
    INSERT INTO eleitores_fila (
        nome, data_nascimento, pcd, prioritario,
        dia_atendimento, senha, tipo, fila,
        servidor_cadastro_id, status
    ) VALUES (
        p_nome, p_data_nascimento, p_pcd, v_prioritario_calculado,
        p_dia_atendimento, v_proxima_senha,
        CASE WHEN v_config.periodo = 2 THEN 'agendado' ELSE p_tipo END,
        v_fila, p_servidor_cadastro_id, 'aguardando'
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


-- =============================================================================
-- 2. FUNÇÃO RPC ATÔMICA PARA CHAMAR PRÓXIMO (CICLO)
-- Resolve: Race condition no ciclo de atendimento (#5)
-- Solução: Usa FOR UPDATE para travar a configuração do dia durante o processamento
-- =============================================================================

CREATE OR REPLACE FUNCTION public.chamar_proximo_atomico(
    p_dia_atendimento DATE,
    p_servidor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ciclo INTEGER;
    v_proximo RECORD;
    v_fila_busca TEXT;
    v_tentativas INTEGER := 0;
    v_encontrou BOOLEAN := false;
    v_result JSONB;
BEGIN
    -- 1. Travar a configuração do dia (FOR UPDATE)
    SELECT ciclo_atual
    INTO v_ciclo
    FROM configuracao_dias
    WHERE data = p_dia_atendimento
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Configuração do dia % não encontrada.', p_dia_atendimento;
    END IF;

    v_ciclo := COALESCE(v_ciclo, 0);

    -- 2. Lógica do Ciclo 2P : 1N : 1R (0: P1, 1: P2, 2: N1, 3: R1)
    WHILE v_tentativas < 4 AND NOT v_encontrou LOOP
        -- Determinar a fila baseado no ciclo
        CASE
            WHEN v_ciclo IN (0, 1) THEN v_fila_busca := 'prioritaria';
            WHEN v_ciclo = 2 THEN v_fila_busca := 'normal';
            WHEN v_ciclo = 3 THEN v_fila_busca := 'retorno';
            ELSE v_fila_busca := 'prioritaria';
        END CASE;

        -- Buscar próximo da fila
        SELECT * INTO v_proximo
        FROM eleitores_fila
        WHERE dia_atendimento = p_dia_atendimento
          AND status = 'aguardando'
          AND fila = v_fila_busca
        ORDER BY senha ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED;

        IF FOUND THEN
            v_encontrou := true;
            -- Avançar ciclo
            CASE
                WHEN v_ciclo = 0 THEN v_ciclo := 1;
                WHEN v_ciclo = 1 THEN v_ciclo := 2;
                WHEN v_ciclo = 2 THEN v_ciclo := 3;
                WHEN v_ciclo = 3 THEN v_ciclo := 0;
            END CASE;
        ELSE
            -- Pular para próximo ciclo se a fila está vazia
            CASE
                WHEN v_ciclo IN (0, 1) THEN v_ciclo := 2;
                WHEN v_ciclo = 2 THEN v_ciclo := 3;
                WHEN v_ciclo = 3 THEN v_ciclo := 0;
            END CASE;
        END IF;

        v_tentativas := v_tentativas + 1;
    END LOOP;

    IF NOT v_encontrou THEN
        RAISE EXCEPTION 'Não há ninguém aguardando na fila.';
    END IF;

    -- 3. Atualizar eleitor como chamado
    UPDATE eleitores_fila
    SET status = 'chamado',
        horario_chamada = NOW(),
        servidor_atendimento_id = p_servidor_id
    WHERE id = v_proximo.id;

    -- 4. Atualizar ciclo do dia
    UPDATE configuracao_dias
    SET ciclo_atual = v_ciclo
    WHERE data = p_dia_atendimento;

    -- 5. Registrar log
    INSERT INTO log_acoes (servidor_id, acao, eleitor_id, detalhes)
    VALUES (
        p_servidor_id,
        'chamada_senha',
        v_proximo.id,
        jsonb_build_object('senha', v_proximo.senha, 'fila', v_proximo.fila, 'novo_ciclo', v_ciclo)
    );

    -- 6. Retornar eleitor completo
    SELECT jsonb_build_object(
        'success', true,
        'eleitor', row_to_json(e.*)::jsonb
    )
    INTO v_result
    FROM eleitores_fila e
    WHERE e.id = v_proximo.id;

    RETURN v_result;
END;
$$;
