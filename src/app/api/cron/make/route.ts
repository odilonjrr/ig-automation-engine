import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { runMakeForDrop } from '@/lib/make/run-make'

/**
 * GET/POST /api/cron/make
 * Roda depois do /api/cron/think (agendar ~15-30min depois). Gera imagens
 * para todos os drops em status 'draft' (legenda pronta, imagem pendente).
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const db = supabaseAdmin()
  const { data: drops, error } = await db
    .from('content_drops')
    .select('id')
    .eq('status', 'draft')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const summary: Array<{ dropId: string; status?: string; error?: string }> = []

  for (const drop of drops ?? []) {
    try {
      const result = await runMakeForDrop(drop.id)
      summary.push({ dropId: drop.id, status: result.status })
    } catch (err: any) {
      console.error(`Make falhou para drop ${drop.id}:`, err)
      summary.push({ dropId: drop.id, error: err.message })
    }
  }

  return NextResponse.json({ ranAt: new Date().toISOString(), summary })
}

export const POST = GET
