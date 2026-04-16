import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdminConfig } from './env'

export function getSupabaseAdmin() {
  const supabaseConfig = getSupabaseAdminConfig()

  return createClient(supabaseConfig.supabaseUrl, supabaseConfig.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export function buildTestEmail(prefix: string): string {
  const timestamp = Date.now()
  return `${prefix}.${timestamp}@example.com`
}

export function buildTestName(prefix: string): string {
  return `[E2E] ${prefix} ${Date.now()}`
}
