import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validação JWT — verificar se é admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Token de autorização não fornecido.')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      throw new Error('Não autorizado. Token inválido ou expirado.')
    }

    // Verificar se é admin
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('perfil')
      .eq('id', user.id)
      .single()

    if (!profile || profile.perfil !== 'admin') {
      throw new Error('Apenas administradores podem resetar senhas.')
    }

    const params = await req.json()
    const { userId, novaSenha } = params

    if (!userId || !novaSenha) {
      throw new Error('Campos obrigatórios: userId, novaSenha')
    }

    if (novaSenha.length < 6) {
      throw new Error('A senha deve ter pelo menos 6 caracteres')
    }

    // Resetar senha usando Service Role Key (segura no servidor)
    const { error: updateError } = await supabaseClient.auth.admin.updateUserById(userId, {
      password: novaSenha,
    })

    if (updateError) {
      throw new Error(updateError.message || 'Erro ao resetar senha')
    }

    // Marcar como primeiro acesso para forçar troca
    await supabaseClient.from('profiles').update({
      primeiro_acesso: true,
    }).eq('id', userId)

    return new Response(JSON.stringify({
      success: true,
      message: 'Senha resetada com sucesso',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    const status = error.message?.includes('Não autorizado') || error.message?.includes('Apenas administradores')
      ? 403 : 400
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    })
  }
})
