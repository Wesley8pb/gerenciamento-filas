import { expect, test } from '@playwright/test'
import { loginAsAdmin } from './support/auth'
import { buildTestEmail, buildTestName } from './support/supabase'

test('captura resposta da criação de usuário', async ({ page }) => {
  const nome = buildTestName('Usuario')
  const email = buildTestEmail('usuario-e2e-debug')

  await loginAsAdmin(page)
  await page.goto('/admin/usuarios')
  await page.getByRole('button', { name: 'Novo Servidor' }).click()

  await page.getByRole('textbox').nth(0).fill(nome)
  await page.getByRole('textbox').nth(1).fill(email)
  await page.locator('input[type="password"]').nth(0).fill('Temp123!')

  const responsePromise = page.waitForResponse((response) => response.url().includes('/functions/v1/admin-criar-usuario'))
  await page.getByRole('button', { name: 'Criar' }).click()
  const response = await responsePromise
  const body = await response.text()

  expect({ status: response.status(), body }).toEqual({ status: 200, body })
})

test('captura resposta do cadastro na recepção', async ({ page }) => {
  const nome = buildTestName('Eleitor')

  await loginAsAdmin(page)
  await page.goto('/recepcao')
  await page.getByPlaceholder('Digite o nome completo').fill(nome)
  await page.locator('input[type="date"]').fill('1985-01-15')

  const responsePromise = page.waitForResponse((response) => response.url().includes('/functions/v1/gerar-senha'))
  await page.getByRole('button', { name: 'Cadastrar e Gerar Senha' }).click()
  const response = await responsePromise
  const body = await response.text()

  expect({ status: response.status(), body }).toEqual({ status: 200, body })
})
