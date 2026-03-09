import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReportesClientPage from './ReportesClientPage'
import { getCurrentMonth, getMonthRange } from '@/lib/utils/dates'

export default async function ReportesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { mes, anio } = getCurrentMonth()
  const { start, end } = getMonthRange(mes, anio)

  const [incomesRes, expensesRes, allocationsRes] = await Promise.all([
    supabase
      .from('income_entries')
      .select('monto, fecha')
      .eq('user_id', user.id),
    supabase
      .from('expenses')
      .select('monto, fecha, category_id, categories(nombre, color)')
      .eq('user_id', user.id),
    supabase
      .from('savings_allocations')
      .select('monto, fecha')
      .eq('user_id', user.id),
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
