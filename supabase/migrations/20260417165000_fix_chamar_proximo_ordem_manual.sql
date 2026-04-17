-- =============================================================================
-- CORREÇÃO: chamar_proximo_atomico deve respeitar ordem_manual
-- Data: 2026-04-17
--
-- Problema: A RPC e a query do frontend ordenavam apenas por `senha ASC`,
--           ignorando completamente o campo `ordem_manual` definido pelo admin.
--
-- Correções aplicadas:
--   1. RPC chamar_proximo_atomico: ORDER BY COALESCE(ordem_manual, 999999), senha ASC
--      → eleitor com ordem_manual definida é chamado primeiro
--      → empate ou sem ordem_manual: usa senha (ordem de chegada)
--   2. fetchFilaDia (frontend): .order('ordem_manual', nullsFirst: false) + .order('senha')
--      → display do admin também reflete a ordem manual
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
    v_fila_busca fila_enum;
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

        CASE
            WHEN v_ciclo IN (0, 1) THEN v_fila_busca := 'prioritaria';
            WHEN v_ciclo = 2      THEN v_fila_busca := 'normal';
            WHEN v_ciclo = 3      THEN v_fila_busca := 'retorno';
            ELSE                       v_fila_busca := 'prioritaria';
        END CASE;

        -- Buscar próximo respeitando ordem_manual (quando definida)
        -- COALESCE garante que quem tem ordem_manual vem antes; resto ordena por senha
        SELECT * INTO v_proximo
        FROM eleitores_fila
        WHERE dia_atendimento = p_dia_atendimento
          AND status = 'aguardando'
          AND fila = v_fila_busca
        ORDER BY COALESCE(ordem_manual, 999999), senha ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED;

        IF FOUND THEN
            v_encontrou := true;
            CASE
                WHEN v_ciclo = 0 THEN v_ciclo := 1;
                WHEN v_ciclo = 1 THEN v_ciclo := 2;
                WHEN v_ciclo = 2 THEN v_ciclo := 3;
                WHEN v_ciclo = 3 THEN v_ciclo := 0;
            END CASE;
        ELSE
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
        jsonb_build_object(
            'senha', v_proximo.senha,
            'fila', v_proximo.fila,
            'ordem_manual', v_proximo.ordem_manual,
            'novo_ciclo', v_ciclo
        )
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
