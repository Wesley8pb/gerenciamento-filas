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
Crie um arquivo chamado `.env` na raiz do projeto (como o `.env.example`) com as três variáveis do Supabase, incluindo a Service Role Key para viabilizar as permissões automáticas do painel de Administrador local.
```env
VITE_SUPABASE_URL=sua-url-aqui
VITE_SUPABASE_ANON_KEY=sua-anon-key-aqui
VITE_SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key-aqui
```

### 4. Iniciar o servidor de testes
```bash
npm run dev
```
Acesse a URL informada pelo terminal (provavelmente `http://localhost:5173`).

---

## 📦 Deploy
O sistema foi configurado estruturalmente para ser hospedado nas arquiteturas focadas em frontend, via infraestrutura SPA (*Single Page Application*). Consulte a página [Guia de Deploy na Netlify](./docs/DEPLOY_NETLIFY.md) (ou `DEPLOY_NETLIFY.md`) para consultar os passos originais de publicação e como configurar os testes de CORS nativos do Supabase em produção.

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
