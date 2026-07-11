import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'IG Automation Engine',
  description: 'Pipeline de conteúdo automático para Instagram',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-neutral-950 text-neutral-100 min-h-screen">{children}</body>
    </html>
  )
}
