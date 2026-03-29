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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const params = await req.json()
    const { dia_atendimento, servidor_id } = params

    // 1. Buscar o estado do ciclo para o dia
    const { data: config, error: configError } = await supabaseClient
      .from('configuracao_dias')
      .select('ciclo_atual')
      .eq('data', dia_atendimento)
      .single()

    if (configError || !config) throw new Error("Configuração do dia não encontrada")
    
    let ciclo = config.ciclo_atual || 0
    let proximoEleitor = null

    // Função de auxílio para buscar o próximo de uma fila
    const fetchDaFila = async (tipofila: string) => {
      const { data, error } = await supabaseClient
        .from('eleitores_fila')
        .select('*')
        .eq('dia_atendimento', dia_atendimento)
        .eq('status', 'aguardando')
        .eq('fila', tipofila)
        .order('senha', { ascending: true }) // No caso de retorno, talvez precise de ordem de retorno
        .limit(1)
        .maybeSingle()
      
      if (error) throw error
      return data
    }

    // Lógica do Ciclo 2P : 1N : 1R
    // 0: P1, 1: P2, 2: N1, 3: R1
    
    for (let attempts = 0; attempts < 4; attempts++) {
      if (ciclo === 0 || ciclo === 1) {
        proximoEleitor = await fetchDaFila('prioritaria')
        if (proximoEleitor) {
          ciclo = ciclo + 1
          break
        } else {
          // Se não tem prioritário, pula para o ciclo Normal
          ciclo = 2
        }
      }

      if (ciclo === 2) {
        proximoEleitor = await fetchDaFila('normal')
        if (proximoEleitor) {
          ciclo = 3
          break
        } else {
          // Se não tem normal, pula para o ciclo Retorno
          ciclo = 3
        }
      }

      if (ciclo === 3) {
        proximoEleitor = await fetchDaFila('retorno')
        if (proximoEleitor) {
          ciclo = 0
          break
        } else {
          // Se não tem retorno, volta para Prioritário
          ciclo = 0
        }
      }
    }

    if (!proximoEleitor) {
      throw new Error("Não há ninguém aguardando na fila.")
    }

    // 2. Atualizar eleitor como chamado
    const now = new Date().toISOString()
    const { data: eleitor, error: updateError } = await supabaseClient
      .from('eleitores_fila')
      .update({
        status: 'chamado',
        horario_chamada: now,
        servidor_atendimento_id: servidor_id
      })
      .eq('id', proximoEleitor.id)
      .select()
      .single()

    if (updateError) throw updateError

    // 3. Atualizar o ciclo do dia no banco
    await supabaseClient
      .from('configuracao_dias')
      .update({ ciclo_atual: ciclo })
      .eq('data', dia_atendimento)

    // 4. Registrar log
    await supabaseClient.from('log_acoes').insert({
      servidor_id: servidor_id,
      acao: 'chamada_senha',
      eleitor_id: eleitor.id,
      detalhes: { senha: eleitor.senha, fila: eleitor.fila, novo_ciclo: ciclo }
    })

    return new Response(JSON.stringify({
      success: true,
      eleitor
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
