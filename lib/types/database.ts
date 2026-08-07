export type Frecuencia = 'diario' | 'semanal' | 'quincenal' | 'mensual'
export type AhorroTipo = 'porcentaje' | 'fijo' | 'ninguno'
export type EstadoMeta = 'activa' | 'completada' | 'pausada'
export type TipoCategoria = 'gasto' | 'ingreso'

export interface Profile {
  id: string
  nombre: string
  email: string
  default_savings_pct: number
  avatar_url: string | null
  onboarding_completo: boolean
  preferencias: import('@/lib/preferencias').Preferencias | null
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  user_id: string
  nombre: string
  tipo: TipoCategoria
  icono: string | null
  color: string | null
  is_active: boolean
  created_at: string
}

/** Tipos de cuenta. `tarjeta` es un pasivo revolvente (ver Fase 3). */
export type TipoCuenta = 'corriente' | 'ahorro' | 'efectivo' | 'cooperativa' | 'tarjeta'

export interface Cuenta {
  id: string
  user_id: string
  nombre: string
  tipo: TipoCuenta
  banco: string | null
  saldo_inicial: number
  /** Preseleccionada en los formularios. A lo sumo una por usuario. */
  es_principal: boolean
  /** Cuenta líquida: su saldo suma al saldo disponible. */
  es_disponible: boolean
  color: string | null
  orden: number
  activo: boolean
  /** Solo tarjeta. NULL en el resto. */
  cupo: number | null
  dia_corte: number | null
  dia_pago: number | null
  /** Si la tarjeta comparte cupo con otras, apunta a la línea. NULL = cupo propio. */
  linea_credito_id: string | null
  created_at: string
  updated_at: string
}

/** Línea de crédito compartida entre varias tarjetas (límite en HNL). */
export interface LineaCredito {
  id: string
  user_id: string
  nombre: string
  limite: number
  created_at: string
  updated_at: string
}

/** Fila de get_lineas_credito: la línea con su deuda y disponible calculados. */
export interface SaldoLinea {
  id: string
  nombre: string
  limite: number
  deuda: number
  disponible: number
}

export type TipoTransferencia = 'traspaso' | 'pago_tarjeta'

export interface Transferencia {
  id: string
  user_id: string
  cuenta_origen_id: string
  cuenta_destino_id: string
  monto: number
  fecha: string
  tipo: TipoTransferencia
  notas: string | null
  created_at: string
}

/** Fila de get_saldos_cuentas: cuenta con su saldo derivado. */
export interface SaldoCuenta {
  id: string
  nombre: string
  tipo: TipoCuenta
  es_disponible: boolean
  es_principal: boolean
  color: string | null
  orden: number
  /** 'cuenta' = tabla cuentas · 'cooperativa' = proyección de solo lectura. */
  origen: 'cuenta' | 'cooperativa'
  saldo: number
}

export interface IncomeEntry {
  id: string
  user_id: string
  monto: number
  fuente: string
  frecuencia: Frecuencia
  fecha: string
  category_id: string | null
  cuenta_id: string | null
  ahorro_tipo: AhorroTipo
  ahorro_valor: number
  notas: string | null
  es_quincena_actual: boolean
  created_at: string
  categories?: Category
}

export interface Expense {
  id: string
  user_id: string
  monto: number
  category_id: string
  cuenta_id: string | null
  descripcion: string | null
  fecha: string
  notas: string | null
  created_at: string
  categories?: Category
}

export interface SavingsGoal {
  id: string
  user_id: string
  nombre: string
  monto_objetivo: number
  monto_actual: number
  fecha_limite: string | null
  prioridad: number
  estado: EstadoMeta
  es_general: boolean
  es_gasto_fijo: boolean
  created_at: string
  updated_at: string
}

export interface SavingsAllocation {
  id: string
  user_id: string
  income_entry_id: string | null
  savings_goal_id: string
  monto: number
  fecha: string
  notas: string | null
  created_at: string
  savings_goals?: SavingsGoal
  income_entries?: IncomeEntry
}

export interface Budget {
  id: string
  user_id: string
  category_id: string
  limite_mensual: number
  mes: number
  anio: number
  created_at: string
  categories?: Category
}

export interface ScheduledSaving {
  id: string
  user_id: string
  nombre: string
  tipo: 'porcentaje' | 'fijo'
  valor: number
  frecuencia: Frecuencia
  activo: boolean
  /** Meta destino. NULL = Fondo General. */
  savings_goal_id: string | null
  created_at: string
}

/**
 * `quincenal` se cobra directo con cada quincena, sin fondo.
 * El resto aparta dinero cada quincena y se cobra solo al llegar `proximo_pago`.
 * `variable` no tiene fecha fija: aparta hasta llenar el fondo, ahí se detiene,
 * y se paga cuando el usuario lo confirma.
 */
export type FrecuenciaGastoFijo =
  | 'quincenal' | 'semanal' | 'mensual' | 'trimestral' | 'anual' | 'variable'

export interface FixedExpense {
  id: string
  user_id: string
  nombre: string
  monto: number
  category_id: string | null
  activo: boolean
  frecuencia: FrecuenciaGastoFijo
  /** @deprecated Desde 031 la fuente de verdad es `proximo_pago`. Se mantiene sincronizado para los mensuales. */
  dia_pago: number | null
  /** Fecha del próximo cobro. NULL en `quincenal` y `variable`. */
  proximo_pago: string | null
  savings_goal_id: string | null
  /** Cuenta de la que se cobra el pago automático. NULL = principal. */
  cuenta_id: string | null
  color: string | null
  notas: string | null
  /** Agrupación visual de suscripciones: entretenimiento, software, … */
  grupo: CategoriaSuscripcion | null
  /** Si se define, se aparta este monto por quincena en vez del cálculo automático. */
  apartado_quincenal: number | null
  created_at: string
  categories?: Category
  /** Fondo de ahorro asociado (toda frecuencia salvo quincenal). Embebido vía savings_goal_id. */
  fondo?: Pick<SavingsGoal, 'id' | 'monto_actual' | 'monto_objetivo'> | null
}

export interface CashEntry {
  id: string
  user_id: string
  tipo: 'entrada' | 'salida'
  monto: number
  descripcion: string
  fecha: string
  cuenta_id: string | null
  notas: string | null
  created_at: string
}

export type FrecuenciaSuscripcion = 'semanal' | 'mensual' | 'trimestral' | 'anual'
export type CategoriaSuscripcion = 'entretenimiento' | 'software' | 'educacion' | 'productividad' | 'gaming' | 'otro'
export type EstadoSuscripcion = 'activa' | 'pausada' | 'cancelada'

/**
 * @deprecated Desde la migración 031 las suscripciones viven en `fixed_expenses`;
 * desde 032 son, simplemente, las de `frecuencia <> 'quincenal'`. Este tipo solo
 * describe la tabla de respaldo.
 */
export interface Subscription {
  id: string
  user_id: string
  nombre: string
  monto: number
  frecuencia: FrecuenciaSuscripcion
  fecha_renovacion: string | null
  categoria: CategoriaSuscripcion
  estado: EstadoSuscripcion
  notas: string | null
  color: string | null
  created_at: string
}

export type TipoDeuda = 'deuda' | 'prestamo'
export type EstadoDeuda = 'activa' | 'pagada' | 'cancelada'

export interface Deuda {
  id: string
  user_id: string
  tipo: TipoDeuda
  nombre_persona: string
  descripcion: string | null
  monto_total: number
  monto_pagado: number
  fecha_inicio: string
  fecha_vencimiento: string | null
  estado: EstadoDeuda
  notas: string | null
  created_at: string
  updated_at: string
}

export interface DeudaPago {
  id: string
  user_id: string
  deuda_id: string
  monto: number
  fecha: string
  notas: string | null
  created_at: string
}

export type CooperativaTipo = 'aportaciones' | 'retirable'
export type CooperativaMovimientoTipo = 'deposito' | 'retiro' | 'interes' | 'transferencia_quincena' | 'ajuste'

export interface CooperativaCuenta {
  id: string
  user_id: string
  tipo: CooperativaTipo
  saldo: number
  ultima_aplicacion_intereses: string
  created_at: string
  updated_at: string
}

export interface CooperativaMovimiento {
  id: string
  user_id: string
  cuenta_id: string
  tipo: CooperativaMovimientoTipo
  monto: number
  fecha: string
  descripcion: string | null
  income_entry_id: string | null
  mes_aplicado: string | null
  created_at: string
}

export interface BudgetWithSpent extends Budget {
  gastado: number
  restante: number
  porcentaje: number
}

export interface DashboardData {
  saldo_total: number
  ingresos_mes: number
  gastos_mes: number
  ahorro_mes: number
  recent_transactions: RecentTransaction[]
  savings_goals: SavingsGoal[]
}

export interface RecentTransaction {
  id: string
  tipo: 'ingreso' | 'gasto'
  monto: number
  descripcion: string
  fecha: string
  categoria: string
  color: string
}
