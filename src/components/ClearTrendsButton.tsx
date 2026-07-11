'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ClearTrendsButton({ accountId }: { accountId: string }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  async function run() {
    if (!confirm('Apagar todas as tendências ainda não usadas desta conta?')) return
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/accounts/${accountId}/clear-trends`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Falha desconhecida')
      setMessage(`${data.deleted} tendências apagadas`)
      router.refresh()
    } catch (err: any) {
      setMessage(`Erro: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {message && <span className="text-xs text-neutral-400">{message}</span>}
      <button
        onClick={run}
        disabled={loading}
        className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
      >
        {loading ? 'Apagando...' : 'Limpar tendências'}
      </button>
    </div>
  )
}
