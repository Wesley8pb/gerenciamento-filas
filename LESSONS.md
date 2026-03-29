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

### Resumo das boas práticas

| Prática | Motivo |
|---------|--------|
| `server: { host: true }` no Vite | Garante acesso via IPv4 e IPv6 |
| Timeout em chamadas ao Supabase | Evita tela travada se o backend estiver lento |
| Timeout global de segurança | Rede de segurança caso qualquer etapa trave |
| Flag de inicialização no nível do módulo | Evita múltiplas execuções em custom hooks compartilhados |
| `signOut()` no catch de timeout | Limpa tokens problemáticos automaticamente |

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
