-- Seed inicial para configuração de dias ativos (Período 1 e 2)
-- Baseado no PRD da 56ª Zona Eleitoral

-- Período 1 — Atendimento Presencial Normal (13/04 - 06/05)
-- Período 2 — Atendimento Agendado (07/05 - 20/05)

DO $$
DECLARE
    current_d DATE := '2026-04-13';
    end_d DATE := '2026-05-20';
    periodo_val INTEGER;
    is_blocked BOOLEAN;
    is_special BOOLEAN;
BEGIN
    WHILE current_d <= end_d LOOP
        -- Configuração base
        periodo_val := CASE WHEN current_d < '2026-05-07' THEN 1 ELSE 2 END;
        is_blocked := EXTRACT(DOW FROM current_d) IN (0, 6); -- Sábado (6) e Domingo (0) bloqueados por padrão
        is_special := FALSE;

        -- Tiradentes (21/04)
        IF current_d = '2026-04-21' THEN
            is_blocked := TRUE;
        END IF;

        -- Dia do Trabalho (01/05)
        IF current_d = '2026-05-01' THEN
            is_blocked := TRUE;
        END IF;

        -- Sábado Especial (02/05)
        IF current_d = '2026-05-02' THEN
            is_blocked := FALSE;
            is_special := TRUE;
        END IF;

        -- Inserir dia
        INSERT INTO public.configuracao_dias (data, limite_senhas, bloqueado, periodo, dia_especial)
        VALUES (current_d, 500, is_blocked, periodo_val, is_special)
        ON CONFLICT (data) DO UPDATE 
        SET bloqueado = EXCLUDED.bloqueado, 
            periodo = EXCLUDED.periodo, 
            dia_especial = EXCLUDED.dia_especial;

        current_d := current_d + 1;
    END LOOP;
END;
$$;
