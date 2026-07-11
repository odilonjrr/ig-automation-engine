import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { runThinkForAccount } from '@/lib/think/run-think'

/**
 * GET/POST /api/cron/think
 * Roda depois do /api/cron/sense (agendar ~30-60min depois, para dar tempo
 * dos trends serem capturados). Gera 1 content_drop por conta ativa, usando
 * o trend de maior score ainda não usado.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const db = supabaseAdmin()
  const { data: accounts, error } = await db
    .from('accounts')
    .select('id')
    .eq('is_active', true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const summary: Array<{ accountId: string; dropId: string | null; error?: string }> = []

  for (const account of accounts ?? []) {
    try {
      const dropId = await runThinkForAccount(account.id)
      summary.push({ accountId: account.id, dropId })
    } catch (err: any) {
      console.error(`Think falhou para conta ${account.id}:`, err)
      summary.push({ accountId: account.id, dropId: null, error: err.message })
    }
  }

  return NextResponse.json({ ranAt: new Date().toISOString(), summary })
}

export const POST = GET
