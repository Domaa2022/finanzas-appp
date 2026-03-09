import { AhorroTipo } from '@/lib/types/database'

export function calcularAhorro(monto: number, tipo: AhorroTipo, valor: number): number {
  if (tipo === 'ninguno') return 0
  if (tipo === 'porcentaje') return Math.round((monto * valor) / 100 * 100) / 100
  return Math.min(valor, monto)
}

export function calcularPorcentaje(actual: number, objetivo: number): number {
  if (objetivo === 0) return 0
  return Math.min(Math.round((actual / objetivo) * 100), 100)
}

export function getBudgetStatus(porcentaje: number): 'ok' | 'warning' | 'danger' {
  if (porcentaje >= 100) return 'danger'
  if (porcentaje >= 75) return 'warning'
  return 'ok'
}
