import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GastosFijosClientPage from './GastosFijosClientPage'

export default async function GastosFijosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [fixedRes, categoriesRes] = await Promise.all([
    // Solo quincenales: se cobran directo con cada quincena, sin fondo. Todo lo
    // que aparta dinero (mensual, anual, variable, …) se administra en
    // /suscripciones.
    supabase
      .from('fixed_expenses')
      .select('*, categories(*)')
      .eq('user_id', user.id)
      .eq('frecuencia', 'quincenal')
      .order('created_at', { ascending: true }),
    supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('nombre'),
  ])

  return (
    <GastosFijosClientPage
      initialFixed={fixedRes.data || []}
      categories={categoriesRes.data || []}
    />
  )
}
