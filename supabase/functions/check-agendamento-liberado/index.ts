import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Data e hora de liberação do agendamento (configurável)
const DATA_LIBERACAO = '2026-05-06T18:00:00-03:00'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validação JWT — alinhada às demais Edge Functions
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

    // Usar timestamp do servidor (evita manipulação do cliente)
    const agora = new Date()
    const liberacao = new Date(DATA_LIBERACAO)

    if (agora >= liberacao) {
      return new Response(JSON.stringify({
        liberado: true,
        motivo: 'Agendamento liberado para o Período 2.',
        abre_em: null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Calcular tempo restante
    const diffMs = liberacao.getTime() - agora.getTime()
    const totalSegundos = Math.floor(diffMs / 1000)
    const dias = Math.floor(totalSegundos / 86400)
    const horas = Math.floor((totalSegundos % 86400) / 3600)
    const minutos = Math.floor((totalSegundos % 3600) / 60)
    const segundos = totalSegundos % 60

    return new Response(JSON.stringify({
      liberado: false,
      motivo: `O agendamento será liberado em ${liberacao.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} às ${liberacao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}.`,
      abre_em: {
        total_segundos: totalSegundos,
        dias,
        horas,
        minutos,
        segundos,
        timestamp: liberacao.toISOString(),
      },
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
