import { expect, test } from '@playwright/test'

test('login admin retorna requests auth/profile sem falha de rede', async ({ page }) => {
  const requests: Array<{ url: string; status: number | null; error?: string }> = []

  page.on('response', (response) => {
    const url = response.url()
    if (url.includes('supabase.co')) {
      requests.push({ url, status: response.status() })
    }
  })

  page.on('requestfailed', (request) => {
    const url = request.url()
    if (url.includes('supabase.co')) {
      requests.push({ url, status: null, error: request.failure()?.errorText })
    }
  })

  await page.goto('/login')
  await page.getByLabel('E-mail').fill(process.env.E2E_ADMIN_EMAIL!)
  await page.getByLabel('Senha').fill(process.env.E2E_ADMIN_PASSWORD!)
  await page.getByRole('button', { name: 'Entrar' }).click()

  await page.waitForTimeout(5000)

  const failedRequests = requests.filter((request) => request.status === null)
  expect(failedRequests).toEqual([])
})
