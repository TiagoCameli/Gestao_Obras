// Supabase Edge Function: create-user
// Deploy with: supabase functions deploy create-user
// Requires SUPABASE_SERVICE_ROLE_KEY in Edge Function secrets
//
// Audit Fase 5 #7: agora valida que o caller (via Authorization JWT) tem a
// permissão criar_funcionarios em private.current_has_action. Mensagens de
// erro genéricas para evitar enumeração de emails.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '')

    if (!token) {
      return jsonResponse({ error: 'unauthorized' }, 401)
    }

    // Cliente "como o caller" para checar a permissão via RLS-friendly RPC.
    const supabaseAsCaller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: userData, error: userErr } = await supabaseAsCaller.auth.getUser(token)
    if (userErr || !userData?.user) {
      return jsonResponse({ error: 'unauthorized' }, 401)
    }

    // Verifica permissão via tabela funcionarios (mesma lógica de current_has_action).
    const { data: funcRow, error: funcErr } = await supabaseAsCaller
      .from('funcionarios')
      .select('cargo,acoes_permitidas,status')
      .eq('auth_user_id', userData.user.id)
      .maybeSingle()

    if (funcErr) {
      return jsonResponse({ error: 'forbidden' }, 403)
    }
    if (!funcRow || funcRow.status !== 'ativo') {
      return jsonResponse({ error: 'forbidden' }, 403)
    }
    const isAdmin = funcRow.cargo === 'Administrador'
    const hasCriar = Array.isArray(funcRow.acoes_permitidas)
      && funcRow.acoes_permitidas.includes('criar_funcionarios')
    if (!isAdmin && !hasCriar) {
      return jsonResponse({ error: 'forbidden' }, 403)
    }

    const { email, password } = await req.json().catch(() => ({}))

    if (!email || !password) {
      return jsonResponse({ error: 'email and password are required' }, 400)
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (error) {
      // Mensagem genérica: não revelar se email já existe ou outro detalhe.
      console.warn('[create-user] admin.createUser error:', error.message)
      return jsonResponse({ error: 'create_failed' }, 400)
    }

    return jsonResponse({ userId: data.user.id }, 200)
  } catch (err) {
    console.warn('[create-user] unhandled:', err)
    return jsonResponse({ error: 'internal_error' }, 500)
  }
})
