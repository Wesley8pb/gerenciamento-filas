# Guia de Deploy na Netlify

Este guia explica como fazer o deploy (publicação) do **Sistema de Gerenciamento de Filas — 56ª ZE** utilizando a Netlify, que é a plataforma ideal para aplicações Frontend feitas com Vite e React.

---

## 💡 Pré-requisitos

1.  Ter uma conta gratuita na [Netlify](https://www.netlify.com/).
2.  Ter o código do projeto hospedado no seu [GitHub](https://github.com/), [GitLab](https://gitlab.com/) ou [Bitbucket](https://bitbucket.org/).
3.  Saber as chaves/variáveis do seu Supabase (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, e `VITE_SUPABASE_SERVICE_ROLE_KEY`).

---

## 🚀 Passo a Passo do Deploy

### 1. Criar novo site na Netlify
1. Entre no painel principal (Dashboard) da Netlify.
2. Clique no botão **`Add new site`** > **`Import an existing project`**.
3. Selecione o provedor onde o seu código está hospedado (ex: GitHub).
4. Autorize a Netlify a acessar sua conta e escolha o repositório do `sistema-fila-eleitoral`.

### 2. Configurações de Build

O projeto **já possui** um arquivo `netlify.toml` que instrui automaticamente a plataforma a usar as melhores configurações para o Vite e React Router. No entanto, na tela a seguir os campos deverão ser iguais a esses:

*   **Base directory**: *(deixe em branco)*
*   **Build command**: `npm run build`
*   **Publish directory**: `dist`

### 3. Configurar as Variáveis de Ambiente (MUITO IMPORTANTE)

Como nós não enviamos o arquivo `.env` para o Git por questões de segurança (ele está no `.gitignore`), a Netlify não conhece as senhas do seu servidor até você informar a ela manualmente no painel:

Na mesma tela em que está confirmando as configurações de Build (passo 2), clique em **`Add environment variables`** e insira as seguintes chaves que você possui localmente:

| Key | Value (Copie do seu .env) |
| :--- | :--- |
| `VITE_SUPABASE_URL` | *https://ifndiz....supabase.co* |
| `VITE_SUPABASE_ANON_KEY` | *eyJhbGc...* |
| `VITE_SUPABASE_SERVICE_ROLE_KEY` | *eyJhbGc...* |

### 4. Publicar
1. Clique em **`Deploy site`**.
2. Aguarde alguns instantes (geralmente entre 30s e 2 minutos).
3. A Netlify mostrará a mensagem *Site is live*.
4. A plataforma gerará uma URL aleatória temporária para acessar (ex: `https://magnificent-peony-39cf72.netlify.app`). 

---

## 🔧 Pós-Deploy

### 1. Alterar o nome de domínio
Para colocar um nome mais bonito como `sistema-fila-56ze.netlify.app`:
1.  Vá até **Site configuration** no painel da Netlify.
2.  Desça até a aba **Domain management**, em **Domains**.
3.  Clique em **Options** > **Edit site name**, digite o nome que escolher e salve.

### 2. Atualizar URL no Supabase (Site URL e Redirecionamentos)
Como você acabou de colocar a aplicação em um endereço novo da internet, é **obrigatório** avisar ao servidor Supabase que ele é real para a segurança de Login não bloquear acessos externos via "CORS":

1.  Abra seu painel administrativo no [Supabase](https://supabase.com).
2.  Vá para a seção **Authentication** na barra lateral.
3.  Em seguida vá até **URL Configuration** (Authentication > Configuration).
4.  No campo **Site URL**, coloque o novo endereço exato da aplicação Netlify gerada: `https://[seu-novo-site].netlify.app`.
5.  Em **Redirect URLs**, certifique de também adicionar a nova URL (a depender dos cenários de senha esquecida/confirmação).

> **Atenção:** Sem o passo do Site URL no Supabase, o Login retornará um erro aos usuários por proteção de Cross-Origin.

---

## 🔁 Atualizações Automáticas (Continuous Deployment)

Com a integração ao GitHub, você nunca mais precisará clicar para dar Deploy. **Toda vez que você der um _git push_ ou enviar novas versões do código para a branch `main` no GitHub, a Netlify detectará a mudança e lançará a atualização em produção automaticamente em 1-2 minutos!** Se uma versão quebrar, você consegue realizar rollbacks (voltar 1 versão atrás) no próprio site com 1 clique.
