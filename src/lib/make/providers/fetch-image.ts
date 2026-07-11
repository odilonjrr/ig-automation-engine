/**
 * Baixa uma imagem (URL pública retornada por Fal.ai/Replicate) para um Buffer,
 * que é o que a fase de upload do Storage espera.
 */
export async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Falha ao baixar imagem gerada (${res.status}) de ${url}`)
  }
  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
