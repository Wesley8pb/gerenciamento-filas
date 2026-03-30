-- Script rápido para limpar TODOS os dados de teste
-- ATENÇÃO: Isso vai deletar todos os eleitores e seus logs!

-- Desabilitar temporariamente a verificação de FK (apenas para esta sessão)
-- Isso permite deletar sem se preocupar com a ordem
SET session_replication_role = 'replica';

-- Deletar todos os eleitores (exceto se quiser manter algum)
-- Ajuste o WHERE conforme necessário
DELETE FROM eleitores_fila
WHERE dia_atendimento = '2026-03-30';  -- ou remova o WHERE para deletar tudo

-- Voltar ao modo normal
SET session_replication_role = 'origin';

-- Verificar
SELECT COUNT(*) as total_eleitores FROM eleitores_fila;
