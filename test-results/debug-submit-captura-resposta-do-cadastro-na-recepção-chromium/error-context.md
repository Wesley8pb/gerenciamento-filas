# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: debug-submit.spec.ts >> captura resposta do cadastro na recepção
- Location: tests\e2e\debug-submit.spec.ts:25:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForResponse: Test timeout of 30000ms exceeded.
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
      - heading "Recepção" [level=1] [ref=e58]
      - paragraph [ref=e59]: Cadastro de eleitores na fila
      - paragraph [ref=e60]: terça-feira, 07 de abril de 2026
    - generic [ref=e61]:
      - generic [ref=e63]:
        - generic [ref=e64]:
          - paragraph [ref=e65]: Total na Fila
          - paragraph [ref=e66]: "0"
        - img [ref=e67]
      - generic [ref=e73]:
        - generic [ref=e74]:
          - paragraph [ref=e75]: Prioritários
          - paragraph [ref=e76]: "0"
        - img [ref=e77]
      - generic [ref=e81]:
        - generic [ref=e82]:
          - paragraph [ref=e83]: Normais
          - paragraph [ref=e84]: "0"
        - img [ref=e85]
      - generic [ref=e90]:
        - generic [ref=e91]:
          - generic [ref=e92]:
            - paragraph [ref=e93]: Vagas Restantes
            - paragraph [ref=e94]: "50"
          - img [ref=e95]
        - paragraph [ref=e97]: "Limite: 50"
    - generic [ref=e98]:
      - generic [ref=e99]:
        - heading "Cadastrar Eleitor" [level=2] [ref=e100]:
          - img [ref=e101]
          - text: Cadastrar Eleitor
        - generic [ref=e104]:
          - generic [ref=e105]:
            - generic [ref=e106]: Nome Completo *
            - textbox "Digite o nome completo" [ref=e107]: "[E2E] Eleitor 1775577986432"
          - generic [ref=e108]:
            - generic [ref=e109]: Data de Nascimento *
            - textbox [ref=e110]: 1985-01-15
            - paragraph [ref=e111]: "Idade: 41 anos"
          - generic [ref=e112]:
            - checkbox "Pessoa com Deficiência (PCD)" [ref=e113]
            - generic [ref=e114]:
              - img [ref=e115]
              - text: Pessoa com Deficiência (PCD)
          - paragraph [ref=e122]: "Entrará na fila: Normal"
          - button "Cadastrar e Gerar Senha" [active] [ref=e123]:
            - img [ref=e124]
            - generic [ref=e127]: Cadastrar e Gerar Senha
      - generic [ref=e128]:
        - heading "Informações" [level=3] [ref=e129]
        - list [ref=e130]:
          - listitem [ref=e131]: • Idosos (60 anos ou mais) têm direito à fila prioritária
          - listitem [ref=e132]: • Pessoas com Deficiência (PCD) também têm prioridade
          - listitem [ref=e133]: • A senha é gerada automaticamente
          - listitem [ref=e134]: • O cadastro é válido apenas para o dia atual
        - generic [ref=e135]:
          - heading "Regra de Prioridade" [level=4] [ref=e136]
          - paragraph [ref=e137]:
            - text: A fila prioritária é chamada na proporção de
            - strong [ref=e138]: 2 prioritários para 1 normal
            - text: ", garantindo agilidade no atendimento."
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
  22 |   expect({ status: response.status(), body }).toEqual({ status: 200, body })
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
> 33 |   const responsePromise = page.waitForResponse((response) => response.url().includes('/functions/v1/gerar-senha'))
     |                                ^ Error: page.waitForResponse: Test timeout of 30000ms exceeded.
  34 |   await page.getByRole('button', { name: 'Cadastrar e Gerar Senha' }).click()
  35 |   const response = await responsePromise
  36 |   const body = await response.text()
  37 | 
  38 |   expect({ status: response.status(), body }).toEqual({ status: 200, body })
  39 | })
  40 | 
```