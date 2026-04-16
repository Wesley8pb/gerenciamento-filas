import { expect, type Page } from '@playwright/test'
import { getAuthConfig } from './env'

export async function loginAsAdmin(page: Page): Promise<void> {
  const authConfig = getAuthConfig()

  await page.goto('/login')
  await page.getByLabel('E-mail').fill(authConfig.adminEmail)
  await page.getByLabel('Senha').fill(authConfig.adminPassword)
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page).not.toHaveURL(/\/login$/)
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
  await expect(page.getByText('Wesley Wagner de Brito Silva')).toBeVisible()
}
