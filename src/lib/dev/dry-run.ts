/**
 * Modo dry-run / mock do pipeline.
 *
 * Quando `PIPELINE_DRY_RUN` está ligado, TODO boundary externo do pipeline
 * (banco, IA de texto/imagem, Storage, Meta Graph, fetch de trends, cripto de
 * token) faz um curto-circuito para um fake determinístico. Isso permite rodar
 * toda a orquestração Sense → Think → Make → Ship localmente, sem nenhuma
 * credencial e SEM publicar nada de verdade no Instagram.
 *
 * O flag não tem efeito em produção: cada guard só dispara quando `isDryRun()`
 * retorna true, então os caminhos reais ficam intactos com o flag desligado.
 */

export function isDryRun(): boolean {
  const v = process.env.PIPELINE_DRY_RUN
  return v === '1' || v === 'true'
}

// PNG 1x1 transparente — buffer mínimo válido que faz as vezes de uma imagem
// de slide "gerada" na camada Make, sem chamar nenhum provedor pago.
const PNG_1x1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

export function fakePngBuffer(): Buffer {
  return Buffer.from(PNG_1x1_BASE64, 'base64')
}

/**
 * O Supabase em memória é injetado pelo harness (scripts/pipeline-dryrun.ts)
 * para que a implementação fake fique fora do bundle de produção — os módulos
 * de produção só conhecem este holder, nunca o fake em si.
 */
let mockDb: unknown = null

export function setMockDb(db: unknown): void {
  mockDb = db
}

export function getMockDb<T = any>(): T {
  if (!mockDb) {
    throw new Error(
      'PIPELINE_DRY_RUN está ligado, mas nenhum mock DB foi injetado. ' +
        'Chame setMockDb(...) no harness antes de rodar o pipeline.'
    )
  }
  return mockDb as T
}
