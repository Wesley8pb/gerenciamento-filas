import { expect, test } from '@playwright/test'
import { loginAsAdmin } from './support/auth'
import { cleanupQueueEntriesByName } from './support/cleanup'
import { buildTestName } from './support/supabase'

test.describe('fluxo principal da fila', () => {
  test('admin cadastra eleitor na recepção, chama no atendimento e registra no histórico', async ({ page }) => {
    const nome = buildTestName('Eleitor')
    const dataNascimento = '1985-01-15'

    await cleanupQueueEntriesByName(nome)

    try {
      await loginAsAdmin(page)
      await page.goto('/recepcao')

      await expect(page.getByRole('heading', { name: 'Recepção' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Cadastrar e Gerar Senha' })).toBeVisible()

      const nomeInput = page.getByPlaceholder('Digite o nome completo')
      const dataInput = page.locator('input[type="date"]')

      await expect(nomeInput).toBeVisible()
      await nomeInput.fill(nome)
      await dataInput.fill(dataNascimento)
      await page.getByRole('button', { name: 'Cadastrar e Gerar Senha' }).click()

      await expect(page.getByRole('heading', { name: 'Cadastro Realizado!' })).toBeVisible()
      await expect(page.getByText(nome)).toBeVisible()
      await page.getByRole('button', { name: 'Novo Cadastro' }).click()

      await page.goto('/atendimento')
      await expect(page.getByRole('heading', { name: 'Atendimento' })).toBeVisible()

      await expect(page.getByText(nome)).toBeVisible()
      await page.getByRole('button', { name: 'Chamar Próximo' }).click()

      await expect(page.getByRole('heading', { name: 'Eleitor Chamado' })).toBeVisible()
      await expect(page.getByText(nome)).toBeVisible()

      await page.getByRole('button', { name: 'Atendido' }).click()
      await expect(page.getByText('Atendimento finalizado!')).toBeVisible()

      const historico = page.locator('div', { hasText: 'Últimos Atendidos' })
      await expect(historico.getByText(nome)).toBeVisible()
      await expect(historico.getByText('Atendido')).toBeVisible()
    } finally {
      await cleanupQueueEntriesByName(nome)
    }
  })
})
