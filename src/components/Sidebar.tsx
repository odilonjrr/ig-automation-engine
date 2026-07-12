import Link from 'next/link'

/**
 * Barra lateral de navegação, fixa nas telas autenticadas (ver
 * src/app/accounts/layout.tsx). Só "Contas" tem uma tela de verdade por
 * trás hoje — os demais ícones são reservados para telas futuras (visão
 * geral consolidada, insights, config global) e ficam desabilitados em vez
 * de fingir que levam a algum lugar.
 */

function IconButton({
  href,
  active,
  disabled,
  label,
  children,
}: {
  href?: string
  active?: boolean
  disabled?: boolean
  label: string
  children: React.ReactNode
}) {
  const base =
    'h-11 w-11 flex items-center justify-center rounded-xl transition shrink-0'
  const state = active
    ? 'bg-accent/15 text-accent'
    : disabled
    ? 'text-neutral-700 cursor-not-allowed'
    : 'text-neutral-500 hover:text-neutral-200 hover:bg-neutral-900'

  if (disabled || !href) {
    return (
      <div className={`${base} ${state}`} title={disabled ? `${label} — em breve` : label}>
        {children}
      </div>
    )
  }

  return (
    <Link href={href} className={`${base} ${state}`} title={label}>
      {children}
    </Link>
  )
}

export default function Sidebar() {
  return (
    <aside className="w-20 shrink-0 min-h-screen border-r border-neutral-900 flex flex-col items-center py-6 gap-2">
      <Link
        href="/accounts"
        className="h-11 w-11 flex items-center justify-center rounded-xl bg-gradient-to-tr from-accent to-pink-500 text-white mb-4 shrink-0"
        title="IG Automation Engine"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      </Link>

      <IconButton href="/accounts" active label="Contas">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="8" height="8" rx="1.5" />
          <rect x="13" y="3" width="8" height="8" rx="1.5" />
          <rect x="3" y="13" width="8" height="8" rx="1.5" />
          <rect x="13" y="13" width="8" height="8" rx="1.5" />
        </svg>
      </IconButton>

      <IconButton disabled label="Visão geral / insights">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3v18h18" />
          <path d="M7 15l3-4 3 2 5-6" />
        </svg>
      </IconButton>

      <IconButton disabled label="IA / automação">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
          <path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" />
        </svg>
      </IconButton>

      <IconButton disabled label="Configurações globais">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
        </svg>
      </IconButton>

      <div className="flex-1" />

      <IconButton disabled label="Ajuda">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9a2.5 2.5 0 015 .5c0 1.5-2.5 2-2.5 3.5" />
          <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
        </svg>
      </IconButton>

      <div
        className="h-9 w-9 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xs font-medium text-neutral-300 relative"
        title="Sua conta"
      >
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-neutral-950" />
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
        </svg>
      </div>
    </aside>
  )
}
