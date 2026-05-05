-- =============================================================================
-- Ajuste de retorno de ausentes e prioridade gestante/criança de colo
-- Data: 2026-05-05
--
-- Regras:
--   1. O resgate manual de ausente volta para a fila NORMAL, no fim da posição
--      efetiva atual da fila normal.
--   2. Gestante/criança de colo entra como prioridade geral, sem categoria
--      apartada nos relatórios.
--   3. A fila RETORNO permanece no schema por compatibilidade histórica, mas
--      deixa de ser usada pelo novo resgate.
-- =============================================================================

ALTER TABLE public.eleitores_fila
ADD COLUMN IF NOT EXISTS gestante_crianca_colo BOOLEAN NOT NULL DEFAULT false;

DROP FUNCTION IF EXISTS public.gerar_senha_atomica(DATE, TEXT, DATE, BOOLEAN, BOOLEAN, UUID, TEXT);
DROP FUNCTION IF EXISTS public.gerar_senha_atomica(DATE, TEXT, DATE, BOOLEAN, BOOLEAN, UUID, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION public.gerar_senha_atomica(
    p_dia_atendimento DATE,
    p_nome TEXT,
    p_data_nascimento DATE,
    p_pcd BOOLEAN,
    p_prioritario BOOLEAN,
    p_servidor_cadastro_id UUID,
    p_tipo TEXT DEFAULT 'presencial',
    p_gestante_crianca_colo BOOLEAN DEFAULT false
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

    SELECT COUNT(*)
    INTO v_total_senhas
    FROM eleitores_fila
    WHERE dia_atendimento = p_dia_atendimento
      AND status != 'cancelado';

    IF v_config.limite_senhas IS NOT NULL AND v_config.limite_senhas > 0 AND v_total_senhas >= v_config.limite_senhas THEN
        RAISE EXCEPTION 'Limite de senhas (%) atingido para o dia %.', v_config.limite_senhas, p_dia_atendimento;
    END IF;

    v_idade := DATE_PART('year', AGE(CURRENT_DATE, p_data_nascimento))::INTEGER;
    v_prioritario_calculado := (v_idade >= 60) OR p_pcd OR COALESCE(p_gestante_crianca_colo, false);
    v_fila := CASE WHEN v_prioritario_calculado THEN 'prioritaria' ELSE 'normal' END;

    SELECT COALESCE(MAX(senha), 0) + 1
    INTO v_proxima_senha
    FROM eleitores_fila
    WHERE dia_atendimento = p_dia_atendimento;

    INSERT INTO eleitores_fila (
        nome, data_nascimento, pcd, gestante_crianca_colo, prioritario,
        dia_atendimento, senha, tipo, fila,
        servidor_cadastro_id, status
    ) VALUES (
        p_nome, p_data_nascimento, p_pcd, COALESCE(p_gestante_crianca_colo, false), v_prioritario_calculado,
        p_dia_atendimento, v_proxima_senha,
        (CASE WHEN v_config.periodo = 2 THEN 'agendado' ELSE p_tipo END)::tipo_enum,
        v_fila::fila_enum, p_servidor_cadastro_id, 'aguardando'::status_enum
    )
    RETURNING id INTO v_eleitor_id;

    INSERT INTO log_acoes (servidor_id, acao, eleitor_id, detalhes)
    VALUES (
        p_servidor_cadastro_id,
        'cadastro_fila',
        v_eleitor_id,
        jsonb_build_object(
            'senha', v_proxima_senha,
            'fila', v_fila,
            'prioritario_calculado', v_prioritario_calculado,
            'gestante_crianca_colo', COALESCE(p_gestante_crianca_colo, false)
        )
    );

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

CREATE OR REPLACE FUNCTION public.registrar_retorno_atomico(
    p_eleitor_id      UUID,
    p_servidor_id     UUID,
    p_horario_retorno TIMESTAMPTZ
)
RETURNS SETOF public.eleitores_fila
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_atual RECORD;
    v_ordem_retorno INTEGER;
BEGIN
    SELECT * INTO v_atual
    FROM eleitores_fila
    WHERE id = p_eleitor_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Eleitor % não encontrado.', p_eleitor_id;
    END IF;

    PERFORM 1
    FROM configuracao_dias
    WHERE data = v_atual.dia_atendimento
    FOR UPDATE;

    SELECT COALESCE(MAX(COALESCE(ordem_manual, senha)), 0) + 1
    INTO v_ordem_retorno
    FROM eleitores_fila
    WHERE dia_atendimento = v_atual.dia_atendimento
      AND status = 'aguardando'
      AND fila = 'normal'
      AND id <> p_eleitor_id;

    UPDATE eleitores_fila
    SET status          = 'aguardando',
        fila            = 'normal',
        ordem_manual    = v_ordem_retorno,
        horario_retorno = p_horario_retorno,
        retorno_count   = COALESCE(retorno_count, 0) + 1
    WHERE id = p_eleitor_id;

    INSERT INTO log_acoes (servidor_id, acao, eleitor_id, detalhes)
    VALUES (
        p_servidor_id,
        'registro_retorno',
        p_eleitor_id,
        jsonb_build_object(
            'horario_retorno', p_horario_retorno,
            'fila_destino', 'normal',
            'ordem_manual', v_ordem_retorno
        )
    );

    RETURN QUERY
    SELECT * FROM eleitores_fila WHERE id = p_eleitor_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.chamar_proximo_atomico(
    p_dia_atendimento DATE,
    p_servidor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_proximo RECORD;
    v_fila_escolhida fila_enum;
    v_result JSONB;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM configuracao_dias WHERE data = p_dia_atendimento
    ) THEN
        RAISE EXCEPTION 'Configuração do dia % não encontrada.', p_dia_atendimento;
    END IF;

    SELECT * INTO v_proximo
    FROM eleitores_fila
    WHERE dia_atendimento = p_dia_atendimento
      AND status = 'aguardando'
      AND fila = 'prioritaria'
    ORDER BY
      CASE
        WHEN DATE_PART('year', AGE(CURRENT_DATE, data_nascimento))::INTEGER >= 80 THEN 0
        ELSE 1
      END,
      COALESCE(ordem_manual, senha),
      senha ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF FOUND THEN
        v_fila_escolhida := 'prioritaria';

    ELSE
        SELECT * INTO v_proximo
        FROM eleitores_fila
        WHERE dia_atendimento = p_dia_atendimento
          AND status = 'aguardando'
          AND fila = 'normal'
        ORDER BY COALESCE(ordem_manual, senha), senha ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED;

        IF FOUND THEN
            v_fila_escolhida := 'normal';

        ELSE
            SELECT * INTO v_proximo
            FROM eleitores_fila
            WHERE dia_atendimento = p_dia_atendimento
              AND status = 'aguardando'
              AND fila = 'retorno'
            ORDER BY COALESCE(ordem_manual, senha), senha ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED;

            IF FOUND THEN
                v_fila_escolhida := 'retorno';
            ELSE
                RAISE EXCEPTION 'Não há ninguém aguardando na fila.';
            END IF;
        END IF;
    END IF;

    UPDATE eleitores_fila
    SET status = 'chamado',
        horario_chamada = NOW(),
        servidor_atendimento_id = p_servidor_id
    WHERE id = v_proximo.id;

    INSERT INTO log_acoes (servidor_id, acao, eleitor_id, detalhes)
    VALUES (
        p_servidor_id,
        'chamada_senha',
        v_proximo.id,
        jsonb_build_object(
            'senha', v_proximo.senha,
            'fila', v_fila_escolhida,
            'ordem_manual', v_proximo.ordem_manual,
            'prioridade_80_mais',
            DATE_PART('year', AGE(CURRENT_DATE, v_proximo.data_nascimento))::INTEGER >= 80
        )
    );

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
