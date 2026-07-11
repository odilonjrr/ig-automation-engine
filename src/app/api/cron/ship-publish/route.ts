import { NextRequest, NextResponse } from 'next/server'
import { publishDueQueueItems } from '@/lib/ship/run-publish'

/**
 * GET/POST /api/cron/ship-publish
 * Precisa rodar a cada poucos minutos (ex: a cada 5-10min) para que o
 * horário randomizado sorteado pelo ship-schedule seja respeitado com
 * precisão razoável.
 *
 * ⚠️ O Vercel Cron no plano Hobby só permite agendamento mínimo de 1x/dia.
 * Para rodar com frequência de minutos, use um cron externo (cron-job.org,
 * GitHub Actions com schedule, ou Vercel Pro) apontando pra esta rota,
 * sempre enviando o header Authorization: Bearer $CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const results = await publishDueQueueItems()
    return NextResponse.json({ ranAt: new Date().toISOString(), results })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export const POST = GET
