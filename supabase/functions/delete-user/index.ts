// Supabase Edge Function: delete-user
// Deploy with: supabase functions deploy delete-user
// Requires SUPABASE_SERVICE_ROLE_KEY in Edge Function secrets
//
// Audit Fase 7.4 #8: offboarding completo.
// Recebe `funcionarioId`, valida que o caller tem excluir_funcionarios, busca
// o auth_user_id correspondente, deleta o funcionário e remove a entrada em
// auth.users (revoga sessão ativa em outros devices).

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

    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!token) {
      return jsonResponse({ error: 'unauthorized' }, 401)
    }

    const supabaseAsCaller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: userData, error: userErr } = await supabaseAsCaller.auth.getUser(token)
    if (userErr || !userData?.user) {
      return jsonResponse({ error: 'unauthorized' }, 401)
    }

    const { data: callerRow } = await supabaseAsCaller
      .from('funcionarios')
      .select('id,cargo,acoes_permitidas,status')
      .eq('auth_user_id', userData.user.id)
      .maybeSingle()

    if (!callerRow || callerRow.status !== 'ativo') {
      return jsonResponse({ error: 'forbidden' }, 403)
    }

    const isAdmin = callerRow.cargo === 'Administrador'
    const hasExcluir = Array.isArray(callerRow.acoes_permitidas)
      && callerRow.acoes_permitidas.includes('excluir_funcionarios')
    if (!isAdmin && !hasExcluir) {
      return jsonResponse({ error: 'forbidden' }, 403)
    }

    const { funcionarioId } = await req.json().catch(() => ({}))
    if (!funcionarioId || typeof funcionarioId !== 'string') {
      return jsonResponse({ error: 'funcionarioId required' }, 400)
    }
    if (funcionarioId === callerRow.id) {
      return jsonResponse({ error: 'cannot_delete_self' }, 400)
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Pega auth_user_id antes de deletar o funcionário.
    const { data: targetRow, error: targetErr } = await supabaseAdmin
      .from('funcionarios')
      .select('id,auth_user_id,cargo')
      .eq('id', funcionarioId)
      .maybeSingle()

    if (targetErr) {
      return jsonResponse({ error: 'not_found' }, 404)
    }
    if (!targetRow) {
      return jsonResponse({ error: 'not_found' }, 404)
    }

    // Bloqueia exclusão do último Administrador ativo.
    if (targetRow.cargo === 'Administrador') {
      const { count } = await supabaseAdmin
        .from('funcionarios')
        .select('id', { count: 'exact', head: true })
        .eq('cargo', 'Administrador')
        .eq('status', 'ativo')
      if ((count ?? 0) <= 1) {
        return jsonResponse({ error: 'last_admin' }, 400)
      }
    }

    // Deleta primeiro o funcionário (RLS já protege com excluir_funcionarios).
    const { error: delFuncErr } = await supabaseAdmin
      .from('funcionarios')
      .delete()
      .eq('id', funcionarioId)
    if (delFuncErr) {
      console.warn('[delete-user] delete funcionario:', delFuncErr.message)
      return jsonResponse({ error: 'delete_failed' }, 400)
    }

    // Depois deleta a entrada em auth.users (revoga refresh tokens).
    if (targetRow.auth_user_id) {
      const { error: delAuthErr } = await supabaseAdmin.auth.admin.deleteUser(
        targetRow.auth_user_id,
      )
      if (delAuthErr) {
        // Não reverter a exclusão do funcionário — log e segue.
        console.warn('[delete-user] auth.deleteUser:', delAuthErr.message)
      }
    }

    return jsonResponse({ ok: true }, 200)
  } catch (err) {
    console.warn('[delete-user] unhandled:', err)
    return jsonResponse({ error: 'internal_error' }, 500)
  }
})
