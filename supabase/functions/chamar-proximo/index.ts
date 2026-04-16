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
    // ===== VALIDAÇÃO JWT (Correção Crítica #8) =====
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Token de autorização não fornecido.')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verificar se o token JWT é válido
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      throw new Error('Não autorizado. Token inválido ou expirado.')
    }

    const params = await req.json()
    const { dia_atendimento, servidor_id } = params

    if (!dia_atendimento) {
      throw new Error('Campo obrigatório: dia_atendimento')
    }

    // ===== USAR RPC ATÔMICA (Correção Crítica #5) =====
    // A RPC chamar_proximo_atomico:
    //   - Resolve race condition com FOR UPDATE
    //   - Usa FOR UPDATE SKIP LOCKED para evitar conflito entre atendentes
    const { data: result, error: rpcError } = await supabaseClient
      .rpc('chamar_proximo_atomico', {
        p_dia_atendimento: dia_atendimento,
        p_servidor_id: servidor_id || user.id,
      })

    if (rpcError) {
      throw new Error(rpcError.message)
    }

    return new Response(JSON.stringify({
      success: true,
      eleitor: result.eleitor,
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
