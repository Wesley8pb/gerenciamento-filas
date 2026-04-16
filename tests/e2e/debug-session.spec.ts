import { expect, test } from '@playwright/test'
import { loginAsAdmin } from './support/auth'

test('captura sessão após login admin', async ({ page }) => {
  await loginAsAdmin(page)

  const session = await page.evaluate(() => {
    const raw = localStorage.getItem('sb-ifndiztgonndotoleefo-auth-token')
    return raw ? JSON.parse(raw) : null
  })

  expect(session?.access_token).toBeTruthy()
})
