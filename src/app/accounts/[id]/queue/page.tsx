import { supabaseAdmin, requireUser } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

const statusLabel: Record<string, string> = {
  scheduled: 'Agendado',
  publishing: 'Publicando...',
  published: 'Publicado',
  failed: 'Falhou',
  cancelled: 'Cancelado',
}

const statusColor: Record<string, string> = {
  scheduled: 'bg-blue-900/40 text-blue-400',
  publishing: 'bg-yellow-900/40 text-yellow-400',
  published: 'bg-green-900/40 text-green-400',
  failed: 'bg-red-900/40 text-red-400',
  cancelled: 'bg-neutral-800 text-neutral-500',
}

export default async function QueuePage({ params }: { params: { id: string } }) {
  const user = await requireUser(`/accounts/${params.id}/queue`)
  const db = supabaseAdmin()

  const { data: account } = await db
    .from('accounts')
    .select('id, ig_username, timezone')
    .eq('id', params.id)
    .eq('owner_user_id', user.id)
    .single()

  if (!account) return notFound()

  const { data: queue } = await db
    .from('publish_queue')
    .select('*, content_drops(caption)')
    .eq('account_id', params.id)
    .order('scheduled_for', { ascending: false })
    .limit(30)

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <a href={`/accounts/${params.id}`} className="text-sm text-neutral-500 hover:text-neutral-300">
        ← configurações da conta
      </a>
      <h1 className="text-2xl font-bold mt-2 mb-1">Fila de publicação — @{account.ig_username}</h1>
      <p className="text-neutral-500 text-sm mb-6">Fuso horário: {account.timezone}</p>

      {!queue || queue.length === 0 ? (
        <div className="border border-dashed border-neutral-700 rounded-xl py-16 text-center text-neutral-500">
          Nada na fila ainda. Drops com status &quot;Pronto para publicar&quot; entram aqui
          automaticamente no próximo ciclo de agendamento (Ship).
        </div>
      ) : (
        <div className="space-y-2">
          {queue.map((q) => {
            const caption = (q as any).content_drops?.caption as string | undefined
            return (
              <div
                key={q.id}
                className="border border-neutral-800 rounded-lg p-4 bg-neutral-900/50 flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[q.status] ?? ''}`}>
                      {statusLabel[q.status] ?? q.status}
                    </span>
                    <span className="text-xs text-neutral-500">
                      tentativa {q.attempts}/{q.max_attempts}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-300 truncate">{caption ?? '(sem legenda)'}</p>
                  <p className="text-xs text-neutral-500 mt-1">
                    Agendado para: {new Date(q.scheduled_for).toLocaleString('pt-BR', {
                      timeZone: account.timezone,
                    })}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
