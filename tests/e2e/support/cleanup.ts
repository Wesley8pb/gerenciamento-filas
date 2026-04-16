import { getSupabaseAdmin } from './supabase'

export async function cleanupUserByEmail(email: string): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin()

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (!profile?.id) {
    return
  }

  await supabaseAdmin
    .from('log_acoes')
    .delete()
    .eq('servidor_id', profile.id)

  await supabaseAdmin
    .from('profiles')
    .delete()
    .eq('id', profile.id)

  await supabaseAdmin.auth.admin.deleteUser(profile.id)
}

export async function cleanupQueueEntriesByName(name: string): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin()

  const { data: entries } = await supabaseAdmin
    .from('eleitores_fila')
    .select('id')
    .eq('nome', name)

  if (!entries?.length) {
    return
  }

  const ids = entries.map((entry) => entry.id)

  await supabaseAdmin
    .from('log_acoes')
    .delete()
    .in('eleitor_id', ids)

  await supabaseAdmin
    .from('eleitores_fila')
    .delete()
    .in('id', ids)
}
