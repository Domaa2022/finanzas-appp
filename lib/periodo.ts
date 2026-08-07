// Término del "período de pago" según la frecuencia, para hablarle a cada
// usuario en su idioma (quincena / mes / semana / …) en vez de asumir quincena.

export const DIAS_PERIODO: Record<string, number> = {
  diario: 1, semanal: 7, quincenal: 15, mensual: 30,
}

export interface TerminoPeriodo {
  singular: string   // "quincena", "mes", "semana", "período"
  Singular: string   // "Quincena", "Mes", "Semana", "Período"
  adjetivo: string   // "quincenal", "mensual", "semanal", "del período"
}

/**
 * Devuelve cómo nombrar el período de pago. Acepta una frecuencia de ingreso
 * ('quincenal'|'mensual'|…) o una preferencia de cobro. Sin dato → "período".
 */
export function terminoPeriodo(frec?: string | null): TerminoPeriodo {
  switch (frec) {
    case 'semanal':   return { singular: 'semana',   Singular: 'Semana',   adjetivo: 'semanal' }
    case 'mensual':   return { singular: 'mes',      Singular: 'Mes',      adjetivo: 'mensual' }
    case 'diario':    return { singular: 'día',      Singular: 'Día',      adjetivo: 'diario' }
    case 'quincenal': return { singular: 'quincena', Singular: 'Quincena', adjetivo: 'quincenal' }
    default:          return { singular: 'período',  Singular: 'Período',  adjetivo: 'del período' }
  }
}
