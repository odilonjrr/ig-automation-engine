import { supabaseAdmin, requireUser } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import RunSenseButton from '@/components/RunSenseButton'
import ClearTrendsButton from '@/components/ClearTrendsButton'

export const dynamic = 'force-dynamic'

export default async function TrendsPage({ params }: { params: { id: string } }) {
  const user = await requireUser(`/accounts/${params.id}/trends`)
  const db = supabaseAdmin()

  const { data: account } = await db
    .from('accounts')
    .select('id, ig_username, last_sense_run_at, last_sense_status')
    .eq('id', params.id)
    .eq('owner_user_id', user.id)
    .single()

  if (!account) return notFound()

  const { data: trends } = await db
    .from('trends')
    .select('*')
    .eq('account_id', params.id)
    .order('engagement_score', { ascending: false })
    .limit(30)

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <a href={`/accounts/${params.id}`} className="text-sm text-neutral-500 hover:text-neutral-300">
        ← configurações da conta
      </a>

      <div className="flex items-center justify-between mt-2 mb-1">
        <h1 className="text-2xl font-bold">Tendências — @{account.ig_username}</h1>
        <div className="flex items-center gap-2">
          <ClearTrendsButton accountId={params.id} />
          <RunSenseButton accountId={params.id} />
        </div>
      </div>

      <p className="text-neutral-500 text-sm mb-6">
        {account.last_sense_run_at
          ? `Última busca: ${new Date(account.last_sense_run_at).toLocaleString('pt-BR')} — ${
              account.last_sense_status === 'ok' ? 'ok' : account.last_sense_status
            }`
          : 'Nenhuma busca executada ainda.'}
      </p>

      {!trends || trends.length === 0 ? (
        <div className="border border-dashed border-neutral-700 rounded-xl py-16 text-center text-neutral-500">
          Nenhuma tendência capturada ainda. Configure hashtags/keywords em
          &quot;Configurar&quot; e clique em &quot;Buscar tendências agora&quot;.
        </div>
      ) : (
        <div className="space-y-2">
          {trends.map((t) => (
            <div
              key={t.id}
              className="border border-neutral-800 rounded-lg p-4 bg-neutral-900/50 flex items-start justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 uppercase">
                    {t.platform}
                  </span>
                  {t.used && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-400">
                      usado
                    </span>
                  )}
                </div>
                <p className="text-sm text-neutral-200 truncate">{t.topic}</p>
                <p className="text-xs text-neutral-500 mt-1">
                  {t.likes} likes · {t.comments} comentários · score {Number(t.engagement_score).toFixed(4)}
                </p>
              </div>
              {t.source_url && (
                <a
                  href={t.source_url}
                  target="_blank"
                  className="text-xs text-accent hover:underline shrink-0"
                >
                  ver
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
