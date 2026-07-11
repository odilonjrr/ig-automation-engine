import { NextRequest, NextResponse } from 'next/server'
import { enqueueReadyDrops } from '@/lib/ship/run-enqueue'

/**
 * GET/POST /api/cron/ship-schedule
 * Roda 1x/dia, depois do /api/cron/make. Sorteia o horário de publicação
 * de cada drop pronto e insere na publish_queue.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const results = await enqueueReadyDrops()
    return NextResponse.json({ ranAt: new Date().toISOString(), results })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export const POST = GET
