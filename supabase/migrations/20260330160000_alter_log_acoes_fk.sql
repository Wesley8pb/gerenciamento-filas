-- Migration: Alterar FK de log_acoes para ON DELETE CASCADE
-- Isso permite deletar eleitores sem precisar deletar os logs manualmente

-- Remover a constraint existente
ALTER TABLE public.log_acoes
DROP CONSTRAINT IF EXISTS log_acoes_eleitor_id_fkey;

-- Recriar com ON DELETE SET NULL (mantém o log mesmo sem o eleitor)
-- Ou use ON DELETE CASCADE se quiser apagar o log junto
ALTER TABLE public.log_acoes
ADD CONSTRAINT log_acoes_eleitor_id_fkey
FOREIGN KEY (eleitor_id)
REFERENCES public.eleitores_fila(id)
ON DELETE SET NULL;

-- Comentário explicativo
COMMENT ON CONSTRAINT log_acoes_eleitor_id_fkey ON public.log_acoes IS
    'Referência ao eleitor. ON DELETE SET NULL mantém o log histórico mesmo se o eleitor for deletado.';
