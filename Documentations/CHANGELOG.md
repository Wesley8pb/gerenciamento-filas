# CHANGELOG

## [1.2.3] - 2026-04-20

### 🚀 Melhoria — Solução de Proxy Reverso para Rede Institucional (TRE/PB)

- **Motivo**: A rede do TRE/PB bloqueia domínios `*.supabase.co`, causando erros de `Failed to fetch`.
- **Solução**: Implementação de Proxy Reverso via Netlify. O frontend agora comunica-se com `/supabase-api` do próprio domínio, e o Netlify repassa as chamadas ao Supabase.
- **Segurança**: Mantida a mesma lógica de tokens (`anon key`), apenas a rota é intermediada pelo servidor do Netlify.
- **Documentação**: Criado guia de reversão em `Documentations/SOLUCAO_PROXY_TRE.md`.

### 🐛 Correção Crítica — Erro 404 e 'Unexpected end of JSON input' no Login

- **Causa**: O construtor de URLs interno do Supabase (GoTrue/Auth) interpreta caminhos sem barra final como arquivos. Isso fazia com que o segmento `/supabase-api` fosse removido, enviando requisições de autenticação para a raiz do site, resultando em 404 e retorno de HTML (index.html) em vez de JSON.
- **Correção**: Adicionada barra de fechamento (`trailing slash`) obrigatoriamente na URL de inicialização em produção.
- **Melhoria**: Refatorada a exportação de `SUPABASE_URL` para garantir que serviços que usam `fetch` manual não dupliquem barras nas rotas.

### Arquivos Modificados
- `src/lib/supabase.ts` — Lógica de normalização de URL com trailing slash.
- `Documentations/SOLUCAO_PROXY_TRE.md` — Atualizado com a nota sobre a barra de fechamento.

---

## [1.2.2] - 2026-04-17

### 🐛 Correção — Botão "Sair" com demora no logout

- **Causa**: `logout()` chamava `await supabase.auth.signOut()` antes de limpar a store. Como `signOut()` é uma chamada de rede (pode levar 1-3 s para o servidor responder), a interface ficava travada aguardando a resposta antes de navegar para `/login`.
- **Correção**: Padrão **logout otimista** aplicado em `useAuth.ts`:
  1. Store é limpa **imediatamente** → UI navega para `/login` na hora
  2. `signOut()` é disparado **em segundo plano** (sem `await`) para invalidar o token no servidor
- `handleLogout` em `Layout.tsx` também simplificado (removido `await` desnecessário).

### Arquivos Modificados

- `src/hooks/useAuth.ts` — `logout`: de `async/await signOut` para otimista (clear → background signOut)
- `src/components/Layout.tsx` — `handleLogout`: removido `async/await`

---

## [1.2.1] - 2026-04-17

### 🔄 Refatoração — Regra da Fila de Retorno

**Mudança de comportamento solicitada:** A fila de retorno agora só é acionada quando as filas prioritária e normal estiverem completamente vazias.

**Lógica anterior (ciclo fixo 2P:1N:1R) — REMOVIDA:**
- O sistema alternava em ciclos: Prioritária → Prioritária → Normal → Retorno
- O retorno sempre tinha uma "vaga garantida" a cada 4 chamadas

**Nova lógica (cascata de prioridade):**
1. Chama da fila **Prioritária** (se houver alguém)
2. Se prioritária vazia → chama da fila **Normal**
3. Se prioritária **e** normal vazias → chama da fila de **Retorno**
4. Se todas vazias → "Não há ninguém aguardando"

A ordenação dentro de cada fila continua respeitando `ordem_manual` (quando definida pelo admin) e `senha` como critério de desempate.

### Arquivos Modificados / Criados

- `supabase/migrations/20260417170000_refactor_retorno_somente_quando_filas_vazias.sql` — Nova RPC aplicada

---

## [1.2.0] - 2026-04-17

### 🐛 Correção — Gerenciamento de Fila: alteração de ordem não surtia efeito

**Causa raiz (dois pontos independentes):**

1. **Display incorreto** — `fetchFilaDia` ordenava exclusivamente por `senha ASC`. O campo `ordem_manual` era salvo no banco, mas a lista do admin continuava aparecendo na ordem de chegada original.  
   **Correção (`src/services/fila.ts`):** Query atualizada para `.order('ordem_manual', { ascending: true, nullsFirst: false }).order('senha', { ascending: true })`. Quem tem `ordem_manual` definida aparece primeiro; os demais ficam ordenados por `senha` (chegada).

2. **Chamada ignorava ordem** — A RPC `chamar_proximo_atomico` usava `ORDER BY senha ASC`, de modo que mesmo que o admin reordenasse, o sistema continuava chamando pelo número da senha, não pela ordem definida.  
   **Correção (`chamar_proximo_atomico`):** `ORDER BY COALESCE(ordem_manual, 999999), senha ASC`. Eleitores com `ordem_manual` definida têm prioridade de chamada; os demais mantêm a ordem de chegada.

### Arquivos Modificados / Criados

- `src/services/fila.ts` — `fetchFilaDia`: ordenação por `ordem_manual` (nulls last) + `senha`
- `supabase/migrations/20260417165000_fix_chamar_proximo_ordem_manual.sql` — Correção da RPC

---

## [1.1.9] - 2026-04-17

### 🔴 Correção Crítica — `chamar-proximo` HTTP 400 + RPCs ausentes no banco

**Bug 1 — `chamar_proximo_atomico` (HTTP 400 ao chamar próximo):**
- **Causa**: Variável `v_fila_busca` declarada como `TEXT` sendo comparada com a coluna `fila` do tipo `fila_enum`. PostgreSQL lança erro `42883: operator does not exist: fila_enum = text` — não existe operador `=` entre tipos incompatíveis.
- **Correção**: Tipo da variável alterado de `TEXT` para `fila_enum`. As atribuições de string (`'prioritaria'`, `'normal'`, `'retorno'`) são implicitamente convertidas pelo PostgreSQL em PL/pgSQL.

**Bug 2 — `registrar_retorno_atomico` inexistente (chamar fila de retorno quebrava silenciosamente):**
- **Causa**: A migração `20260416120000_fix_race_conditions_v2.sql` nunca foi aplicada ao banco de produção. A função estava definida no arquivo local mas nunca existiu no Supabase.
- **Correção**: Função criada com incremento atômico de `retorno_count` e movimentação para fila de retorno.

**Bug 3 — `remarcar_atomico` inexistente (mesma causa do Bug 2):**
- **Causa**: Mesma migração não aplicada.
- **Correção adicional**: Nome da coluna corrigido de `remarcacao_count` (como estava no arquivo de migração) para `remarcao_count` (nome real da coluna no banco).

**Validação:** Todos os 3 cenários testados e confirmados via SQL direto antes e após as correções.

### Arquivos Modificados / Criados

- `supabase/migrations/20260417160000_fix_all_rpc_enum_cast_issues.sql` — Migração abrangente com as 3 correções

---

## [1.1.8] - 2026-04-17

### 🔴 Correção Crítica — Edge Function `gerar-senha` HTTP 400 em todo cadastro

- **Causa raiz**: A função RPC `gerar_senha_atomica` no PostgreSQL tentava inserir texto literal (`'agendado'`, `'normal'`, `'aguardando'`) diretamente nas colunas `tipo`, `fila` e `status` da tabela `eleitores_fila`. Essas colunas são do tipo `enum` personalizado (`tipo_enum`, `fila_enum`, `status_enum`). O PostgreSQL **não converte TEXT para enum implicitamente** — lança o erro `42804: column is of type tipo_enum but expression is of type text`.
- **Sintoma**: 400 Bad Request em toda chamada `POST /functions/v1/gerar-senha`, impossibilitando qualquer cadastro de eleitor.
- **Correção**: Adicionados casts explícitos `::tipo_enum`, `::fila_enum` e `::status_enum` no INSERT da RPC.
- **Correção adicional**: A verificação de limite de senhas foi ajustada para só aplicar quando `limite_senhas > 0`, evitando bloqueio em dias com limite zerado.
- **Validação**: RPC testada diretamente via SQL antes e após a correção — retornou `{ "success": true, "senha": 1, ... }` com sucesso.

### Arquivos Modificados / Criados

- `supabase/migrations/20260417150000_fix_gerar_senha_atomica_tipo_cast.sql` — Correção aplicada ao banco de dados

---

## [1.1.7] - 2026-04-17

### 🏗️ Refatoração — `useAuth.ts`: padrão Singleton para listeners de autenticação

- **Problema arquitetural identificado**: o hook `useAuth` era chamado por 4-5 componentes simultaneamente (`App`, `Layout`, `ProtectedRoute`, `RoleGuard`, `AgendamentoPage`). Cada chamada registrava um listener `onAuthStateChange` independente. Quando o Supabase disparava `INITIAL_SESSION`, todos os listeners chamavam `fetchProfile` ao mesmo tempo, causando 8-10 requisições paralelas e erros de timeout.
- **Solução**: `onAuthStateChange` e `initAuth` movidos para **nível de módulo** (singleton). O código roda uma única vez quando o módulo é importado pela primeira vez, independentemente de quantos componentes usam o hook.
- **O hook agora é puro**: apenas lê a store Zustand e expõe as funções `login`, `logout` e `updatePassword`. Zero `useEffect` de auth, zero listeners duplicados.
- **Compatibilidade mantida**: a API pública do hook (`user`, `isLoading`, `isAuthenticated`, `login`, `logout`, `updatePassword`, `primeiroAcesso`) permanece idêntica — nenhum componente consumidor precisou ser alterado.
- **Typecheck e build**: zero erros TypeScript, build gerado com sucesso (`Exit code: 0`).

### Arquivos Modificados

- `src/hooks/useAuth.ts` — Refatoração completa para padrão singleton

---

## [1.1.6] - 2026-04-17

### 🔴 Correção Crítica — `verify_jwt: true` em todas as Edge Functions com auth interna

Todas as funções com autenticação interna própria (via `supabaseClient.auth.getUser(token)`) estavam com `verify_jwt: true`, criando dupla validação com risco de bloqueio 401 pelo gateway do Supabase. A `check-agendamento-liberado` era pública mas estava bloqueando usuários não autenticados.

| Função | Antes | Depois |
|---|---|---|
| `admin-criar-usuario` | v2 `true` | v3 `false` |
| `gerar-senha` | v4 `true` | v5 `false` |
| `chamar-proximo` | v4 `true` | v5 `false` |
| `agendar-eleitor` | v3 `true` | v4 `false` |
| `check-agendamento-liberado` | v3 `true` | v4 `false` |

---

## [1.1.5] - 2026-04-17

### 🔴 Correção Crítica — Edge Function `admin-resetar-senha` (Erro 401 em produção)

- **Causa raiz**: função deployada com `verify_jwt: true`, fazendo o gateway do Supabase rejeitar com 401 antes do código executar.
- **Correção**: redeploy com `verify_jwt: false` (v3). Segurança mantida pela validação interna de token + perfil admin.

---

## [1.1.4] - 2026-04-17

### 🧹 Limpeza e Unificação de Branches

- **Unificação na `main`**: Todo o código de desenvolvimento foi consolidado na branch `main`, que já estava atualizada com todos os merges anteriores.
- **Worktree removido**: O worktree local `.worktrees/netlify-preparo` foi excluído pois o conteúdo já havia sido integrado à `main`.
- **Branches locais removidas**: `feat/improvements-and-email-header` e `feat/netlify-preparo` deletadas localmente.
- **Branches remotas removidas**: `feat/improvements-and-email-header` e `feat/netlify-preparo` deletadas do GitHub.
- **Referências obsoletas purgadas**: `origin/claude/add-mcp-gitignore-elZXz` e `origin/fix-eslint-errors` removidas via `git remote prune origin`.
- **Estado final**: apenas `main` existe local e remotamente, sincronizada com `origin/main`.

---

## [1.1.3] - 2026-04-16

### 🔧 Correção de Tipagem — `src/test/setup.ts`

- **`global` substituído por `globalThis`**: `global` é exclusivo do Node.js e não existe no `lib` do `tsconfig.app.json` (`ES2023 + DOM`). `globalThis` é o padrão ECMAScript cross-environment que funciona em qualquer runtime (browser e Node.js).
- **Typecheck validado**: `npm run typecheck` passou com zero erros após a correção.

### Arquivos Modificados

- `src/test/setup.ts` — L20 e L27: `global.IntersectionObserver` e `global.ResizeObserver` → `globalThis.*`

---

## [1.1.2] - 2026-04-16


### 🔧 Correções de Tipagem nos Testes (CI/CD — Bloqueio de Build)

- **Padrão factory function centralizado**: Criadas as funções `makeProfile()` e `makeConfiguracaoDia()` em `src/test/mocks.ts` com valores padrão completos e suporte a overrides parciais. Garante que futuras mudanças no tipo sejam corrigidas em um único lugar.
- **`auth.test.ts` corrigido**: Todos os objetos `Profile` refatorados para usar `makeProfile({ ...override })`, eliminando 5 erros de campos obrigatórios ausentes (`primeiro_acesso`, `created_at`).
- **`configuracao.test.ts` corrigido**: Todos os objetos `ConfiguracaoDia` refatorados para usar `makeConfiguracaoDia({ ...override })`, eliminando 4 erros de campos obrigatórios ausentes (`periodo`, `dia_especial`, `observacao`, `ciclo_atual`, `created_at`).
- **Cast TypeScript inseguro corrigido**: Substituído `supabase as { from: ... }` por `supabase as unknown as { from: ... }` — padrão correto para double cast sem sobreposição de tipos.
- **Typecheck validado**: `npm run typecheck` executado com sucesso (zero erros) após as correções.

### Arquivos Modificados

- `src/test/mocks.ts` — Adicionadas `makeProfile()` e `makeConfiguracaoDia()` (factories de fixtures)
- `src/store/auth.test.ts` — Refatorado para usar `makeProfile()`
- `src/services/configuracao.test.ts` — Refatorado para usar `makeConfiguracaoDia()` + cast seguro

---

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
