import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GastosClientPage from './GastosClientPage'
import { getCurrentMonth, getMonthRange } from '@/lib/utils/dates'

export default async function GastosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // El filtro por defecto de la página es "Este mes", así que la carga
  // inicial solo trae ese rango. Otros períodos se piden bajo demanda desde
  // el cliente (ver GastosClientPage) en vez de traer siempre todo el
  // historial de gastos del usuario.
  const { mes, anio } = getCurrentMonth()
  const { start, end } = getMonthRange(mes, anio)

  const [expensesRes, categoriesRes] = await Promise.all([
    supabase
      .from('expenses')
      .select('*, categories(*)')
      .eq('user_id', user.id)
      .gte('fecha', start)
      .lte('fecha', end)
      .order('fecha', { ascending: false }),
    supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('nombre'),
  ])

  return (
    <GastosClientPage
      initialExpenses={expensesRes.data || []}
      categories={categoriesRes.data || []}
    />
  )
}
