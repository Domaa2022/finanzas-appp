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

export interface IncomeEntry {
  id: string
  user_id: string
  monto: number
  fuente: string
  frecuencia: Frecuencia
  fecha: string
  category_id: string | null
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
  created_at: string
}

export type FrecuenciaGastoFijo = 'quincenal' | 'mensual'

export interface FixedExpense {
  id: string
  user_id: string
  nombre: string
  monto: number
  category_id: string | null
  activo: boolean
  frecuencia: FrecuenciaGastoFijo
  dia_pago: number | null
  savings_goal_id: string | null
  created_at: string
  categories?: Category
  /** Fondo de ahorro asociado (solo gastos mensuales). Embebido vía savings_goal_id. */
  fondo?: Pick<SavingsGoal, 'id' | 'monto_actual' | 'monto_objetivo'> | null
}

export interface CashEntry {
  id: string
  user_id: string
  tipo: 'entrada' | 'salida'
  monto: number
  descripcion: string
  fecha: string
  notas: string | null
  created_at: string
}

export type FrecuenciaSuscripcion = 'semanal' | 'mensual' | 'trimestral' | 'anual'
export type CategoriaSuscripcion = 'entretenimiento' | 'software' | 'educacion' | 'productividad' | 'gaming' | 'otro'
export type EstadoSuscripcion = 'activa' | 'pausada' | 'cancelada'

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
