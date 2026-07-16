import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import IngresoClientPage from './IngresoClientPage'
import { getCurrentMonth, getMonthRange } from '@/lib/utils/dates'

export default async function IngresoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Carga inicial acotada a "Este mes" (el filtro por defecto del cliente).
  // Otros períodos se piden bajo demanda desde el navegador en vez de traer
  // siempre todo el historial de ingresos.
  const { mes, anio } = getCurrentMonth()
  const { start, end } = getMonthRange(mes, anio)

  const incomesRes = await supabase
    .from('income_entries')
    .select('*')
    .eq('user_id', user.id)
    .gte('fecha', start)
    .lte('fecha', end)
    .order('fecha', { ascending: false })

  return <IngresoClientPage initialIncomes={incomesRes.data || []} />
}
