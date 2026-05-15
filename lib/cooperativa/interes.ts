import { CooperativaTipo } from '@/lib/types/database'

export interface Rango {
  desde: number
  hasta: number | null
  tasa: number
}

export const RANGOS_APORTACIONES: Rango[] = [
  { desde: 30,        hasta: 49_999.99,    tasa: 0.0300 },
  { desde: 50_000,    hasta: 249_999.99,   tasa: 0.0350 },
  { desde: 250_000,   hasta: 499_999.99,   tasa: 0.0400 },
  { desde: 500_000,   hasta: 1_499_999.99, tasa: 0.0450 },
  { desde: 1_500_000, hasta: null,         tasa: 0.0500 },
]

export const RANGOS_RETIRABLE: Rango[] = [
  { desde: 100,       hasta: 9_999.99,     tasa: 0.0100 },
  { desde: 10_000,    hasta: 49_999.99,    tasa: 0.0150 },
  { desde: 50_000,    hasta: 249_999.99,   tasa: 0.0200 },
  { desde: 250_000,   hasta: 499_999.99,   tasa: 0.0250 },
  { desde: 500_000,   hasta: 1_499_999.99, tasa: 0.0300 },
  { desde: 1_500_000, hasta: null,         tasa: 0.0400 },
]

export function rangosPara(tipo: CooperativaTipo): Rango[] {
  return tipo === 'aportaciones' ? RANGOS_APORTACIONES : RANGOS_RETIRABLE
}

export function tasaAnualPara(tipo: CooperativaTipo, saldo: number): number {
  const rangos = rangosPara(tipo)
  for (const r of rangos) {
    if (saldo >= r.desde && (r.hasta === null || saldo <= r.hasta)) return r.tasa
  }
  return 0
}

export function interesMensualProyectado(tipo: CooperativaTipo, saldo: number): number {
  return Math.round(((saldo * tasaAnualPara(tipo, saldo)) / 12) * 100) / 100
}

export function nombreCuenta(tipo: CooperativaTipo): string {
  return tipo === 'aportaciones' ? 'Aportaciones' : 'Ahorro Retirable'
}
