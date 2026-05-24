import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd MMM yyyy', { locale: es })
}

export function formatMonth(mes: number, anio: number): string {
  const date = new Date(anio, mes - 1, 1)
  return format(date, 'MMMM yyyy', { locale: es })
}

export function getCurrentMonth(): { mes: number; anio: number } {
  const now = new Date()
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
  return format(new Date(), 'yyyy-MM-dd')
}

export function diasRestantes(fechaLimite: string): number {
  const limite = parseISO(fechaLimite)
  const hoy = new Date()
  const diff = limite.getTime() - hoy.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

/**
 * Devuelve la próxima fecha (ISO) en que cae el día `dia` del mes.
 * Si el día ya pasó este mes, usa el mes siguiente. Ajusta el día al
 * último día del mes cuando el mes es más corto (ej. día 31 en febrero).
 */
export function proximoDiaPago(dia: number, desde: Date = new Date()): string {
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
