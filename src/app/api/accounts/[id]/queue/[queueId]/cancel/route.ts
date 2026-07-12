import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getSessionUser, userOwnsAccount } from '@/lib/supabase-server'

/**
 * Cancela manualmente um item agendado na publish_queue (status 'scheduled').
 * Reverte o content_drop pra 'ready', pra que ele possa ser reagendado num
 * próximo ciclo de Ship em vez de ficar preso em 'queued' pra sempre.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; queueId: string } }
) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
  }
  if (!(await userOwnsAccount(params.id, user.id))) {
    return NextResponse.json({ error: 'conta não encontrada' }, { status: 404 })
  }

  const db = supabaseAdmin()

  const { data: item, error: fetchErr } = await db
    .from('publish_queue')
    .select('id, drop_id, status')
    .eq('id', params.queueId)
    .eq('account_id', params.id)
    .maybeSingle()

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }
  if (!item) {
    return NextResponse.json({ error: 'item não encontrado' }, { status: 404 })
  }
  if (item.status !== 'scheduled') {
    return NextResponse.json(
      { error: `só é possível cancelar itens agendados (status atual: ${item.status})` },
      { status: 400 }
    )
  }

  const { error: updateErr } = await db
    .from('publish_queue')
    .update({ status: 'cancelled' })
    .eq('id', item.id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  await db.from('content_drops').update({ status: 'ready' }).eq('id', item.drop_id)

  return NextResponse.json({ ok: true })
}
