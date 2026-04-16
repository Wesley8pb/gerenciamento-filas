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
    // Validação JWT
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

    const params = await req.json()
    const { dia_atendimento, nome, data_nascimento, pcd, servidor_cadastro_id } = params

    if (!dia_atendimento || !nome || !data_nascimento) {
      throw new Error('Campos obrigatórios: dia_atendimento, nome, data_nascimento')
    }

    // Usar RPC atômica para gerar senha (mesmo fluxo do presencial, mas tipo=agendado)
    const { data: result, error: rpcError } = await supabaseClient
      .rpc('gerar_senha_atomica', {
        p_dia_atendimento: dia_atendimento,
        p_nome: nome,
        p_data_nascimento: data_nascimento,
        p_pcd: pcd || false,
        p_prioritario: false, // Ignorado — RPC calcula baseado em data_nascimento
        p_servidor_cadastro_id: servidor_cadastro_id || user.id,
        p_tipo: 'agendado',
      })

    if (rpcError) {
      throw new Error(rpcError.message)
    }

    // Buscar eleitor completo
    const { data: eleitor } = await supabaseClient
      .from('eleitores_fila')
      .select('*')
      .eq('id', result.eleitor_id)
      .single()

    return new Response(JSON.stringify({
      success: true,
      eleitor: eleitor || { id: result.eleitor_id },
      senha: result.senha,
      fila: result.fila,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    const status = error.message?.includes('Não autorizado') ? 401 : 400
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    })
  }
})
