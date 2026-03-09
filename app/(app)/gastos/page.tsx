import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GastosClientPage from './GastosClientPage'

export default async function GastosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [expensesRes, categoriesRes] = await Promise.all([
    supabase
      .from('expenses')
      .select('*, categories(*)')
      .eq('user_id', user.id)
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
