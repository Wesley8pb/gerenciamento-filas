import { expect, test } from '@playwright/test'

test('browser consegue alcançar endpoint de health do Supabase', async ({ page }) => {
  await page.goto('/login')

  const anonKey = process.env.VITE_SUPABASE_ANON_KEY!

  const result = await page.evaluate(async (key) => {
    try {
      const response = await fetch('https://ifndiztgonndotoleefo.supabase.co/auth/v1/health', {
        headers: {
          apikey: key,
        },
      })

      return {
        ok: response.ok,
        status: response.status,
        text: await response.text(),
      }
    } catch (error) {
      return {
        ok: false,
        status: -1,
        text: error instanceof Error ? error.message : String(error),
      }
    }
  }, anonKey)

  expect(result.status).toBe(200)
})
