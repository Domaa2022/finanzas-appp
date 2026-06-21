import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

/**
 * Zona horaria de la app. Las fechas civiles (hoy, mes actual, días restantes)
 * deben calcularse en esta zona y NO en la del servidor: en producción el
 * servidor corre en UTC, por lo que `new Date()` se adelanta un día por la noche.
 */
export const APP_TIMEZONE = 'America/Tegucigalpa'

/** Devuelve un Date a medianoche local con la fecha civil actual en la zona de la app. */
export function todayInAppTZ(): Date {
  const [y, m, d] = todayISO().split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd MMM yyyy', { locale: es })
}

export function formatMonth(mes: number, anio: number): string {
  const date = new Date(anio, mes - 1, 1)
  return format(date, 'MMMM yyyy', { locale: es })
}

export function getCurrentMonth(): { mes: number; anio: number } {
  const now = todayInAppTZ()
  return { mes: now.getMonth() + 1, anio: now.getFullYear() }
}

export function getMonthRange(mes: number, anio: number): { start: string; end: string } {
  const date = new Date(anio, mes - 1, 1)
  return {
    start: format(startOfMonth(date), 'yyyy-MM-dd'),
    end: format(endOfMonth(date), 'yyyy-MM-dd'),
  }
}

export function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function diasRestantes(fechaLimite: string): number {
  const limite = parseISO(fechaLimite)
  const hoy = todayInAppTZ()
  const diff = limite.getTime() - hoy.getTime()
  return Math.round(diff / (1000 * 60 * 60 * 24))
}

/**
 * Devuelve la próxima fecha (ISO) en que cae el día `dia` del mes.
 * Si el día ya pasó este mes, usa el mes siguiente. Ajusta el día al
 * último día del mes cuando el mes es más corto (ej. día 31 en febrero).
 */
export function proximoDiaPago(dia: number, desde: Date = todayInAppTZ()): string {
  const base = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate())
  const diaActual = base.getDate()

  let anio = base.getFullYear()
  let mes = base.getMonth() // 0-11
  if (dia < diaActual) {
    mes += 1
    if (mes > 11) { mes = 0; anio += 1 }
  }

  const ultimoDiaMes = new Date(anio, mes + 1, 0).getDate()
  const diaEfectivo = Math.min(dia, ultimoDiaMes)
  return format(new Date(anio, mes, diaEfectivo), 'yyyy-MM-dd')
}
