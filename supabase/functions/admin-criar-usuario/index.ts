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
      throw new Error('Apenas administradores podem criar usuários.')
    }

    const params = await req.json()
    const { nome, email, senha } = params

    if (!nome || !email || !senha) {
      throw new Error('Campos obrigatórios: nome, email, senha')
    }

    if (senha.length < 6) {
      throw new Error('A senha deve ter pelo menos 6 caracteres')
    }

    // Criar usuário usando a Service Role Key (segura no servidor)
    const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome }
    })

    if (createError) {
      throw new Error(createError.message || 'Erro ao criar usuário')
    }

    // Inserir perfil (fallback caso o trigger não funcione)
    if (newUser.user) {
      const { error: profileError } = await supabaseClient.from('profiles').insert({
        id: newUser.user.id,
        email,
        nome,
        perfil: 'atendente',
        ativo: true,
        primeiro_acesso: true,
      })

      if (profileError) {
        console.error('Falha ao inserir profile, mas auth user foi criado:', profileError)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      usuario: {
        id: newUser.user!.id,
        nome,
        email,
      },
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
