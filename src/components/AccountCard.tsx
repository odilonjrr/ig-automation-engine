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

const NAV_ICONS = {
  queue: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  ),
  drops: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  ),
  trends: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </svg>
  ),
  settings: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </svg>
  ),
}

function NavLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-100 transition"
    >
      {icon}
      {children}
    </Link>
  )
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
    <div className="border border-neutral-800 rounded-xl p-4 flex items-center gap-4 bg-neutral-900/50 hover:border-neutral-700 transition">
      <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-accent via-pink-500 to-purple-500 flex items-center justify-center shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="white" stroke="none" />
        </svg>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
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
        <p className="text-neutral-500 text-sm mt-0.5">
          Janela de postagem: {account.post_window_start}–{account.post_window_end} (
          {account.timezone})
        </p>
      </div>

      <div className="flex items-center gap-5 shrink-0">
        <NavLink href={`/accounts/${account.id}/queue`} icon={NAV_ICONS.queue}>
          Fila
        </NavLink>
        <NavLink href={`/accounts/${account.id}/drops`} icon={NAV_ICONS.drops}>
          Conteúdo
        </NavLink>
        <NavLink href={`/accounts/${account.id}/trends`} icon={NAV_ICONS.trends}>
          Tendências
        </NavLink>
        <NavLink href={`/accounts/${account.id}`} icon={NAV_ICONS.settings}>
          Configurar
        </NavLink>
        <button
          onClick={togglePause}
          disabled={isPending}
          className={`text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50 ${
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
