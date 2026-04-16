# CHANGELOG

## [1.1.1] - 2026-04-16

### 🟡 Correções de Qualidade de Código (Lint CI/CD)

- **`no-explicit-any` corrigido (30 ocorrências)**: Todos os blocos `catch (err: any)` substituídos por `catch (err: unknown)` com acesso seguro via `err instanceof Error`. Variáveis `valorA`/`valorB` em `RelatoriosPage.tsx` tipadas como `string | number`.
- **`no-unused-vars` corrigido**: Removida variável `SUPABASE_URL` não utilizada em `src/services/fila.ts`.
- **`react-hooks/exhaustive-deps` corrigido**: Função `loadLogs` em `LogsPage.tsx` convertida para `useCallback` com dependências corretas, adicionada como dependência do `useEffect`.
- **Tipagem sem `any` em acessos dinâmicos**: Substituídos todos `(obj as any).prop` por intersections tipadas (`EleitorFila & { servidor_atendimento?: { nome?: string } }`) em `RelatoriosPage.tsx` e `exportacao.ts`. Acesso ao `lastAutoTable` do jsPDF tipado corretamente.

### Arquivos Modificados

- `src/pages/AgendamentoPage.tsx` — 2 correções `no-explicit-any`
- `src/pages/AtendimentoPage.tsx` — 4 correções `no-explicit-any`
- `src/pages/LoginPage.tsx` — 1 correção `no-explicit-any`
- `src/pages/RecepcaoPage.tsx` — 1 correção `no-explicit-any`
- `src/pages/RelatoriosPage.tsx` — 3 correções `no-explicit-any`
- `src/pages/TrocarSenhaPage.tsx` — 1 correção `no-explicit-any`
- `src/pages/admin/ConfiguracaoDiasPage.tsx` — 5 correções `no-explicit-any`
- `src/pages/admin/GerenciarFilaPage.tsx` — 4 correções `no-explicit-any`
- `src/pages/admin/LogsPage.tsx` — 2 correções `no-explicit-any` + 1 correção `exhaustive-deps`
- `src/pages/admin/UsuariosPage.tsx` — 3 correções `no-explicit-any`
- `src/services/fila.ts` — Removida `SUPABASE_URL` não utilizada
- `src/utils/exportacao.ts` — 3 correções `no-explicit-any`

## [1.1.0] - 2026-03-31

### 🔴 Correções Críticas (Segurança e Integridade)

- **Race condition na geração de senhas**: Criada função RPC `gerar_senha_atomica` no PostgreSQL que usa `FOR UPDATE` para garantir operações atômicas. Elimina possibilidade de senhas duplicadas em cenários de alta concorrência.
- **Service Role Key removida do frontend**: Movida lógica de `criarUsuario()` e `resetarSenha()` para Edge Functions seguras (`admin-criar-usuario`, `admin-resetar-senha`). A chave de superusuário agora reside apenas no servidor.
- **Edge Functions de agendamento criadas**: Implementadas as funções `check-agendamento-liberado` e `agendar-eleitor` que eram referenciadas pelo frontend mas não existiam.
- **Validação JWT adicionada**: Todas as Edge Functions agora verificam o token JWT antes de processar requisições, impedindo acesso não autorizado.

### 🟠 Correções de Alta Prioridade

- **Validação de prioridade no servidor**: A regra de negócio "60+ anos = prioritário" agora é calculada na RPC `gerar_senha_atomica` baseada na data de nascimento, ignorando o campo `prioritario` enviado pelo cliente.
- **Race condition no ciclo de atendimento**: Criada função RPC `chamar_proximo_atomico` que usa `FOR UPDATE` e `FOR UPDATE SKIP LOCKED` para operações transacionais seguras no ciclo 2P:1N:1R.
- **Lógica de data de agendamento corrigida**: Simplificada a função `isAgendamentoLiberado()` eliminando bug de precedência de operadores (`||` vs `&&`).

### 🟡 Correções de Manutenibilidade

- **Padronização de nomenclatura**: Corrigido `remarcao_count` para `remarcacao_count` em todo o frontend, alinhando com o nome da coluna no banco de dados.

### Arquivos Modificados

**Novos:**
- `supabase/migrations/20260331100000_fix_race_conditions.sql` — RPCs atômicas
- `supabase/functions/admin-criar-usuario/index.ts` — Edge Function admin
- `supabase/functions/admin-resetar-senha/index.ts` — Edge Function admin
- `supabase/functions/check-agendamento-liberado/index.ts` — Edge Function agendamento
- `supabase/functions/agendar-eleitor/index.ts` — Edge Function agendamento

**Modificados:**
- `supabase/functions/gerar-senha/index.ts` — Refatorado para usar RPC atômica + validação JWT
- `supabase/functions/chamar-proximo/index.ts` — Refatorado para usar RPC atômica + validação JWT
- `src/services/usuarios.ts` — Removida Service Role Key, chamadas via Edge Functions
- `src/services/agendamento.ts` — Adicionado header de autenticação, corrigido `remarcacao_count`
- `src/utils/calendario.ts` — Corrigida lógica de `isAgendamentoLiberado()`
- `src/types/index.ts` — Corrigido `remarcacao_count`
- `src/services/relatorio.ts` — Corrigido `remarcacao_count`
- `src/pages/RelatoriosPage.tsx` — Corrigido `remarcacao_count`
- `src/utils/exportacao.ts` — Corrigido `remarcacao_count`

## [1.0.0] - 2026-03-30
- Adicionado `LESSONS.md` ao arquivo `.gitignore` para evitar o rastreamento do arquivo de lições aprendidas pelo Git.
- Criado o diretório `Documentations/` para centralizar as documentações de contexto, seguindo as diretrizes do projeto.
- Inicializado o arquivo `CHANGELOG.md` para registro histórico de alterações.
- Substituídas as variáveis reais por valores de exemplo no arquivo `.env.example` para garantir a segurança das credenciais do projeto.
