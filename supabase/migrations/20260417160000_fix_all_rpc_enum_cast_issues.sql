-- =============================================================================
-- CORREÇÃO COMPLETA: Cast de enums e RPCs ausentes
-- Data: 2026-04-17
--
-- Problemas corrigidos:
--   1. chamar_proximo_atomico — variável v_fila_busca TEXT comparada com fila_enum
--      Erro PostgreSQL: "operator does not exist: fila_enum = text"
--      Fix: v_fila_busca declarado como fila_enum
--
--   2. registrar_retorno_atomico — função nunca foi aplicada ao banco
--      (migration 20260416120000 não foi executada em produção)
--
--   3. remarcar_atomico — função nunca foi aplicada ao banco
--      (mesma migration acima)
--      NOTA: coluna real na tabela é remarcao_count (não remarcacao_count)
-- =============================================================================


-- =============================================================================
-- 1. CORRIGIR chamar_proximo_atomico
--    Bug: v_fila_busca TEXT não pode ser comparado com fila_enum via operador =
--    Fix: v_fila_busca declarado como fila_enum
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
    v_fila_busca fila_enum;   -- CORREÇÃO: era TEXT, não comparável com fila_enum
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
            WHEN v_ciclo = 2      THEN v_fila_busca := 'normal';
            WHEN v_ciclo = 3      THEN v_fila_busca := 'retorno';
            ELSE                       v_fila_busca := 'prioritaria';
        END CASE;

        -- Buscar próximo da fila (fila_enum = fila_enum — sem problema de tipo)
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
                WHEN v_ciclo = 2       THEN v_ciclo := 3;
                WHEN v_ciclo = 3       THEN v_ciclo := 0;
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


-- =============================================================================
-- 2. CRIAR registrar_retorno_atomico
--    Incremento atômico de retorno_count sem SELECT prévio (evita race condition).
--    Coloca eleitor na fila de retorno com status aguardando.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.registrar_retorno_atomico(
    p_eleitor_id      UUID,
    p_servidor_id     UUID,
    p_horario_retorno TIMESTAMPTZ
)
RETURNS SETOF public.eleitores_fila
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Atualização atômica: sem SELECT prévio para evitar race condition em retorno_count
    UPDATE eleitores_fila
    SET status          = 'aguardando',
        fila            = 'retorno',
        horario_retorno = p_horario_retorno,
        retorno_count   = COALESCE(retorno_count, 0) + 1
    WHERE id = p_eleitor_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Eleitor % não encontrado.', p_eleitor_id;
    END IF;

    -- Log
    INSERT INTO log_acoes (servidor_id, acao, eleitor_id, detalhes)
    VALUES (
        p_servidor_id,
        'registro_retorno',
        p_eleitor_id,
        jsonb_build_object('horario_retorno', p_horario_retorno)
    );

    RETURN QUERY
    SELECT * FROM eleitores_fila WHERE id = p_eleitor_id;
END;
$$;


-- =============================================================================
-- 3. CRIAR remarcar_atomico
--    Remarca eleitor para outro dia de forma atômica.
--    NOTA: coluna real é remarcao_count (não remarcacao_count)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.remarcar_atomico(
    p_eleitor_id  UUID,
    p_novo_dia    DATE,
    p_servidor_id UUID
)
RETURNS SETOF public.eleitores_fila
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_config RECORD;
    v_total_ativas INTEGER;
    v_atual RECORD;
    v_nova_senha INTEGER;
BEGIN
    -- 1. Carregar e travar agendamento atual
    SELECT * INTO v_atual
    FROM eleitores_fila
    WHERE id = p_eleitor_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Eleitor % não encontrado.', p_eleitor_id;
    END IF;

    -- 2. Travar a configuração do novo dia
    SELECT limite_senhas, bloqueado
    INTO v_config
    FROM configuracao_dias
    WHERE data = p_novo_dia
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Dia % não configurado.', p_novo_dia;
    END IF;

    IF v_config.bloqueado THEN
        RAISE EXCEPTION 'O dia % está bloqueado para novos atendimentos.', p_novo_dia;
    END IF;

    -- 3. Verificar limite do novo dia (dentro do lock)
    IF v_config.limite_senhas IS NOT NULL AND v_config.limite_senhas > 0 THEN
        SELECT COUNT(*) INTO v_total_ativas
        FROM eleitores_fila
        WHERE dia_atendimento = p_novo_dia
          AND status != 'cancelado';

        IF v_total_ativas >= v_config.limite_senhas THEN
            RAISE EXCEPTION 'Limite de vagas atingido para este dia';
        END IF;
    END IF;

    -- 4. Gerar nova senha de forma atômica
    SELECT COALESCE(MAX(senha), 0) + 1
    INTO v_nova_senha
    FROM eleitores_fila
    WHERE dia_atendimento = p_novo_dia;

    -- 5. Atualizar eleitor
    -- NOTA: coluna real é remarcao_count (não remarcacao_count)
    UPDATE eleitores_fila
    SET dia_atendimento  = p_novo_dia,
        senha            = v_nova_senha,
        remarcado_de     = v_atual.dia_atendimento,
        remarcao_count   = COALESCE(v_atual.remarcao_count, 0) + 1,
        status           = 'aguardando'
    WHERE id = p_eleitor_id;

    -- 6. Registrar log
    INSERT INTO log_acoes (servidor_id, acao, eleitor_id, detalhes)
    VALUES (
        p_servidor_id,
        'remarcacao_agendamento',
        p_eleitor_id,
        jsonb_build_object(
            'dia_anterior', v_atual.dia_atendimento,
            'novo_dia',    p_novo_dia,
            'nova_senha',  v_nova_senha
        )
    );

    -- 7. Retornar eleitor atualizado
    RETURN QUERY
    SELECT * FROM eleitores_fila WHERE id = p_eleitor_id;
END;
$$;
