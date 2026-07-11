'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'

interface Account {
  id: string
  ig_username: string
  is_active: boolean
  post_window_start: string
  post_window_end: string
  timezone: string
  token_expires_at: string | null
}

export default function AccountCard({ account }: { account: Account }) {
  const [isActive, setIsActive] = useState(account.is_active)
  const [isPending, startTransition] = useTransition()

  const tokenExpired =
    account.token_expires_at && new Date(account.token_expires_at) < new Date()

  function togglePause() {
    const next = !isActive
    setIsActive(next) // otimista
    startTransition(async () => {
      const res = await fetch(`/api/accounts/${account.id}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ is_active: next }),
      })
      if (!res.ok) setIsActive(!next) // reverte se falhar
    })
  }

  return (
    <div className="border border-neutral-800 rounded-xl p-5 flex items-center justify-between bg-neutral-900/50">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-semibold">@{account.ig_username}</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              isActive
                ? 'bg-green-900/40 text-green-400'
                : 'bg-neutral-800 text-neutral-400'
            }`}
          >
            {isActive ? 'Ativa' : 'Pausada'}
          </span>
          {tokenExpired && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/40 text-red-400">
              Token expirado — reconectar
            </span>
          )}
        </div>
        <p className="text-neutral-500 text-sm mt-1">
          Janela de postagem: {account.post_window_start}–{account.post_window_end} (
          {account.timezone})
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href={`/accounts/${account.id}/queue`}
          className="text-sm text-neutral-300 hover:text-white underline underline-offset-2"
        >
          Fila
        </Link>
        <Link
          href={`/accounts/${account.id}/drops`}
          className="text-sm text-neutral-300 hover:text-white underline underline-offset-2"
        >
          Conteúdo
        </Link>
        <Link
          href={`/accounts/${account.id}/trends`}
          className="text-sm text-neutral-300 hover:text-white underline underline-offset-2"
        >
          Tendências
        </Link>
        <Link
          href={`/accounts/${account.id}`}
          className="text-sm text-neutral-300 hover:text-white underline underline-offset-2"
        >
          Configurar
        </Link>
        <button
          onClick={togglePause}
          disabled={isPending}
          className={`text-sm font-medium px-3 py-1.5 rounded-lg transition ${
            isActive
              ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
              : 'bg-accent hover:bg-accent/90 text-white'
          }`}
        >
          {isActive ? 'Pausar' : 'Ativar'}
        </button>
      </div>
    </div>
  )
}
