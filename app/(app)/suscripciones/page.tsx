import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SuscripcionesClientPage from './SuscripcionesClientPage'

export default async function SuscripcionesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Aquí vive todo gasto fijo que NO es quincenal: mensuales, anuales,
  // trimestrales, semanales y los de fecha variable. Todos comparten el mismo
  // mecanismo — `fondo` es el ahorro que se aparta cada quincena para cubrirlos
  // y de ahí sale el cobro cuando llega proximo_pago. Los quincenales, que se
  // cobran directo sin fondo, se administran en /gastos-fijos.
  const [subsRes, categoriasRes] = await Promise.all([
    supabase
      .from('fixed_expenses')
      .select('*, categories(*), fondo:savings_goals!fixed_expenses_savings_goal_id_fkey(id, monto_actual, monto_objetivo)')
      .eq('user_id', user.id)
      .neq('frecuencia', 'quincenal')
      .order('proximo_pago', { ascending: true, nullsFirst: false }),
    supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .eq('tipo', 'gasto')
      .eq('is_active', true)
      .order('nombre'),
  ])

  return (
    <SuscripcionesClientPage
      initialSubs={subsRes.data || []}
      categorias={categoriasRes.data || []}
    />
  )
}
