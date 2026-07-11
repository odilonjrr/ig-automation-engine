import { supabaseAdmin, requireUser } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import GenerateDropButton from '@/components/GenerateDropButton'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const statusLabel: Record<string, string> = {
  draft: 'Legenda pronta — aguardando imagens',
  generating_images: 'Gerando imagens',
  ready: 'Pronto para publicar',
  queued: 'Agendado',
  published: 'Publicado',
  failed: 'Falhou',
}

const statusColor: Record<string, string> = {
  draft: 'bg-blue-900/40 text-blue-400',
  generating_images: 'bg-yellow-900/40 text-yellow-400',
  ready: 'bg-green-900/40 text-green-400',
  queued: 'bg-purple-900/40 text-purple-400',
  published: 'bg-green-900/40 text-green-400',
  failed: 'bg-red-900/40 text-red-400',
}

export default async function DropsPage({ params }: { params: { id: string } }) {
  const user = await requireUser(`/accounts/${params.id}/drops`)
  const db = supabaseAdmin()

  const { data: account } = await db
    .from('accounts')
    .select('id, ig_username')
    .eq('id', params.id)
    .eq('owner_user_id', user.id)
    .single()

  if (!account) return notFound()

  const { data: drops } = await db
    .from('content_drops')
    .select('id, caption, status, created_at, trend_id')
    .eq('account_id', params.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const { count: pendingTrends } = await db
    .from('trends')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', params.id)
    .eq('used', false)

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <a href={`/accounts/${params.id}`} className="text-sm text-neutral-500 hover:text-neutral-300">
        ← configurações da conta
      </a>

      <div className="flex items-center justify-between mt-2 mb-1">
        <h1 className="text-2xl font-bold">Conteúdo gerado — @{account.ig_username}</h1>
        <GenerateDropButton accountId={params.id} />
      </div>

      <p className="text-neutral-500 text-sm mb-6">
        {pendingTrends ?? 0} tendência(s) disponível(is) para virar conteúdo.
      </p>

      {!drops || drops.length === 0 ? (
        <div className="border border-dashed border-neutral-700 rounded-xl py-16 text-center text-neutral-500">
          Nenhum drop gerado ainda. Clique em &quot;Gerar conteúdo agora&quot; —
          isso usa o trend de maior engajamento ainda não utilizado.
        </div>
      ) : (
        <div className="space-y-2">
          {drops.map((d) => (
            <Link
              key={d.id}
              href={`/accounts/${params.id}/drops/${d.id}`}
              className="block border border-neutral-800 rounded-lg p-4 bg-neutral-900/50 hover:border-neutral-600 transition"
            >
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-neutral-200 truncate flex-1">
                  {d.caption ?? '(sem legenda)'}
                </p>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                    statusColor[d.status] ?? 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {statusLabel[d.status] ?? d.status}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                {new Date(d.created_at).toLocaleString('pt-BR')}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
