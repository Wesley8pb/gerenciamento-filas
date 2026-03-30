-- Script para permitir deleção de eleitores de teste
-- Opção 1: Deletar logs primeiro e depois os eleitores (mais seguro)

-- Passo 1: Identificar os eleitores de teste (ajuste o filtro conforme necessário)
-- Exemplo: eleitores com nome 'teste', 'Teste' ou dados de hoje para teste

-- Primeiro, veja quais eleitores serão afetados:
-- SELECT * FROM eleitores_fila WHERE nome ILIKE '%teste%' OR nome ILIKE '%fulano%';

-- Passo 2: Deletar os logs relacionados a esses eleitores
DELETE FROM log_acoes
WHERE eleitor_id IN (
    SELECT id FROM eleitores_fila
    WHERE nome ILIKE '%teste%'
       OR nome ILIKE '%fulano%'
       OR nome ILIKE '%ciclano%'
       OR nome ILIKE '%beltrano%'
       OR nome ILIKE '%nami%'
       OR nome ILIKE '%roronoa%'
);

-- Passo 3: Agora deletar os eleitores
DELETE FROM eleitores_fila
WHERE nome ILIKE '%teste%'
   OR nome ILIKE '%fulano%'
   OR nome ILIKE '%ciclano%'
   OR nome ILIKE '%beltrano%'
   OR nome ILIKE '%nami%'
   OR nome ILIKE '%roronoa%';

-- Verificar se deletou
SELECT * FROM eleitores_fila ORDER BY horario_cadastro DESC LIMIT 10;
