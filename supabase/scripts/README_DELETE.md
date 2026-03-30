# Como Deletar Eleitores de Teste

## Problema
Ao tentar deletar eleitores da tabela `eleitores_fila`, aparece o erro:
```
ERROR: 23503: update or delete on table "eleitores_fila" violates foreign key constraint
"log_acoes_eleitor_id_fkey" on table "log_acoes"
```

Isso acontece porque a tabela `log_acoes` registra todas as ações e referencia o eleitor. Para deletar, você precisa primeiro remover os logs relacionados.

---

## Opção 1: Deletar Logs Primeiro (Recomendado)

Execute no SQL Editor do Supabase:

```sql
-- Passo 1: Deletar logs dos eleitores de teste
DELETE FROM log_acoes
WHERE eleitor_id IN (
    SELECT id FROM eleitores_fila
    WHERE nome ILIKE '%teste%'
       OR nome ILIKE '%fulano%'
       OR nome ILIKE '%ciclano%'
       OR nome ILIKE '%beltrano%'
);

-- Passo 2: Agora deletar os eleitores
DELETE FROM eleitores_fila
WHERE nome ILIKE '%teste%'
   OR nome ILIKE '%fulano%'
   OR nome ILIKE '%ciclano%'
   OR nome ILIKE '%beltrano%';
```

---

## Opção 2: Deletar Todos os Dados do Dia

Se quiser limpar tudo de uma data específica:

```sql
-- Deletar logs primeiro
DELETE FROM log_acoes
WHERE eleitor_id IN (
    SELECT id FROM eleitores_fila
    WHERE dia_atendimento = '2026-03-30'
);

-- Depois deletar eleitores
DELETE FROM eleitores_fila
WHERE dia_atendimento = '2026-03-30';
```

---

## Opção 3: Aplicar Migration para Futuro

Execute a migration `20260330160000_alter_log_acoes_fk.sql` para alterar a constraint:

```sql
-- Isso faz com que ao deletar um eleitor, o log mantém o registro
-- mas com eleitor_id = NULL
ALTER TABLE public.log_acoes
DROP CONSTRAINT IF EXISTS log_acoes_eleitor_id_fkey;

ALTER TABLE public.log_acoes
ADD CONSTRAINT log_acoes_eleitor_id_fkey
FOREIGN KEY (eleitor_id)
REFERENCES public.eleitores_fila(id)
ON DELETE SET NULL;
```

Após isso, você poderá deletar eleitores normalmente pelo Dashboard.

---

## Opção 4: Usar CASCADE (Deleta Log Junto)

Se quiser que ao deletar o eleitor, o log também seja deletado:

```sql
ALTER TABLE public.log_acoes
DROP CONSTRAINT IF EXISTS log_acoes_eleitor_id_fkey;

ALTER TABLE public.log_acoes
ADD CONSTRAINT log_acoes_eleitor_id_fkey
FOREIGN KEY (eleitor_id)
REFERENCES public.eleitores_fila(id)
ON DELETE CASCADE;
```

---

## Dica

Para ver quais eleitores existem antes de deletar:

```sql
SELECT senha, nome, dia_atendimento, status
FROM eleitores_fila
ORDER BY senha;
```
