'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Rule {
  id: string
  keyword: string
  dm_message: string
  attachment_url: string | null
  require_follow: boolean
  is_active: boolean
}

export default function CommentAutomationForm({
  accountId,
  rules,
}: {
  accountId: string
  rules: Rule[]
}) {
  const router = useRouter()
  const [keyword, setKeyword] = useState('')
  const [dmMessage, setDmMessage] = useState('')
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [requireFollow, setRequireFollow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputClass =
    'w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-accent'
  const labelClass = 'block text-sm font-medium text-neutral-300 mb-1.5'

  async function addRule(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/accounts/${accountId}/comment-automation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword,
        dm_message: dmMessage,
        attachment_url: attachmentUrl.trim() || null,
        require_follow: requireFollow,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setKeyword('')
      setDmMessage('')
      setAttachmentUrl('')
      setRequireFollow(false)
      router.refresh()
    } else {
      const j = await res.json().catch(() => ({}))
      setError(typeof j.error === 'string' ? j.error : 'Falha ao salvar regra.')
    }
  }

  async function deleteRule(ruleId: string) {
    const res = await fetch(`/api/accounts/${accountId}/comment-automation`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruleId }),
    })
    if (res.ok) router.refresh()
  }

  return (
    <div className="space-y-4">
      {rules.length > 0 && (
        <ul className="space-y-2">
          {rules.map((r) => (
            <li
              key={r.id}
              className="border border-neutral-800 rounded-lg p-3 bg-neutral-900/50 flex items-start justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="text-sm text-neutral-200">
                  Palavra-chave: <span className="font-mono text-accent">{r.keyword}</span>
                </p>
                <p className="text-xs text-neutral-400 mt-1 whitespace-pre-wrap">{r.dm_message}</p>
                {r.attachment_url && (
                  <p className="text-xs text-neutral-500 mt-1 truncate">{r.attachment_url}</p>
                )}
              </div>
              <button
                onClick={() => deleteRule(r.id)}
                className="text-xs text-red-400 hover:text-red-300 shrink-0"
              >
                remover
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addRule} className="space-y-3 border border-neutral-800 rounded-lg p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Palavra-chave</label>
            <input
              className={inputClass}
              placeholder="SEND"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Link do lead magnet (opcional)</label>
            <input
              className={inputClass}
              placeholder="https://drive.google.com/..."
              value={attachmentUrl}
              onChange={(e) => setAttachmentUrl(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>Mensagem do DM</label>
          <textarea
            className={inputClass}
            rows={2}
            placeholder="Aqui está o material completo:"
            value={dmMessage}
            onChange={(e) => setDmMessage(e.target.value)}
            required
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-400">
          <input
            type="checkbox"
            checked={requireFollow}
            onChange={(e) => setRequireFollow(e.target.checked)}
          />
          Exigir follow antes de enviar (armazenado; ainda não verificado)
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="bg-accent hover:bg-accent/90 text-white font-medium px-4 py-2 rounded-lg text-sm transition disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Adicionar regra'}
        </button>
      </form>
    </div>
  )
}
