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
    const { dia_atendimento, nome, data_nascimento, pcd, prioritario, servidor_cadastro_id } = params

    // 1. Verificar se o dia está configurado e não bloqueado
    const { data: config, error: configError } = await supabaseClient
      .from('configuracao_dias')
      .select('limite_senhas, bloqueado, periodo')
      .eq('data', dia_atendimento)
      .single()

    if (configError || !config) {
      throw new Error(`Dia ${dia_atendimento} não configurado.`)
    }

    if (config.bloqueado) {
      throw new Error(`O dia ${dia_atendimento} está bloqueado para novos atendimentos.`)
    }

    // 2. Verificar o limite de senhas
    const { count, error: countError } = await supabaseClient
      .from('eleitores_fila')
      .select('*', { count: 'exact', head: true })
      .eq('dia_atendimento', dia_atendimento)
      .neq('status', 'cancelado')

    if (countError) throw countError
    const totalSenhas = count || 0

    if (totalSenhas >= config.limite_senhas) {
      throw new Error(`Limite de senhas (${config.limite_senhas}) atingido para hoje.`)
    }

    // 3. Determinar a fila (no Período 1, a fila inicial é sempre prioritaria ou normal)
    const fila = prioritario ? 'prioritaria' : 'normal'

    // 4. Inserir eleitor e gerar senha (sequencial para o dia)
    const proximaSenha = totalSenhas + 1

    const { data: eleitor, error: insertError } = await supabaseClient
      .from('eleitores_fila')
      .insert({
        nome,
        data_nascimento,
        pcd,
        prioritario,
        dia_atendimento,
        senha: proximaSenha,
        tipo: config.periodo === 2 ? 'agendado' : 'presencial',
        fila,
        servidor_cadastro_id,
        status: 'aguardando'
      })
      .select()
      .single()

    if (insertError) throw insertError

    // 5. Registrar log de criação
    await supabaseClient.from('log_acoes').insert({
      servidor_id: servidor_cadastro_id,
      acao: 'cadastro_fila',
      eleitor_id: eleitor.id,
      detalhes: { senha: proximaSenha, fila }
    })

    return new Response(JSON.stringify({
      success: true,
      eleitor,
      senha: proximaSenha,
      fila,
      posicao: totalSenhas + 1 // Posição aproximada na fila total do dia
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
