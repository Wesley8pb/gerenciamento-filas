# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: debug-submit.spec.ts >> captura resposta da criação de usuário
- Location: tests\e2e\debug-submit.spec.ts:5:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 1

  Object {
    "body": "{\"code\":401,\"message\":\"Invalid JWT\"}",
-   "status": 200,
+   "status": 401,
  }
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [ref=e6]:
      - generic [ref=e7]:
        - img "Logo" [ref=e8]
        - generic [ref=e9]: 56ª ZE
        - generic [ref=e10]:
          - heading "Sistema de Gerenciamento de Filas" [level=1] [ref=e11]
          - paragraph [ref=e12]: Juazeirinho/PB
      - generic [ref=e13]:
        - generic [ref=e14]:
          - paragraph [ref=e15]: Wesley Wagner de Brito Silva
          - paragraph [ref=e16]: admin
        - button "Sair" [ref=e17]:
          - img [ref=e18]
          - generic [ref=e21]: Sair
  - navigation [ref=e22]:
    - generic [ref=e24]:
      - link "Administração" [ref=e25] [cursor=pointer]:
        - /url: /admin
        - img [ref=e26]
        - generic [ref=e29]: Administração
      - link "Usuários" [ref=e30] [cursor=pointer]:
        - /url: /admin/usuarios
        - img [ref=e31]
        - generic [ref=e36]: Usuários
      - link "Recepção" [ref=e37] [cursor=pointer]:
        - /url: /recepcao
        - img [ref=e38]
        - generic [ref=e41]: Recepção
      - link "Atendimento" [ref=e42] [cursor=pointer]:
        - /url: /atendimento
        - img [ref=e43]
        - generic [ref=e46]: Atendimento
      - link "Agendamento" [ref=e47] [cursor=pointer]:
        - /url: /agendamento
        - img [ref=e48]
        - generic [ref=e50]: Agendamento
      - link "Relatórios" [ref=e51] [cursor=pointer]:
        - /url: /relatorios
        - img [ref=e52]
        - generic [ref=e55]: Relatórios
  - main [ref=e56]:
    - generic [ref=e57]:
      - generic [ref=e58]:
        - heading "Gestão de Usuários" [level=1] [ref=e59]
        - paragraph [ref=e60]: Gerencie os servidores do cartório
      - button "Novo Servidor" [ref=e61]:
        - img [ref=e62]
        - generic [ref=e63]: Novo Servidor
    - table [ref=e65]:
      - rowgroup [ref=e66]:
        - row "Nome E-mail Perfil Status Ações" [ref=e67]:
          - columnheader "Nome" [ref=e68]
          - columnheader "E-mail" [ref=e69]
          - columnheader "Perfil" [ref=e70]
          - columnheader "Status" [ref=e71]
          - columnheader "Ações" [ref=e72]
      - rowgroup [ref=e73]:
        - row "Wesley Wagner de Brito Silva wesley8pb@gmail.com Atendente Ativo" [ref=e74]:
          - cell "Wesley Wagner de Brito Silva" [ref=e75]:
            - generic [ref=e77]: Wesley Wagner de Brito Silva
          - cell "wesley8pb@gmail.com" [ref=e78]
          - cell "Atendente" [ref=e79]
          - cell "Ativo" [ref=e80]
          - cell [ref=e81]:
            - generic [ref=e82]:
              - button "Editar" [ref=e83]:
                - img [ref=e84]
              - button "Resetar Senha" [ref=e87]:
                - img [ref=e88]
              - button "Desativar" [ref=e92]:
                - img [ref=e93]
        - row "Wesley Wagner de Brito Silva zon56juazeirinho@gmail.com Administrador Ativo" [ref=e98]:
          - cell "Wesley Wagner de Brito Silva" [ref=e99]:
            - generic [ref=e101]: Wesley Wagner de Brito Silva
          - cell "zon56juazeirinho@gmail.com" [ref=e102]
          - cell "Administrador" [ref=e103]
          - cell "Ativo" [ref=e104]
          - cell [ref=e105]
    - generic [ref=e107]:
      - heading "Novo Servidor" [level=2] [ref=e108]
      - generic [ref=e109]:
        - generic [ref=e110]:
          - generic [ref=e111]: Nome
          - textbox [ref=e112]: "[E2E] Usuario 1775577979118"
        - generic [ref=e113]:
          - generic [ref=e114]: E-mail
          - textbox [ref=e115]: usuario-e2e-debug.1775577979118@example.com
        - generic [ref=e116]:
          - generic [ref=e117]: Senha Provisória
          - textbox [ref=e118]: Temp123!
          - paragraph [ref=e119]: Mínimo 6 caracteres
        - paragraph [ref=e121]:
          - text: O servidor será criado como
          - strong [ref=e122]: Atendente
          - text: e deverá trocar a senha no primeiro login.
        - generic [ref=e123]:
          - img [ref=e124]
          - generic [ref=e126]: Edge Function returned a non-2xx status code
        - generic [ref=e127]:
          - button "Cancelar" [ref=e128]
          - button "Criar" [ref=e129]:
            - generic [ref=e130]: Criar
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test'
  2  | import { loginAsAdmin } from './support/auth'
  3  | import { buildTestEmail, buildTestName } from './support/supabase'
  4  | 
  5  | test('captura resposta da criação de usuário', async ({ page }) => {
  6  |   const nome = buildTestName('Usuario')
  7  |   const email = buildTestEmail('usuario-e2e-debug')
  8  | 
  9  |   await loginAsAdmin(page)
  10 |   await page.goto('/admin/usuarios')
  11 |   await page.getByRole('button', { name: 'Novo Servidor' }).click()
  12 | 
  13 |   await page.getByRole('textbox').nth(0).fill(nome)
  14 |   await page.getByRole('textbox').nth(1).fill(email)
  15 |   await page.locator('input[type="password"]').nth(0).fill('Temp123!')
  16 | 
  17 |   const responsePromise = page.waitForResponse((response) => response.url().includes('/functions/v1/admin-criar-usuario'))
  18 |   await page.getByRole('button', { name: 'Criar' }).click()
  19 |   const response = await responsePromise
  20 |   const body = await response.text()
  21 | 
> 22 |   expect({ status: response.status(), body }).toEqual({ status: 200, body })
     |                                               ^ Error: expect(received).toEqual(expected) // deep equality
  23 | })
  24 | 
  25 | test('captura resposta do cadastro na recepção', async ({ page }) => {
  26 |   const nome = buildTestName('Eleitor')
  27 | 
  28 |   await loginAsAdmin(page)
  29 |   await page.goto('/recepcao')
  30 |   await page.getByPlaceholder('Digite o nome completo').fill(nome)
  31 |   await page.locator('input[type="date"]').fill('1985-01-15')
  32 | 
  33 |   const responsePromise = page.waitForResponse((response) => response.url().includes('/functions/v1/gerar-senha'))
  34 |   await page.getByRole('button', { name: 'Cadastrar e Gerar Senha' }).click()
  35 |   const response = await responsePromise
  36 |   const body = await response.text()
  37 | 
  38 |   expect({ status: response.status(), body }).toEqual({ status: 200, body })
  39 | })
  40 | 
```