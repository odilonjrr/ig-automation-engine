import { supabaseAdmin, requireUser, userOwnsAccount } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import GenerateImagesButton from '@/components/GenerateImagesButton'

export const dynamic = 'force-dynamic'

const dropStatusLabel: Record<string, string> = {
  draft: 'Legenda pronta — aguardando imagens',
  generating_images: 'Gerando imagens...',
  ready: 'Pronto para publicar',
  queued: 'Agendado',
  published: 'Publicado',
  failed: 'Falhou ao gerar imagens',
}

export default async function DropDetailPage({
  params,
}: {
  params: { id: string; dropId: string }
}) {
  const user = await requireUser(`/accounts/${params.id}/drops/${params.dropId}`)
  if (!(await userOwnsAccount(params.id, user.id))) return notFound()

  const db = supabaseAdmin()

  const { data: drop } = await db
    .from('content_drops')
    .select('*, trends(topic, platform, source_url)')
    .eq('id', params.dropId)
    .eq('account_id', params.id)
    .single()

  if (!drop) return notFound()

  const { data: slides } = await db
    .from('slides')
    .select('*')
    .eq('drop_id', params.dropId)
    .order('slide_order', { ascending: true })

  const trend = (drop as any).trends as { topic: string; platform: string; source_url: string | null } | null
  const canGenerate = ['draft', 'failed'].includes(drop.status)

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <a href={`/accounts/${params.id}/drops`} className="text-sm text-neutral-500 hover:text-neutral-300">
        ← todos os drops
      </a>

      <div className="flex items-center justify-between mt-2 mb-1">
        <h1 className="text-xl font-bold">Drop gerado</h1>
        {canGenerate && <GenerateImagesButton dropId={params.dropId} />}
      </div>

      <p className="text-sm text-neutral-500 mb-1">
        Status: <span className="text-neutral-300">{dropStatusLabel[drop.status] ?? drop.status}</span>
      </p>

      {trend && (
        <p className="text-sm text-neutral-500 mb-6">
          Baseado em trend do {trend.platform}: &quot;{trend.topic}&quot;
          {trend.source_url && (
            <>
              {' '}
              ·{' '}
              <a href={trend.source_url} target="_blank" className="text-accent hover:underline">
                ver fonte
              </a>
            </>
          )}
        </p>
      )}

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-2">
          Legenda
        </h2>
        <p className="text-neutral-100 whitespace-pre-wrap bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 text-sm">
          {drop.caption}
        </p>
      </section>

      {drop.hooks && (drop.hooks as string[]).length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-2">
            Hooks alternativos
          </h2>
          <ul className="space-y-1.5">
            {(drop.hooks as string[]).map((h, i) => (
              <li key={i} className="text-sm text-neutral-300 bg-neutral-900/50 border border-neutral-800 rounded-lg px-3 py-2">
                {h}
              </li>
            ))}
          </ul>
        </section>
      )}

      {drop.hashtags && (drop.hashtags as string[]).length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-2">
            Hashtags
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {(drop.hashtags as string[]).map((h, i) => (
              <span key={i} className="text-xs bg-neutral-800 text-neutral-300 px-2 py-1 rounded-full">
                #{h}
              </span>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-3">
          Slides ({slides?.length ?? 0})
        </h2>

        <div className="grid grid-cols-2 gap-4">
          {slides?.map((s) => (
            <div key={s.id} className="border border-neutral-800 rounded-lg overflow-hidden bg-neutral-900/50">
              {s.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.image_url} alt={s.filename} className="w-full aspect-square object-cover" />
              ) : (
                <div className="w-full aspect-square flex items-center justify-center bg-neutral-900 text-neutral-600 text-xs">
                  {s.status === 'generating' ? 'gerando...' : s.status === 'failed' ? 'falhou' : 'pendente'}
                </div>
              )}
              <div className="p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-mono text-neutral-500">
                    {String(s.slide_order).padStart(2, '0')} · {s.filename}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      s.status === 'ok'
                        ? 'bg-green-900/40 text-green-400'
                        : s.status === 'failed'
                        ? 'bg-red-900/40 text-red-400'
                        : 'bg-neutral-800 text-neutral-500'
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed line-clamp-3">{s.prompt}</p>
                {s.error_message && (
                  <p className="text-xs text-red-400 mt-1.5">{s.error_message}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
