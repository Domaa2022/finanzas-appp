import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReportesClientPage from './ReportesClientPage'
import { getCurrentMonth, getMonthRange } from '@/lib/utils/dates'
import { format, subMonths, startOfMonth } from 'date-fns'

export default async function ReportesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { mes, anio } = getCurrentMonth()
  const { start, end } = getMonthRange(mes, anio)

  // El período más largo seleccionable en esta página es "Último año" (12
  // meses), así que no hace falta traer el historial completo del usuario.
  const windowStart = format(startOfMonth(subMonths(new Date(anio, mes - 1, 1), 11)), 'yyyy-MM-dd')

  const [incomesRes, expensesRes, allocationsRes] = await Promise.all([
    supabase
      .from('income_entries')
      .select('monto, fecha')
      .eq('user_id', user.id)
      .gte('fecha', windowStart),
    supabase
      .from('expenses')
      .select('monto, fecha, category_id, categories(nombre, color)')
      .eq('user_id', user.id)
      .gte('fecha', windowStart),
    supabase
      .from('savings_allocations')
      .select('monto, fecha')
      .eq('user_id', user.id)
      .gte('fecha', windowStart),
  ])

  return (
    <ReportesClientPage
      incomes={incomesRes.data || []}
      expenses={expensesRes.data || []}
      allocations={allocationsRes.data || []}
      currentMes={mes}
      currentAnio={anio}
    />
  )
}
