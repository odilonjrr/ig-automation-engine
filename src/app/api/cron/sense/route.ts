import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { runSenseForAccount } from '@/lib/trends/run-sense'

/**
 * GET/POST /api/cron/sense
 * Roda 1x/dia (agendado em vercel.json). Protegida por CRON_SECRET —
 * a Vercel injeta automaticamente o header `Authorization: Bearer $CRON_SECRET`
 * quando a env var CRON_SECRET está definida no projeto.
 *
 * Falha em uma conta não derruba as demais — isolada em try/catch por conta.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const db = supabaseAdmin()
  const { data: accounts, error } = await db
    .from('accounts')
    .select('id, ig_user_id, access_token_encrypted, token_iv')
    .eq('is_active', true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const summary: Array<{ accountId: string; inserted: number; error?: string }> = []

  for (const account of accounts ?? []) {
    try {
      const inserted = await runSenseForAccount(account)
      summary.push({ accountId: account.id, inserted })
    } catch (err: any) {
      console.error(`Sense falhou para conta ${account.id}:`, err)
      await db
        .from('accounts')
        .update({
          last_sense_run_at: new Date().toISOString(),
          last_sense_status: `error: ${String(err.message).slice(0, 200)}`,
        })
        .eq('id', account.id)
      summary.push({ accountId: account.id, inserted: 0, error: err.message })
    }
  }

  return NextResponse.json({ ranAt: new Date().toISOString(), summary })
}

export const POST = GET
