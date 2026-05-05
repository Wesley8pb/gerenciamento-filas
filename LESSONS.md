# Lições Aprendidas

## 1. Página em branco / carregamento infinito (28/03/2026)

### Problema
A aplicação ficava travada em uma tela branca com "Carregando..." infinitamente ao acessar `http://localhost:5173`.

### Causas identificadas

#### 1.1 Vite escutando apenas em IPv6
O Vite estava vinculado apenas ao endereço IPv6 `[::1]:5173`, causando falha em navegadores que resolvem `localhost` para IPv4 `127.0.0.1`.

**Solução:** Adicionar `server: { host: true }` no `vite.config.ts`:
```ts
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
  },
})
```

#### 1.2 `supabase.auth.getSession()` travando com token expirado
Quando o Supabase armazena um token de sessão antigo no `localStorage` do navegador, a chamada `getSession()` tenta fazer refresh desse token. Se o projeto Supabase estiver lento ou o token for inválido, essa chamada pode travar indefinidamente.

**Solução:** Adicionar timeout de 3 segundos no `getSession()`:
```ts
const sessionTimeout = new Promise<never>((_, reject) =>
  setTimeout(() => reject(new Error('getSession timeout')), 3000)
);

const { data: { session } } = await Promise.race([
  supabase.auth.getSession(),
  sessionTimeout,
]);
```

#### 1.3 `useRef` para controle de inicialização dentro de custom hook
O `useAuth()` usava `useRef(false)` para evitar dupla inicialização. Porém, como cada componente que chama `useAuth()` cria **sua própria instância** do ref, a inicialização rodava múltiplas vezes (uma vez no `ProtectedRoute`, outra no `LoginPage`, etc.), multiplicando as chamadas travadas.

**Solução:** Usar uma variável no nível do **módulo** (fora do hook):
```ts
// ❌ ERRADO — cada componente cria seu próprio ref
function useAuth() {
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    // ...
  });
}

// ✅ CORRETO — compartilhado entre todos os componentes
let authInitialized = false;

function useAuth() {
  useEffect(() => {
    if (authInitialized) return;
    authInitialized = true;
    // ...
  });
}
```

### Problema 3: Logout silencioso frequente - Perfil não encontrado mas sessão existe

O sistema retornava para a tela de login de forma súbita e frequente, especialmente quando havia instabilidade na rede ou quando o Supabase estava lento.

**Causa:** Quando `fetchProfile` retornava `null` (por timeout, erro de rede ou perfil não existir), o código chamava `setUser(null)`, que definia `isAuthenticated: false` e causava o redirecionamento para o login, mesmo havendo uma sessão válida no Supabase.

**Solução implementada:**
1. **Adicionar retry no fetchProfile:** Tentativas automáticas (até 3) com espera crescente entre elas
2. **Não fazer signOut quando perfil é null:** Se há sessão válida mas o perfil não é encontrado, não deslogar automaticamente
3. **Recriar perfil automaticamente:** Se o usuário tem metadados válidos (nome/email), tenta inserir o perfil na tabela `profiles` automaticamente
4. **Tratamento diferenciado para erros:** Erro `PGRST116` (não encontrado) não dispara retry, apenas timeouts/similar

```ts
// Antes: Deslogava automaticamente
const profile = await fetchProfile(session.user.id);
setUser(profile); // Se null, isAuthenticated = false

// Depois: Tenta recuperar antes de deslogar
const profile = await fetchProfile(session.user.id);
if (profile) {
  setUser(profile);
} else {
  // Tenta recriar perfil dos metadados
  // Se falhar, apenas marca como não autenticado sem signOut
}
```

**Boas práticas adicionadas:**
- Retry com backoff exponencial (500ms, 1000ms, 1500ms)
- Diferenciação entre "perfil não existe" (PGRST116) e "erro de rede/timeout"
- Recuperação automática de perfis órfãos (quando auth.user existe mas profiles não)
- Nunca chamar `signOut()` automaticamente em caso de erro - deixa o usuário tentar novamente

### Resumo das boas práticas - Seção 1

| Prática | Motivo |
|---------|--------|
| `server: { host: true }` no Vite | Garante acesso via IPv4 e IPv6 |
| Timeout em chamadas ao Supabase | Evita tela travada se o backend estiver lento |
| Timeout global de segurança | Rede de segurança caso qualquer etapa trave |
| Flag de inicialização no nível do módulo | Evita múltiplas execuções em custom hooks compartilhados |
| Retry com backoff em fetchProfile | Recupera de falhas transientes de rede |
| Não fazer signOut automático em erro | Evita logout silencioso, permite retry manual |

## 2. Criação Administrativa de Usuários e Sincronização de Perfis (28/03/2026)

### Problema 1: Erro de rede (Failed to fetch / CORS) ao criar usuário
Ao tentar cadastrar um novo atendente no painel, o sistema alertava "Falha na conexão". O Supabase acusava erro de CORS no console da `Edge Function` `/functions/v1/criar-usuario`.

**Causa:** A chamada `fetch()` exigia uma Edge Function para rodar comandos administrativos, e a função não estava implantada (deployed) no projeto nuvem, resultando em um erro 404/CORS por ausência da rota esperada.

**Solução (Bypass via Admin Client):** Expor a chave do administrador (`SUPABASE_SERVICE_ROLE_KEY`) no próprio `.env` de desenvolvimento como `VITE_SUPABASE_SERVICE_ROLE_KEY`. Isso permitiu inicializar um `adminClient` no front-end e chamar **diretamente** a Admin API `supabase.auth.admin.createUser`, sem depender de rotas na nuvem.

### Problema 2: Usuário criado, mas não conseguia logar (logout silencioso)
Após criar a senha, o usuário era recebido, mas voltava para a tela `Login` instantaneamente sem erro algum.

**Causa:** O sistema usava um `.update()` na tabela `profiles` para complementar os dados do recém-criado. Como não existia um gatilho automático (Trigger no PostgreSQL) que criava a base do registro no momento da criação do Auth, a tabela principal não tinha linha nenhuma. O `.update()` não gerava erro, atualizando "0 linhas". No momento que o front-end tentava puxar o perfil no React (`fetchProfile`), vinha nulo e desconectava o usuário no estado do Zustand.

**Solução:** 
Trocar a lógica na camada Client (em `usuarios.ts`) para utilizar `.insert()`, forçando manualmente a injeção dos dados iniciais do perfil após o sucesso do `.createUser()`. Além disso, rodar um pequeno script para popular ativamente usuários orfãos criados na janela da falha.

## 3. Ajustes de usabilidade, atualização manual e proxy Supabase/Netlify (02/05/2026)

### Problema 1: Campo de data ruim para uso no celular
O cadastro de eleitor usava `input type="date"` para data de nascimento. Em celulares, o seletor de calendário era lento e pouco prático para informar datas antigas.

**Solução implementada:**
- Trocar o campo de nascimento em `RecepcaoPage.tsx` e `AgendamentoPage.tsx` para `input type="text"`.
- Aplicar máscara `DD/MM/AAAA` durante a digitação.
- Converter o valor para `AAAA-MM-DD` apenas antes de enviar ao backend, preservando o contrato existente com Supabase, RPCs e relatórios.
- Validar data incompleta, inexistente e futura antes do envio.

**Lição:** quando a interface de data representa nascimento ou data antiga, máscara de texto pode ser melhor que calendário nativo em mobile. O estado enviado ao backend deve continuar no formato ISO para não espalhar mudança pelas camadas de serviço.

### Problema 2: Tela Atendimento nem sempre atualizava em tempo real
Em alguns momentos o realtime não atualizava a aba Atendimento, forçando o usuário a trocar de abas ou usar F5. O F5 podia derrubar a experiência por recarregar toda a SPA e acionar novamente o fluxo de autenticação.

**Solução implementada:**
- Adicionar botão `Atualizar agora` na aba Atendimento.
- Reaproveitar a função existente `carregarDados()`.
- Atualizar fila prioritária, normal, retorno, ausentes, eleitor chamado e histórico.
- Mostrar estado `Atualizando...` com ícone girando.
- Não recarregar a página, não mexer em sessão/login e não alterar a assinatura realtime.

**Lição:** realtime deve ser tratado como melhoria de experiência, não como único caminho operacional. Telas críticas precisam de uma ação manual de sincronização que reutilize a mesma fonte de verdade do carregamento inicial.

### Problema 3: Produção precisava de proxy para Supabase
A rede institucional pode bloquear chamadas diretas para `*.supabase.co`, causando `Failed to fetch`, `ERR_CONNECTION_TIMED_OUT` ou 404 quando a URL base do proxy é montada sem barra final.

**Solução implementada em produção:**
- Manter `netlify.toml` com proxy `/supabase-api` e `/supabase-api/*` para `https://ifndiztgonndotoleefo.supabase.co`.
- Em produção, criar o Supabase Client com `${window.location.origin}/supabase-api/`.
- Preservar a barra final em `/supabase-api/`, porque o client do Supabase monta rotas internas como `auth/v1`, `rest/v1` e `functions/v1`.

**Lição:** em produção Netlify, o frontend deve chamar o próprio domínio do sistema, e a Netlify encaminha para o Supabase. Não apontar o navegador diretamente para `*.supabase.co` quando a rede do usuário final pode bloquear esse domínio.

### Problema 4: Localhost também falhava ao acessar Supabase direto
Mesmo depois de ajustar produção, o modo local ainda tentava usar `VITE_SUPABASE_URL` direto para `*.supabase.co`. Isso gerou `AuthRetryableFetchError: Failed to fetch`, `read ECONNRESET`, `socket hang up` e timeouts no login local.

**Diagnóstico validado:**
- `curl` direto para `https://ifndiztgonndotoleefo.supabase.co/auth/v1/health` podia dar timeout.
- `http://localhost:5173/supabase-api/...` sem proxy real retornava HTML do Vite, não resposta do Supabase.
- `https://filas-56.netlify.app/supabase-api/auth/v1/settings` retornava `200`.
- POST falso para `https://filas-56.netlify.app/supabase-api/auth/v1/token?grant_type=password` retornava `400`, resposta esperada para credencial inválida.

**Solução implementada no dev local:**
- Em `src/lib/supabase.ts`, usar `/supabase-api/` tanto em `PROD` quanto em `DEV`.
- Em `vite.config.ts`, configurar proxy local de `/supabase-api` para `https://filas-56.netlify.app`.
- Manter `changeOrigin: true`, `timeout`/`proxyTimeout` explícitos e `https.Agent({ keepAlive: false })` para reduzir resets por reaproveitamento de socket.
- Reiniciar o Vite sempre que `vite.config.ts` mudar.

**Lição:** proxy local para o Supabase só ajuda se o processo local conseguir alcançar o destino. Quando a máquina local também não consegue alcançar `*.supabase.co`, usar a própria Netlify de produção como ponte para desenvolvimento local.

### Problema 5: Teste em produção precisava de ponto de retorno
Antes de commitar e testar alterações de proxy/atendimento em produção, era necessário ter uma forma simples de voltar ao estágio anterior.

**Solução adotada:**
- Criar branch de backup apontando para o commit anterior: `codex/backup-antes-teste-producao-2026-05-02`.
- Manter as alterações no `main` para commit e deploy.
- Em caso de problema em produção, preferir `git revert` do commit problemático em vez de `git reset --hard`, preservando histórico e segurança operacional.

### Resumo das boas práticas - Seção 3

| Prática | Motivo |
|---------|--------|
| Usar máscara `DD/MM/AAAA` para nascimento | Melhor usabilidade mobile |
| Converter data para ISO antes do backend | Evita mudanças em serviços, RPCs e relatórios |
| Adicionar botão manual de atualização | Dá alternativa quando realtime falha |
| Reutilizar `carregarDados()` | Evita duplicar regra de negócio |
| Usar `/supabase-api/` com barra final | Evita URLs quebradas no Supabase Client |
| Testar endpoints com `curl` antes de alterar auth | Separa erro de código de erro de rede |
| Usar Netlify como ponte no dev quando `*.supabase.co` é bloqueado | Evita `Failed to fetch`, `ECONNRESET` e timeout locais |
| Reiniciar Vite após mudar `vite.config.ts` | Config de proxy não é confiável sem restart |
| Criar branch de backup antes de deploy arriscado | Facilita comparação e rollback seguro |

## 4. Retorno de ausentes para fila normal e prioridade gestante/criança de colo (05/05/2026)

### Problema 1: Resgate de ausente voltava para fila apartada
O sistema mantinha uma fila `retorno` para eleitores marcados como ausentes e resgatados manualmente. Pela regra vigente, essa fila só era chamada depois de zerar as filas prioritária e normal, o que deixava o eleitor resgatado aguardando além do comportamento operacional desejado.

**Solução implementada:**
- Manter o resgate manual: marcar ausente continua deixando o eleitor com `status = 'ausente'`.
- Ao resgatar, a RPC `registrar_retorno_atomico` passa o eleitor para `status = 'aguardando'` e `fila = 'normal'`.
- A RPC incrementa `retorno_count`, registra `horario_retorno` e define `ordem_manual` no fim atual da fila normal.
- A posição de retorno é calculada com base em `MAX(COALESCE(ordem_manual, senha)) + 1` entre os eleitores normais aguardando naquele dia.
- O log registra a fila de destino e a ordem manual aplicada.

**Lição:** regra real de atendimento não deve ser resolvida só na interface. Quando a regra envolve chamada, concorrência ou reposicionamento, a fonte de verdade precisa estar na RPC e a UI deve apenas refletir a ordenação efetiva.

### Problema 2: Nova prioridade não podia virar categoria separada no relatório
Foi necessário criar a marcação "Gestante/criança de colo" na Recepção para dar prioridade de atendimento, mas sem gerar filtro, card, aba, linha ou agrupamento separado nos relatórios.

**Solução implementada:**
- Adicionar a coluna booleana `gestante_crianca_colo` em `eleitores_fila`, com default `false`.
- Incluir o campo no tipo `EleitorFila` e no fluxo da Recepção.
- Adicionar checkbox "Gestante/criança de colo" apenas na Recepção.
- Atualizar `gerar_senha_atomica` para considerar prioritário quem tem idade 60+, PCD ou gestante/criança de colo.
- Manter o Agendamento sem esse checkbox e enviar `p_gestante_crianca_colo = false`.
- Nos relatórios, gestante/criança de colo aparece apenas dentro da categoria geral `Prioritário`.
- PCD continua separado exatamente como antes, com filtro, resumo e indicação nominal próprios.

**Lição:** nem toda origem de prioridade precisa virar categoria analítica. A regra operacional pode ampliar quem entra na fila prioritária, enquanto o relatório preserva apenas os recortes que têm significado institucional separado.

### Problema 3: Ordenação precisava ser consistente em UI, RPC e testes
Além da mudança de fila, a chamada precisava manter a precedência de 80+ sobre demais prioridades e respeitar a posição efetiva dentro da fila normal.

**Solução implementada:**
- A ordenação de atendimento mantém 80+ antes das demais prioridades.
- Dentro da fila normal, a posição efetiva usa `ordem_manual` quando existir; caso contrário, usa `senha`.
- O retorno de ausente recebe `ordem_manual` depois dos normais já aguardando no momento do resgate.
- Testes cobrem retorno para fila normal, prioridade por gestante/criança de colo, PCD como prioridade com relatório separado, 80+ antes das demais prioridades e retorno depois dos normais existentes.

### Problema 4: Deploy Supabase precisava de validação objetiva
Como a regra principal roda em banco e Edge Functions, não basta o frontend compilar. É preciso validar a definição remota das RPCs e a disponibilidade real das funções pelo caminho usado pela aplicação.

**Validação aplicada:**
- Migration remota aplicada como `20260505181740 ajustar_retorno_normal_gestante_crianca_colo`.
- Edge Functions publicadas com `--use-api --no-verify-jwt`, preservando validação interna e CORS.
- `gerar-senha` publicada como versão 7.
- `agendar-eleitor` publicada como versão 6.
- Confirmada a coluna `gestante_crianca_colo` em `public.eleitores_fila`.
- Confirmadas as definições remotas de `registrar_retorno_atomico`, `gerar_senha_atomica` e `chamar_proximo_atomico`.
- Testado `OPTIONS` das functions via `/supabase-api/functions/v1/...`.

### Resumo das boas práticas - Seção 4

| Prática | Motivo |
|---------|--------|
| Manter ausente parado até resgate manual | Preserva o controle operacional do atendente |
| Reposicionar retorno na RPC | Evita divergência entre telas e chamada real |
| Usar `COALESCE(ordem_manual, senha)` como posição efetiva | Unifica ordenação manual e ordem de chegada |
| Enviar gestante/criança de colo como prioridade, sem relatório separado | Atende a regra de atendimento sem criar categoria analítica indevida |
| Manter PCD separado nos relatórios | Preserva recorte institucional já existente |
| Validar `pg_get_functiondef` após migration | Confirma que o banco remoto recebeu a lógica correta |
| Testar Edge Functions pelo `/supabase-api/` | Valida o caminho real usado pela aplicação na rede institucional |
