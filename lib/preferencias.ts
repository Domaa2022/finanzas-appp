// Módulos opcionales de la app. Los básicos (dashboard, cuentas, ingresos,
// gastos, reportes, configuración) siempre se ven y no están acá.

export type ModuloKey =
  | 'gastos_fijos'
  | 'suscripciones'
  | 'deudas'
  | 'ahorros'
  | 'ahorro_programado'
  | 'cooperativa'
  | 'quincena'
  | 'efectivo'
  | 'presupuestos'
  | 'categorias'

export type Modulos = Record<ModuloKey, boolean>

export interface Preferencias {
  cobro?: 'quincenal' | 'mensual' | 'variable'
  modulos?: Partial<Modulos>
}

/** Catálogo de módulos activables, con su etiqueta y una descripción corta. */
export const MODULOS: { key: ModuloKey; label: string; descripcion: string }[] = [
  { key: 'quincena',          label: 'Quincena',            descripcion: 'Presupuesto por período de pago' },
  { key: 'gastos_fijos',      label: 'Gastos fijos',        descripcion: 'Pagos recurrentes de cada quincena' },
  { key: 'suscripciones',     label: 'Suscripciones',       descripcion: 'Pagos con fondo (mensual, anual…)' },
  { key: 'ahorros',           label: 'Metas de ahorro',     descripcion: 'Fondo general y metas' },
  { key: 'ahorro_programado', label: 'Ahorro programado',   descripcion: 'Reglas de ahorro automático' },
  { key: 'deudas',            label: 'Deudas y préstamos',  descripcion: 'Lo que debés o te deben' },
  { key: 'cooperativa',       label: 'Cooperativa',         descripcion: 'Aportaciones y ahorro retirable' },
  { key: 'efectivo',          label: 'Efectivo',            descripcion: 'Movimientos de dinero en mano' },
  { key: 'presupuestos',      label: 'Presupuestos',        descripcion: 'Límites de gasto por categoría' },
  { key: 'categorias',        label: 'Categorías',          descripcion: 'Administrar tus categorías' },
]

/** Valores por defecto para un usuario nuevo antes de elegir: todo apagado. */
export function modulosVacios(): Modulos {
  return {
    gastos_fijos: false, suscripciones: false, deudas: false, ahorros: false,
    ahorro_programado: false, cooperativa: false, quincena: false, efectivo: false,
    presupuestos: false, categorias: false,
  }
}

/** ¿Está activo este módulo? Si no hay preferencias, se asume apagado. */
export function moduloActivo(prefs: Preferencias | null | undefined, key: ModuloKey): boolean {
  return !!prefs?.modulos?.[key]
}
