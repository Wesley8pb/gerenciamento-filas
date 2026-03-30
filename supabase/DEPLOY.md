# Deploy das Funções e Migrations

## Edge Functions

As Edge Functions já estão deployadas. Para re-deploy quando houver alterações:

```bash
# Deploy de todas as funções
npx supabase functions deploy

# Deploy de função específica
npx supabase functions deploy gerar-senha
npx supabase functions deploy chamar-proximo
```

## Migrations do Banco

### Opção 1: Via Supabase Dashboard (Recomendado)

1. Acesse: https://supabase.com/dashboard/project/ifndiztgonndotoleefo
2. Vá em **SQL Editor** → **New query**
3. Cole o conteúdo do arquivo SQL
4. Clique em **Run**

### Opção 2: Via CLI do Supabase

```bash
# Linkar o projeto (se ainda não estiver linkado)
npx supabase link --project-ref ifndiztgonndotoleefo

# Aplicar todas as migrations pendentes
npx supabase db push
```

### Arquivos de Migration

| Arquivo | Descrição | Status |
|---------|-----------|--------|
| `20260329120000_schema.sql` | Schema inicial completo (tabelas, RLS, triggers) | ✅ Executado |
| `20260330150000_add_get_server_timestamp.sql` | Função RPC get_server_timestamp | ⏳ Pendente |

## Verificação

Após executar a migration, verifique se a função foi criada:

```sql
SELECT * FROM pg_proc WHERE proname = 'get_server_timestamp';
```

Ou teste diretamente:

```sql
SELECT public.get_server_timestamp();
```

## Configuração de Data para Testes

Para que o sistema funcione em uma data específica, certifique-se de que ela exista na tabela `configuracao_dias`:

```sql
-- Verificar se a data está cadastrada
SELECT * FROM configuracao_dias WHERE data = '2026-03-30';

-- Inserir nova data se necessário
INSERT INTO configuracao_dias (data, periodo, limite_senhas, bloqueado, ciclo_atual)
VALUES ('2026-03-30', 1, 100, false, 0);
```

## Edge Functions Disponíveis

| Função | Descrição | URL |
|--------|-----------|-----|
| `gerar-senha` | Cadastra eleitor e gera senha na fila | `/functions/v1/gerar-senha` |
| `chamar-proximo` | Chama próximo eleitor (lógica 2P:1N:1R) | `/functions/v1/chamar-proximo` |
| `criar-admin-inicial` | Cria o primeiro admin do sistema | `/functions/v1/criar-admin-inicial` |
| `criar-usuario` | Cria novos usuários | `/functions/v1/criar-usuario` |
| `resetar-senha` | Reseta senha de usuários | `/functions/v1/resetar-senha` |
| `check-agendamento-liberado` | Verifica liberação do agendamento | `/functions/v1/check-agendamento-liberado` |
| `agendar-eleitor` | Agenda eleitor no período 2 | `/functions/v1/agendar-eleitor` |

## Variáveis de Ambiente Necessárias

O arquivo `.env` deve conter:

```env
VITE_SUPABASE_URL=https://ifndiztgonndotoleefo.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon_aqui
```

**Importante:** Nunca commit o arquivo `.env` com valores reais.
