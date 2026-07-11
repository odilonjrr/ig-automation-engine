'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function GenerateImagesButton({ dropId }: { dropId: string }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  async function run() {
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/drops/${dropId}/generate-images`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Falha desconhecida')
      setMessage(`${data.successCount} ok, ${data.failCount} falharam`)
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
        className="bg-accent hover:bg-accent/90 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
      >
        {loading ? 'Gerando imagens...' : 'Gerar imagens'}
      </button>
    </div>
  )
}
