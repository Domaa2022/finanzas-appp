import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PresupuestosClientPage from './PresupuestosClientPage'
import { getCurrentMonth, getMonthRange } from '@/lib/utils/dates'
import { BudgetWithSpent } from '@/lib/types/database'
import { calcularPorcentaje } from '@/lib/utils/calculations'

export default async function PresupuestosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { mes, anio } = getCurrentMonth()
  const { start, end } = getMonthRange(mes, anio)

  const [budgetsRes, expensesRes, categoriesRes] = await Promise.all([
    supabase
      .from('budgets')
      .select('*, categories(*)')
      .eq('user_id', user.id)
      .eq('mes', mes)
      .eq('anio', anio),
    supabase
      .from('expenses')
      .select('category_id, monto')
      .eq('user_id', user.id)
      .gte('fecha', start)
      .lte('fecha', end),
    supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .eq('tipo', 'gasto')
      .eq('is_active', true)
      .order('nombre'),
  ])

  // Calcular gastos por categoría
  const gastoPorCategoria: Record<string, number> = {}
  for (const expense of (expensesRes.data || [])) {
    gastoPorCategoria[expense.category_id] = (gastoPorCategoria[expense.category_id] || 0) + expense.monto
  }

  const budgetsWithSpent: BudgetWithSpent[] = (budgetsRes.data || []).map(b => {
    const gastado = gastoPorCategoria[b.category_id] || 0
    const porcentaje = calcularPorcentaje(gastado, b.limite_mensual)
    return {
      ...b,
      gastado,
      restante: b.limite_mensual - gastado,
      porcentaje,
    }
  })

  return (
    <PresupuestosClientPage
      budgets={budgetsWithSpent}
      categories={categoriesRes.data || []}
      mes={mes}
      anio={anio}
      userId={user.id}
    />
  )
}
