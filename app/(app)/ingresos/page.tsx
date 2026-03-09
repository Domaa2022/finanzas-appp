import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import IngresoClientPage from './IngresoClientPage'

export default async function IngresoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const incomesRes = await supabase
    .from('income_entries')
    .select('*')
    .eq('user_id', user.id)
    .order('fecha', { ascending: false })

  return <IngresoClientPage initialIncomes={incomesRes.data || []} />
}
