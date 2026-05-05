# Sistema de Gerenciamento de Filas — 56ª ZE

Sistema desenvolvido para realizar o controle de filas, agendamentos e atendimentos presenciais na 56ª Zona Eleitoral (Juazeirinho/PB). O software otimiza o fluxo de eleitores no cartório, prioriza atendimentos por lei e fornece relatórios e estatísticas em tempo real.

---

## 🛠️ Tecnologias Utilizadas

Este projeto foi construído com ferramentas modernas para garantir alta performance e escalabilidade:

### Frontend
- **[React 19](https://react.dev/)** + **[TypeScript](https://www.typescriptlang.org/)**
- **[Vite](https://vitejs.dev/)** — Build tool ultra rápida
- **[Tailwind CSS v4](https://tailwindcss.com/)** — Estilização moderna e utilitária
- **[React Router DOM](https://reactrouter.com/)** — Navegação de rotas
- **[Zustand](https://zustand-demo.pmnd.rs/)** — Gerenciamento global de estado (Autenticação/Usuário)
- **[React Query / TanStack](https://tanstack.com/query/latest)** — Gerenciamento assíncrono e cache de dados
- **[Lucide React](https://lucide.dev/)** — Biblioteca de ícones
- **[Recharts](https://recharts.org/)** — Gráficos e estatísticas estatísticas
- **[jsPDF](https://parall.ax/products/jspdf) & [SheetJS (xlsx)](https://sheetjs.com/)** — Exportação de relatórios

### Backend e Banco de Dados (BaaS)
- **[Supabase](https://supabase.com/)** — PostgREST, Autenticação e Row Level Security (RLS)

---

## ⚙️ Perfis de Acesso

O sistema conta com dois níveis principais de acesso (RBAC - Role Based Access Control):

* **👩‍💻 Atendente**: Pode acessar a Recepção (cadastrar eleitores na fila), tela de Atendimento (chamar e finalizar senhas), Agendamentos e Relatórios.
* **🛡️ Administrador (Admin)**: Tem acesso a todas as funções do Atendente, além do painel de **Gestão do Sistema** (criação e desativação de servidores/usuários, redefinição de senhas, travas de calendário e configurações de prioridade).

---

## 🚀 Como Rodar Localmente

### 1. Clonar o repositório
```bash
git clone https://github.com/SEU-USUARIO/sistema-fila-eleitoral.git
cd sistema-fila-eleitoral
```

### 2. Instalar as dependências
```bash
npm install
```

### 3. Configurar as Variáveis de Ambiente
Crie um arquivo chamado `.env` na raiz do projeto usando o `.env.example` como base. No frontend, apenas estas variáveis públicas do Supabase são obrigatórias:
```env
VITE_SUPABASE_URL=sua-url-aqui
VITE_SUPABASE_ANON_KEY=sua-anon-key-aqui
```

A `SERVICE_ROLE_KEY` não deve ser exposta no frontend nem publicada como `VITE_`. Se alguma rotina server-side precisar dela, configure-a apenas no ambiente privado correspondente.

### 4. Iniciar o servidor de desenvolvimento
```bash
npm run dev
```
Acesse a URL informada pelo terminal (provavelmente `http://localhost:5173`).

---

## 📋 Regras de Atendimento e Prioridade

### Fila de atendimento
- A chamada prioriza a fila `prioritaria` antes da fila `normal`.
- Eleitores com 80 anos ou mais são chamados antes das demais prioridades.
- Dentro da fila normal, a posição efetiva usa `ordem_manual` quando existir; caso contrário, usa `senha`.
- Ao marcar um eleitor como ausente, ele permanece com `status = 'ausente'` até resgate manual.
- Ao resgatar um ausente, a RPC `registrar_retorno_atomico` devolve o eleitor para `fila = 'normal'`, no fim da fila normal existente naquele momento.
- A fila `retorno` pode continuar existindo por compatibilidade histórica, mas não é mais usada pelo novo resgate manual de ausentes.

### Critérios de prioridade
- A prioridade é calculada no backend pela RPC `gerar_senha_atomica`.
- Entram como prioritários: idade de 60 anos ou mais, PCD ou marcação "Gestante/criança de colo".
- A marcação "Gestante/criança de colo" existe apenas na Recepção.
- O fluxo de Agendamento não mostra essa opção e envia o campo como `false`.
- Nos relatórios, "Gestante/criança de colo" aparece apenas dentro do grupo geral `Prioritário`.
- PCD continua separado nos relatórios, com filtro, resumo e indicação nominal próprios.

### Fonte de verdade
- `gerar_senha_atomica` define senha, fila e prioridade de forma atômica.
- `registrar_retorno_atomico` controla o resgate de ausentes e o reposicionamento na fila normal.
- `chamar_proximo_atomico` decide a próxima chamada respeitando 80+, prioridades gerais e posição efetiva.

---

## 🗄️ Configuração do Backend (Supabase)

Para que o sistema funcione corretamente em um novo projeto do Supabase, você precisa configurar o banco de dados e as Edge Functions:

### 1. Banco de Dados (SQL)
No painel do Supabase, vá em **SQL Editor** e execute o conteúdo do arquivo:
*   [`supabase/migrations/20260329120000_schema.sql`](./supabase/migrations/20260329120000_schema.sql) — Cria as tabelas, RLS e triggers.
*   [`supabase/seed.sql`](./supabase/seed.sql) — Popula o calendário de dias ativos de 20/04 a 06/05 (Período 1) e 07/05 a 20/05 (Período 2).

### 2. Edge Functions
Este sistema utiliza lógica server-side para garantir fila atômica, agendamento, CORS e rotinas administrativas. Usando a [Supabase CLI](https://supabase.com/docs/guides/cli):
```bash
supabase functions deploy gerar-senha --no-verify-jwt --use-api
supabase functions deploy chamar-proximo --no-verify-jwt --use-api
supabase functions deploy agendar-eleitor --no-verify-jwt --use-api
supabase functions deploy check-agendamento-liberado --no-verify-jwt --use-api
supabase functions deploy admin-criar-usuario --no-verify-jwt --use-api
supabase functions deploy admin-resetar-senha --no-verify-jwt --use-api
```

As funções que exigem autenticação fazem validação interna do token e do perfil do usuário. O `--no-verify-jwt` evita bloqueio pelo gateway antes do tratamento de CORS e antes da validação própria da função.

Configure `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` apenas no painel de Segredos das Functions no console do Supabase. Nunca publique `SERVICE_ROLE_KEY` no frontend nem em variáveis `VITE_`.

### 3. Autenticação Inicial
Crie o primeiro usuário administrador manualmente no painel **Authentication > Users** do Supabase. Após criar, vá na tabela `profiles` e altere o campo `perfil` para `admin`.

---

## 📦 Deploy
O sistema está preparado para deploy do frontend na Netlify como SPA (*Single Page Application*). Consulte o guia atualizado em [docs/DEPLOY_NETLIFY.md](./docs/DEPLOY_NETLIFY.md) para os passos reais de publicação, variáveis de ambiente obrigatórias e dependências de domínio/CORS com o Supabase.

---

## 📄 Estrutura de Arquivos
* `src/components/` - Componentes modulares e isolados da interface
* `src/pages/` - Rotas completas para cada tela, listadas no `App.tsx`
* `src/lib/` - Conexões cruciais do sistema (ex: `supabase.ts`)
* `src/store/` - Zustand stores (Estado de autenticação e variáveis globais em uso)
* `src/services/` - Toda regra de negócio (API REST wrappers enviando CRUDs ao Supabase)
* `src/types/` - Central de interfaces TypeScripts

---

**Desenvolvido por Wesley Brito para a 56ª ZE da Paraíba.**
