-- =============================================================================
-- REFATORAÇÃO: Regra da fila de retorno
-- Data: 2026-04-17
--
-- Regra nova (solicitada):
--   A fila de RETORNO só é acionada quando as filas PRIORITÁRIA e NORMAL
--   estiverem completamente vazias.
--
-- Fluxo anterior (ciclo 2P:1N:1R) → REMOVIDO
-- Fluxo novo (cascata de prioridade):
--   1. Chamar da fila PRIORITÁRIA (se houver)
--   2. Se prioritária vazia → chamar da fila NORMAL
--   3. Se prioritária E normal vazias → chamar da fila RETORNO
--   4. Se todas vazias → erro "Não há ninguém aguardando"
--
-- Obs: ciclo_atual em configuracao_dias não é mais utilizado para a
--      lógica de chamada. Mantém o campo no banco para histórico/relatório.
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

    -- =========================================================================
    -- CASCATA DE PRIORIDADE
    -- Passo 1: Tentar PRIORITÁRIA
    -- =========================================================================
    SELECT * INTO v_proximo
    FROM eleitores_fila
    WHERE dia_atendimento = p_dia_atendimento
      AND status = 'aguardando'
      AND fila = 'prioritaria'
    ORDER BY COALESCE(ordem_manual, 999999), senha ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF FOUND THEN
        v_fila_escolhida := 'prioritaria';

    ELSE
        -- =====================================================================
        -- Passo 2: PRIORITÁRIA vazia → tentar NORMAL
        -- =====================================================================
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
            -- =================================================================
            -- Passo 3: PRIORITÁRIA e NORMAL vazias → tentar RETORNO
            -- =================================================================
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

    -- 2. Marcar eleitor como chamado
    UPDATE eleitores_fila
    SET status = 'chamado',
        horario_chamada = NOW(),
        servidor_atendimento_id = p_servidor_id
    WHERE id = v_proximo.id;

    -- 3. Registrar log
    INSERT INTO log_acoes (servidor_id, acao, eleitor_id, detalhes)
    VALUES (
        p_servidor_id,
        'chamada_senha',
        v_proximo.id,
        jsonb_build_object(
            'senha', v_proximo.senha,
            'fila', v_fila_escolhida,
            'ordem_manual', v_proximo.ordem_manual
        )
    );

    -- 4. Retornar eleitor completo
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
