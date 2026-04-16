export function getRequiredEnv(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Variável obrigatória ausente para E2E: ${name}`)
  }

  return value
}

export function getAuthConfig() {
  return {
    adminEmail: getRequiredEnv('E2E_ADMIN_EMAIL'),
    adminPassword: getRequiredEnv('E2E_ADMIN_PASSWORD'),
  }
}

export function getSupabaseAdminConfig() {
  return {
    supabaseUrl: getRequiredEnv('VITE_SUPABASE_URL'),
    serviceRoleKey: getRequiredEnv('E2E_SUPABASE_SERVICE_ROLE_KEY'),
  }
}
