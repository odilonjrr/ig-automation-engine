import { supabaseAdmin } from '@/lib/supabase-server'
import { randomScheduledTimeUtc } from './schedule'

/**
 * Enfileira todos os drops com status 'ready' de contas ativas que ainda
 * não têm entrada na publish_queue. Um drop = um post agendado, com
 * horário sorteado dentro da janela de postagem da conta.
 */
export async function enqueueReadyDrops() {
  const db = supabaseAdmin()

  const { data: drops, error } = await db
    .from('content_drops')
    .select('id, account_id, accounts!inner(is_active, post_window_start, post_window_end, timezone)')
    .eq('status', 'ready')
    .eq('accounts.is_active', true)

  if (error) throw error

  const results: Array<{ dropId: string; scheduledFor?: string; error?: string }> = []

  for (const drop of drops ?? []) {
    try {
      // evita duplicar se já existe uma entrada não-cancelada na fila para esse drop
      const { data: existing } = await db
        .from('publish_queue')
        .select('id')
        .eq('drop_id', drop.id)
        .neq('status', 'cancelled')
        .maybeSingle()

      if (existing) {
        results.push({ dropId: drop.id, error: 'já estava na fila' })
        continue
      }

      const account = (drop as any).accounts as {
        post_window_start: string
        post_window_end: string
        timezone: string
      }

      const scheduledFor = randomScheduledTimeUtc({
        windowStart: account.post_window_start,
        windowEnd: account.post_window_end,
        timezone: account.timezone,
      })

      const { error: insertErr } = await db.from('publish_queue').insert({
        account_id: drop.account_id,
        drop_id: drop.id,
        scheduled_for: scheduledFor.toISOString(),
        status: 'scheduled',
      })
      if (insertErr) throw insertErr

      await db.from('content_drops').update({ status: 'queued' }).eq('id', drop.id)

      results.push({ dropId: drop.id, scheduledFor: scheduledFor.toISOString() })
    } catch (err: any) {
      results.push({ dropId: drop.id, error: err.message })
    }
  }

  return results
}
