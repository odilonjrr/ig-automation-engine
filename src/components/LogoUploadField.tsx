'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LogoUploadField({
  accountId,
  initialLogoUrl,
  profileSaved,
}: {
  accountId: string
  initialLogoUrl?: string | null
  profileSaved: boolean
}) {
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl ?? null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/accounts/${accountId}/brand-profile/logo`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Falha desconhecida')
      setLogoUrl(data.logoUrl)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-neutral-300 mb-1.5">Logo da marca</label>

      {!profileSaved ? (
        <p className="text-xs text-neutral-500">
          Salve o perfil de marca abaixo (nome, DNA visual, voz) antes de enviar a logo.
        </p>
      ) : (
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-lg border border-neutral-700 bg-neutral-900 flex items-center justify-center overflow-hidden shrink-0">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo da marca" className="h-full w-full object-contain" />
            ) : (
              <span className="text-xs text-neutral-600">sem logo</span>
            )}
          </div>
          <div>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleFile}
              disabled={uploading}
              className="text-xs text-neutral-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-neutral-800 file:text-neutral-200 hover:file:bg-neutral-700 file:cursor-pointer disabled:opacity-50"
            />
            <p className="text-xs text-neutral-500 mt-1">
              PNG, JPG, WEBP ou SVG — até 5MB. Só armazenamento/referência por
              enquanto: ainda não é composta automaticamente nas imagens geradas.
            </p>
            {uploading && <p className="text-xs text-neutral-400 mt-1">Enviando...</p>}
            {error && <p className="text-xs text-red-400 mt-1">Erro: {error}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
