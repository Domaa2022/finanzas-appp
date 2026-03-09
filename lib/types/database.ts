export type Frecuencia = 'diario' | 'semanal' | 'quincenal' | 'mensual'
export type AhorroTipo = 'porcentaje' | 'fijo' | 'ninguno'
export type EstadoMeta = 'activa' | 'completada' | 'pausada'
export type TipoCategoria = 'gasto' | 'ingreso'

export interface Profile {
  id: string
  nombre: string
  email: string
  default_savings_pct: number
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
  created_at: string
  updated_at: string
}

export interface SavingsAllocation {
  id: string
  user_id: string
  income_entry_id: string
  savings_goal_id: string
  monto: number
  fecha: string
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

export interface FixedExpense {
  id: string
  user_id: string
  nombre: string
  monto: number
  category_id: string | null
  activo: boolean
  created_at: string
  categories?: Category
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
