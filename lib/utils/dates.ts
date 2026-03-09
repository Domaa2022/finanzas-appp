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
