# RELATÓRIO TÉCNICO DE AUDITORIA
## Sistema de Gerenciamento de Filas — 56ª ZE

**Data da Análise:** 31/03/2026
**Versão do Sistema:** 1.0.0
**Tecnologia:** React 19 + TypeScript + Supabase

---

## RESUMO EXECUTIVO

O sistema apresenta **arquitetura moderna e bem estruturada**, com boas práticas de desenvolvimento em várias áreas. No entanto, foram identificados **problemas críticos, bugs e problemas de manutenibilidade e sustentabilidade** que demandam atenção imediata.

**Classificação Geral:**
- ✅ **Pontos Positivos:** Arquitetura modular, testes unitários, CI/CD configurado, segurança básica implementada
- ⚠️ **Pontos de Atenção:** Bugs de lógica, dependências de datas hardcoded, inconsistências entre frontend e backend
- ❌ **Pontos Críticos:** Possível race condition, lógica de agendamento não implementada, vulnerabilidades de segurança em Edge Functions

---

## PROBLEMAS CRÍTICOS (Prioridade 1 - URGENTE)

### 1. **Race Condition na Geração de Senhas** ⚠️ CRÍTICO
**Arquivo:** `supabase/functions/gerar-senha/index.ts:56`

```typescript
// LINHA 56: A lógica atual não é atômica
const proximaSenha = totalSenhas + 1;
```

**Problema:** A contagem de senhas é feita em duas queries separadas (SELECT COUNT + INSERT). Em cenários de alta concorrência (múltiplos atendentes simultâneos), duas requisições podem obter o mesmo `totalSenhas`, resultando em **senhas duplicadas**.

**Impacto:** Alto - Senhas duplicadas quebram a integridade da fila.

**Solução:** Usar uma sequence PostgreSQL ou implementar bloqueio transacional:
```sql
-- Criar sequence para senhas por dia
CREATE SEQUENCE IF NOT EXISTS senha_dia_seq;
-- Ou usar transação com LOCK
```

**Referência:** [PostgREST Row-Level Locking](https://postgrest.org/en/stable/references/transaction_isolation.html)

---

### 2. **Service Role Key Exposta no Frontend** ⚠️ CRÍTICO
**Arquivo:** `src/services/usuarios.ts:33-37`

```typescript
const SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const adminClient = SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY, {...}) : null;
```

**Problema:** A Service Role Key tem permissões de superusuário no Supabase. Expor no frontend (mesmo que via env) é uma **vulnerabilidade de segurança grave**. Qualquer usuário pode inspecionar o código e extrair a chave.

**Impacto:** Crítico - Usuários podem ter acesso administrativo ao banco.

**Evidência:** O bundle do Vite inclui todas as variáveis `VITE_` no código compilado.

**Solução:** Mover toda lógica de admin (criar usuário, resetar senha) para Edge Functions que executam no servidor.

---

### 3. **Edge Functions Referenciadas Inexistentes** ⚠️ CRÍTICO
**Arquivo:** `src/services/agendamento.ts:32-41`

```typescript
export async function checkAgendamentoLiberado(): Promise<AgendamentoStatus> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/check-agendamento-liberado`, {...});
```

**Problema:** As funções `check-agendamento-liberado` e `agendar-eleitor` (linha 52) são referenciadas no frontend, mas **não existem** no diretório `supabase/functions/`.

**Impacto:** Alto - Funcionalidade de agendamento não funciona.

**Solução:** Implementar as Edge Functions ou remover as referências.

---

### 4. **Inconsistência na Lógica de Prioridade** ⚠️ ALTO
**Arquivo:** `src/utils/calendario.ts:97` vs `supabase/functions/gerar-senha/index.ts:53`

```typescript
// Frontend: idade >= 60 é prioritário
setIsPrioritario(anos >= 60 || formData.pcd);

// Edge Function: apenas campo prioritario é usado
const fila = prioritario ? 'prioritaria' : 'normal'
```

**Problema:** A regra de negócio de "60 anos = prioritário" é calculada no frontend, mas a Edge Function aceita o campo `prioritario` sem validação. Um usuário malicioso poderia enviar `prioritario: true` para qualquer eleitor.

**Impacto:** Médio - Bypass da regra de prioridade.

**Solução:** Calcular a prioridade na Edge Function baseado na data de nascimento, ignorando o campo `prioritario` enviado.

---

## BUGS FUNCIONAIS (Prioridade 2 - ALTA)

### 5. **Condição de Corrida no Ciclo de Atendimento** ⚠️ ALTO
**Arquivo:** `supabase/functions/chamar-proximo/index.ts:51-87`

```typescript
// A lógica do ciclo é buscada e atualizada em queries separadas
const { data: config } = await supabaseClient.from('configuracao_dias').select('ciclo_atual')...
// ... processa ...
await supabaseClient.from('configuracao_dias').update({ ciclo_atual: ciclo })...
```

**Problema:** Múltiplos atendentes chamando simultaneamente podem ler o mesmo `ciclo_atual`, processar, e sobrescrever, pulando posições na fila.

**Impacto:** Médio - Ordem de atendimento pode ser incorreta.

**Solução:** Usar transação atômica ou row-level locking:
```sql
BEGIN;
SELECT ciclo_atual FROM configuracao_dias WHERE data = $1 FOR UPDATE;
-- ... processa lógica ...
UPDATE configuracao_dias SET ciclo_atual = $2 WHERE data = $1;
COMMIT;
```

---

### 6. **Loop Infinito Potencial na Busca de Eleitor** ⚠️ ALTO
**Arquivo:** `supabase/functions/chamar-proximo/index.ts:54-87`

```typescript
for (let attempts = 0; attempts < 4; attempts++) {
  // Se todas as filas estiverem vazias, o ciclo alterna entre 0-3
}
```

**Problema:** A lógica do ciclo pode não cobrir todos os casos edge. Se houver inconsistência de dados (ex: eleitor com status='aguardando' mas fila inválida), o comportamento é indefinido.

**Impacto:** Baixo - Possível inconsistência no ciclo.

**Solução:** Adicionar fallback explícito e logging.

---

### 7. **Erro de Lógica em Data de Agendamento** ⚠️ ALTO
**Arquivo:** `src/utils/calendario.ts:110-113`

```typescript
export function isAgendamentoLiberado(serverTime: Date): boolean {
  const liberacao = parseISO('2026-05-06T18:00:00');
  return isAfter(serverTime, liberacao) || isToday(serverTime) && serverTime.getHours() >= 18;
}
```

**Problema:** A condição `isToday(serverTime) && serverTime.getHours() >= 18` está incorreta. Para o dia 06/05, apenas o horário >= 18h deveria liberar. A lógica atual é confusa.

**Impacto:** Baixo - Comportamento confuso.

**Solução:** Simplificar a lógica:
```typescript
return isAfter(serverTime, liberacao) ||
       (isToday(serverTime) && isAfter(serverTime, parseISO('2026-05-06T18:00:00')));
```

---

### 8. **Falta de Validação de Permissões em Edge Functions** ⚠️ ALTO
**Arquivos:** `supabase/functions/gerar-senha/index.ts` e `chamar-proximo/index.ts`

**Problema:** As Edge Functions não validam se o `servidor_cadastro_id`/`servidor_id` enviado pertence a um usuário autenticado. Qualquer um com a URL pode cadastrar eleitores.

**Impacto:** Alto - Possível spam/injeção de dados.

**Solução:** Validar JWT do usuário antes de processar:
```typescript
const authHeader = req.headers.get('Authorization');
const token = authHeader?.replace('Bearer ', '');
const { data: { user }, error } = await supabaseClient.auth.getUser(token);
if (!user) throw new Error('Não autorizado');
```

---

## PROBLEMAS DE MANUTENIBILIDADE (Prioridade 3 - MÉDIA)

### 9. **Datas Hardcoded em Múltiplos Locais** ⚠️ MÉDIO
**Arquivos:**
- `src/utils/calendario.ts:4-27` - Arrays de datas hardcoded
- `src/services/relatorio.ts:65-67` - Datas de período hardcoded

```typescript
const PERIODO_1_ATIVOS: string[] = [
  '2026-04-13', '2026-04-14', ...
];
```

**Problema:** Datas de 2026 estão espalhadas pelo código. Para reuso em 2027, será necessário alterar múltiplos arquivos.

**Impacto:** Médio - Dificuldade de manutenção anual.

**Solução:** Centralizar em tabela de configuração no banco ou variáveis de ambiente.

---

### 10. **Inconsistência de Nomenclatura** ⚠️ MÉDIO
**Arquivo:** `src/types/index.ts:48`

```typescript
remarcao_count: number;  // Deveria ser remarcacao_count (português correto)
```

**Problema:** Erro de digitação no campo `remarcao_count` (falta o 'c').

**Impacto:** Baixo - Inconsistência com a migration que está correta.

**Solução:** Padronizar para `remarcacao_count` em todos os lugares.

---

### 11. **Código Duplicado de Retry/Timeout** ⚠️ MÉDIO
**Arquivo:** `src/hooks/useAuth.ts:13-55`

```typescript
// Retry manual implementado inline
for (let attempt = 0; attempt <= retries; attempt++) {
```

**Problema:** Lógica de retry está implementada inline em vez de ser reutilizada.

**Impacto:** Baixo - Dificulta manutenção.

**Solução:** Criar utility reutilizável:
```typescript
export async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  // implementação
}
```

---

### 12. **Queries N+1 em Relatórios** ⚠️ MÉDIO
**Arquivo:** `src/services/relatorio.ts:128-178`

**Problema:** Busca configuração de dias em uma query, depois busca eleitores em outra, e processa em loop no cliente.

**Impacto:** Baixo - Performance degradada com muitos dados.

**Solução:** Usar JOIN ou view materializada no PostgreSQL.

---

## PROBLEMAS DE SUSTENTABILIDADE (Prioridade 4 - BAIXA)

### 13. **Console.log em Produção** ⚠️ BAIXO
**Arquivo:** `src/hooks/useAuth.ts` - Múltiplos console.log

```typescript
console.log('[useAuth] Fetching profile for user:', userId);
```

**Problema:** Logs de debug estão presentes em código de produção.

**Impacto:** Baixo - Poluição do console e possível exposição de dados sensíveis.

**Solução:** Usar logger condicional ou removê-los:
```typescript
if (process.env.NODE_ENV === 'development') {
  console.log('[useAuth] ...');
}
```

---

### 14. **Testes com Coverage Excessivamente Excludente** ⚠️ BAIXO
**Arquivo:** `vitest.config.ts:14-23`

```typescript
coverage: {
  exclude: [
    'src/pages/**',      // ❌ Páginas excluídas
    'src/components/**', // ❌ Componentes excluídos
  ]
}
```

**Problema:** Páginas e componentes estão excluídos da cobertura de testes, onde está a maior parte da lógica de UI.

**Impacto:** Baixo - Métricas de cobertura não refletem a realidade.

**Solução:** Revisar exclusões e adicionar testes de componentes.

---

### 15. **Variáveis de Ambiente Não Tipadas** ⚠️ BAIXO
**Arquivo:** `src/lib/supabase.ts:3-4`

```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
```

**Problema:** Falta validação de tipo para as env vars além do runtime check.

**Impacto:** Baixo - Erros só são detectados em runtime.

**Solução:** Criar arquivo de tipos:
```typescript
// env.d.ts
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}
```

---

## RECOMENDAÇÕES POR ORDEM DE PRIORIDADE

### 🔴 Ações Imediatas (Semana 1)

| # | Ação | Arquivo(s) | Severidade |
|---|------|------------|------------|
| 1 | Implementar validação JWT nas Edge Functions | `supabase/functions/*` | 🔴 Crítico |
| 2 | Mover Service Role Key para Edge Functions | `src/services/usuarios.ts` | 🔴 Crítico |
| 3 | Criar Edge Functions de agendamento | `supabase/functions/` | 🔴 Crítico |
| 4 | Implementar sequence atômica para senhas | `supabase/migrations/` | 🔴 Crítico |

### 🟠 Ações Curto Prazo (Semanas 2-3)

| # | Ação | Arquivo(s) | Severidade |
|---|------|------------|------------|
| 5 | Corrigir lógica de prioridade | `supabase/functions/gerar-senha/index.ts` | 🟠 Alto |
| 6 | Adicionar transações nas operações de fila | `supabase/functions/chamar-proximo/index.ts` | 🟠 Alto |
| 7 | Criar tabela de configuração de calendário | `supabase/migrations/` | 🟡 Médio |
| 8 | Revisar todos os console.log | `src/**/*.ts` | 🟢 Baixo |

### 🟡 Ações Médio Prazo (Mês 1-2)

| # | Ação | Arquivo(s) | Severidade |
|---|------|------------|------------|
| 9 | Criar utility de retry reutilizável | `src/utils/` | 🟡 Médio |
| 10 | Melhorar cobertura de testes | `src/**/*.test.ts` | 🟡 Médio |
| 11 | Otimizar queries de relatórios | `src/services/relatorio.ts` | 🟡 Médio |
| 12 | Implementar rate limiting | `supabase/functions/` | 🟠 Alto |

---

## MATRIZ DE RISCOS

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Senhas duplicadas em horário de pico | Alta | Alto | Implementar sequence atômica |
| Vazamento de Service Role Key | Alta | Crítico | Mover para Edge Functions |
| Bypass de regra de prioridade | Média | Médio | Validar cálculo no servidor |
| Inconsistência na ordem da fila | Média | Médio | Usar transações |
| Dados hardcoded para 2027 | Alta | Médio | Criar configuração dinâmica |

---

## RESUMO DAS SEVERIDADES

| Severidade | Quantidade | Problemas |
|------------|------------|-----------|
| 🔴 **Crítico** | 4 | Race conditions, exposição de credenciais, funções inexistentes |
| 🟠 **Alto** | 4 | Bypass de regras, lógica de fila, validações |
| 🟡 **Médio** | 4 | Hardcodes, inconsistências, duplicações |
| 🟢 **Baixo** | 3 | Logs, cobertura, tipagem |

---

## CONCLUSÃO

O sistema tem **fundamentos sólidos** com boa arquitetura React + Supabase, mas apresenta **vulnerabilidades críticas de segurança** e **bugs de concorrência** que precisam ser endereçados antes do uso em produção com carga real.

### Pontos Fortes ✅
- Arquitetura modular e bem organizada
- Uso de TypeScript para tipagem
- Testes unitários configurados
- CI/CD implementado
- RLS habilitado no Supabase
- Documentação existente

### Pontos Fracos ❌
- Segurança de Edge Functions deficiente
- Lógica de concorrência não atômica
- Acoplamento de regras de negócio no frontend
- Datas hardcoded dificultam reuso

### Recomendação Final
**⚠️ NÃO RECOMENDADO para produção** até que os 4 itens críticos (race condition, Service Role Key, Edge Functions de agendamento, validação de permissões) sejam resolvidos.

Após correções, o sistema estará apto para uso em ambiente de produção.

---

*Relatório gerado em: 31/03/2026*
*Ferramenta: Análise de código estático*
*Versão do relatório: 1.0*
