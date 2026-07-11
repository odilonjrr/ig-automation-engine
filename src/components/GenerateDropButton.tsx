'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function GenerateDropButton({ accountId }: { accountId: string }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  async function run() {
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/accounts/${accountId}/generate-drop`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Falha desconhecida')
      router.push(`/accounts/${accountId}/drops/${data.dropId}`)
    } catch (err: any) {
      setMessage(`Erro: ${err.message}`)
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {message && <span className="text-xs text-red-400">{message}</span>}
      <button
        onClick={run}
        disabled={loading}
        className="bg-accent hover:bg-accent/90 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
      >
        {loading ? 'Gerando...' : 'Gerar conteúdo agora'}
      </button>
    </div>
  )
}
