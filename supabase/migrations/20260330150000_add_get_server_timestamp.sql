-- Função RPC para obter timestamp do servidor
-- Usada para evitar manipulação de data/hora no cliente
CREATE OR REPLACE FUNCTION public.get_server_timestamp()
RETURNS TIMESTAMPTZ
LANGUAGE SQL
SECURITY DEFINER
AS $$
    SELECT now();
$$;

-- Comentário da função
COMMENT ON FUNCTION public.get_server_timestamp() IS 'Retorna o timestamp atual do servidor PostgreSQL. Usado pelo frontend para obter a data/hora oficial sem depender do relógio do cliente.';
