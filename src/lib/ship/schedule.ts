import { fromZonedTime } from 'date-fns-tz'

/**
 * Calcula um horário aleatório dentro da janela de postagem da conta
 * (post_window_start–post_window_end, no fuso configurado), convertido
 * para UTC (é isso que vai pro banco).
 *
 * Se a janela de hoje já passou, agenda para amanhã. Postar sempre no
 * mesmo minuto é o padrão mais fácil de reconhecer como automação — o
 * offset aleatório dentro da janela evita isso.
 */
export function randomScheduledTimeUtc(params: {
  windowStart: string // "HH:MM" ou "HH:MM:SS"
  windowEnd: string
  timezone: string
  now?: Date
}): Date {
  const now = params.now ?? new Date()
  const start = params.windowStart.slice(0, 5)
  const end = params.windowEnd.slice(0, 5)

  function windowFor(dateStr: string) {
    const startUtc = fromZonedTime(`${dateStr} ${start}:00`, params.timezone)
    const endUtc = fromZonedTime(`${dateStr} ${end}:00`, params.timezone)
    return { startUtc, endUtc }
  }

  const todayStr = now.toISOString().slice(0, 10)
  const { startUtc, endUtc } = windowFor(todayStr)
  const windowMs = Math.max(endUtc.getTime() - startUtc.getTime(), 0)

  let scheduled = new Date(startUtc.getTime() + Math.random() * windowMs)

  // janela de hoje já passou (ou é muito estreita/inválida) -> tenta amanhã
  if (scheduled.getTime() < now.getTime()) {
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const tomorrowStr = tomorrow.toISOString().slice(0, 10)
    const { startUtc: startT, endUtc: endT } = windowFor(tomorrowStr)
    const windowMsT = Math.max(endT.getTime() - startT.getTime(), 0)
    scheduled = new Date(startT.getTime() + Math.random() * windowMsT)
  }

  return scheduled
}
