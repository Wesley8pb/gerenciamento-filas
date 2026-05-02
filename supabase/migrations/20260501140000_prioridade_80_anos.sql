-- =============================================================================
-- PRIORIDADE ESPECIAL: pessoas com 80 anos ou mais
-- Data: 2026-05-01
--
-- Regra:
--   Dentro da fila PRIORITÁRIA, pessoas com 80 anos ou mais devem ser chamadas
--   antes das demais prioridades. A regra não cria nova fila nem altera schema.
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
    v_proximo RECORD;
    v_fila_escolhida fila_enum;
    v_result JSONB;
BEGIN
    -- 1. Garantir que o dia está configurado
    IF NOT EXISTS (
        SELECT 1 FROM configuracao_dias WHERE data = p_dia_atendimento
    ) THEN
        RAISE EXCEPTION 'Configuração do dia % não encontrada.', p_dia_atendimento;
    END IF;

    -- 2. Tentar PRIORITÁRIA, com 80+ antes das demais prioridades
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
      COALESCE(ordem_manual, 999999),
      senha ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF FOUND THEN
        v_fila_escolhida := 'prioritaria';

    ELSE
        -- 3. PRIORITÁRIA vazia -> tentar NORMAL
        SELECT * INTO v_proximo
        FROM eleitores_fila
        WHERE dia_atendimento = p_dia_atendimento
          AND status = 'aguardando'
          AND fila = 'normal'
        ORDER BY COALESCE(ordem_manual, 999999), senha ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED;

        IF FOUND THEN
            v_fila_escolhida := 'normal';

        ELSE
            -- 4. PRIORITÁRIA e NORMAL vazias -> tentar RETORNO
            SELECT * INTO v_proximo
            FROM eleitores_fila
            WHERE dia_atendimento = p_dia_atendimento
              AND status = 'aguardando'
              AND fila = 'retorno'
            ORDER BY COALESCE(ordem_manual, 999999), senha ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED;

            IF FOUND THEN
                v_fila_escolhida := 'retorno';
            ELSE
                RAISE EXCEPTION 'Não há ninguém aguardando na fila.';
            END IF;
        END IF;
    END IF;

    -- 5. Marcar eleitor como chamado
    UPDATE eleitores_fila
    SET status = 'chamado',
        horario_chamada = NOW(),
        servidor_atendimento_id = p_servidor_id
    WHERE id = v_proximo.id;

    -- 6. Registrar log
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

    -- 7. Retornar eleitor completo
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
