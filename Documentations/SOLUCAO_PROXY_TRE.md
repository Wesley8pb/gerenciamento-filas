# Guia de Reversão — Proxy Reverso (TRE/PB)

Este documento registra a alteração feita para contornar o bloqueio de rede do TRE/PB e como revertê-la caso necessário.

## Motivo da Alteração
A rede institucional do TRE/PB bloqueia requisições diretas para domínios `*.supabase.co`. A solução aplicada cria um **Proxy Reverso** no Netlify, fazendo com que o navegador acesse o próprio domínio do sistema (permitido) e o Netlify repasse a requisição para o Supabase.

---

## Como Reverter para a Conexão Direta

Se você quiser voltar ao modo padrão (conexão direta do navegador ao Supabase), siga estes 2 passos:

### 1. Reverter `src/lib/supabase.ts`
Substitua o conteúdo do arquivo pelo código original abaixo:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export { supabaseUrl as SUPABASE_URL };
```

### 2. Remover o Redirecionamento no `netlify.toml`
No arquivo `netlify.toml`, remova o bloco de redirecionamento do `/supabase-api/*`. Ele deve voltar a ser apenas:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### 3. Ajustar Variáveis no Netlify (Importante!)
Se você alterou a variável `VITE_SUPABASE_URL` no painel do Netlify para apontar para `/supabase-api`, você deve voltá-la para a URL real do seu projeto (ex: `https://xxxx.supabase.co`).

---

**Data da Implementação:** 20/04/2026
**Autor:** Antigravity (AI)
