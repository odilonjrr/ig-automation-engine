'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CancelQueueButton({
  accountId,
  queueId,
}: {
  accountId: string
  queueId: string
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function run() {
    if (!confirm('Cancelar essa publicação agendada? O conteúdo volta a ficar disponível para reagendar depois.')) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/accounts/${accountId}/queue/${queueId}/cancel`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Falha desconhecida')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <button
        onClick={run}
        disabled={loading}
        className="text-xs bg-red-950/60 hover:bg-red-900/60 text-red-300 font-medium px-3 py-1.5 rounded-lg transition disabled:opacity-50"
      >
        {loading ? 'Cancelando...' : 'Cancelar publicação'}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}
