-- Migration: Correção de race conditions adicionais
-- Referência: RELATORIO_TECNICO_AUDITORIA v2 (2026-04-16)
--   BUG 2 — Race em remarcarAgendamento (senhas duplicadas)
--   BUG 3 — Race em registrarRetorno (retorno_count)

-- =============================================================================
-- 1. RPC ATÔMICA PARA REMARCAR AGENDAMENTO
-- Resolve: Senhas duplicadas em remarcação concorrente.
-- Usa FOR UPDATE em configuracao_dias (alinhado com gerar_senha_atomica).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.remarcar_atomico(
    p_eleitor_id UUID,
    p_novo_dia   DATE,
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
    -- 1. Carregar agendamento atual
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
    IF v_config.limite_senhas > 0 THEN
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
    UPDATE eleitores_fila
    SET dia_atendimento   = p_novo_dia,
        senha             = v_nova_senha,
        remarcado_de      = v_atual.dia_atendimento,
        remarcacao_count  = COALESCE(v_atual.remarcacao_count, 0) + 1,
        status            = 'aguardando'
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


-- =============================================================================
-- 2. RPC ATÔMICA PARA REGISTRAR RETORNO DE AUSENTE
-- Resolve: Race em retorno_count (SELECT + UPDATE -> duas chamadas concorrentes
-- podem perder o incremento).
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
    -- Incremento atômico via expressão SQL — não há SELECT prévio
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
