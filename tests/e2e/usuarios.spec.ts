import { expect, test } from '@playwright/test'
import { loginAsAdmin } from './support/auth'
import { cleanupUserByEmail } from './support/cleanup'
import { buildTestEmail, buildTestName } from './support/supabase'

test.describe('gestão de usuários', () => {
  test('admin cria usuário e reseta senha exigindo troca no primeiro login', async ({ browser, page }) => {
    const nome = buildTestName('Usuario')
    const email = buildTestEmail('usuario-e2e')
    const senhaInicial = 'Temp123!'
    const novaSenha = 'Nova123!'
    let userContext

    await cleanupUserByEmail(email)

    try {
      await loginAsAdmin(page)
      await page.goto('/admin/usuarios')

      await expect(page.getByRole('heading', { name: 'Gestão de Usuários' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Novo Servidor' })).toBeVisible()

      await page.getByRole('button', { name: 'Novo Servidor' }).click()
      await expect(page.getByRole('heading', { name: 'Novo Servidor' })).toBeVisible()

      const nomeInput = page.getByRole('textbox').nth(0)
      const emailInput = page.getByRole('textbox').nth(1)
      const senhaInput = page.locator('input[type="password"]').nth(0)

      await expect(nomeInput).toBeVisible()
      await nomeInput.fill(nome)
      await emailInput.fill(email)
      await senhaInput.fill(senhaInicial)
      await page.getByRole('button', { name: 'Criar' }).click()

      await expect(page.getByText('Servidor criado com sucesso!')).toBeVisible()
      await expect(page.getByText(nome)).toBeVisible()
      await expect(page.getByText(email)).toBeVisible()
      await expect(page.getByText('Aguardando troca de senha')).toBeVisible()

      const row = page.locator('tr', { hasText: email })
      await row.getByTitle('Resetar Senha').click()
      const novaSenhaInput = page.locator('input[type="password"]').nth(0)
      await expect(novaSenhaInput).toBeVisible()
      await novaSenhaInput.fill(novaSenha)
      await page.getByRole('button', { name: 'Resetar Senha' }).click()

      await expect(page.getByText('Senha redefinida com sucesso!')).toBeVisible()
      await expect(page.getByText('Aguardando troca de senha')).toBeVisible()

      userContext = await browser.newContext()
      const userPage = await userContext.newPage()

      await userPage.goto('/login')
      await userPage.getByLabel('E-mail').fill(email)
      await userPage.getByLabel('Senha').fill(novaSenha)
      await userPage.getByRole('button', { name: 'Entrar' }).click()

      await expect(userPage).toHaveURL(/\/trocar-senha$/)
      await expect(userPage.getByRole('heading', { name: 'Trocar Senha' })).toBeVisible()
    } finally {
      await userContext?.close()
      await cleanupUserByEmail(email)
    }
  })
})
