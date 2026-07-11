import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getSessionUser } from '@/lib/supabase-server'
import { runSenseForAccount } from '@/lib/trends/run-sense'

/**
 * POST /api/accounts/[id]/run-sense
 * Trigger manual — dispara o scan de tendências para uma única conta,
 * fora do horário do cron. Usado pelo botão "Buscar tendências agora"
 * no dashboard.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }

  const db = supabaseAdmin()

  const { data: account, error } = await db
    .from('accounts')
    .select('id, ig_user_id, access_token_encrypted, token_iv')
    .eq('id', params.id)
    .eq('owner_user_id', user.id)
    .single()

  if (error || !account) {
    return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })
  }

  try {
    const inserted = await runSenseForAccount(account)
    return NextResponse.json({ ok: true, inserted })
  } catch (err: any) {
    await db
      .from('accounts')
      .update({
        last_sense_run_at: new Date().toISOString(),
        last_sense_status: `error: ${String(err.message).slice(0, 200)}`,
      })
      .eq('id', params.id)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
