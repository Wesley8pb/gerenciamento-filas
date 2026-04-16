# E2E com Playwright

Os testes E2E usam o ambiente Supabase/dev real e fazem cleanup explícito apenas dos dados criados pela suíte.

## Variáveis obrigatórias

Defina estas variáveis no shell antes de rodar:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`
- `E2E_SUPABASE_SERVICE_ROLE_KEY`

## Execução

```bash
npm run test:e2e
```

## Cobertura inicial

- login administrativo
- criação de usuário
- reset de senha
- cadastro de eleitor na recepção
- chamada e finalização no atendimento
