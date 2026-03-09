import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AhorrosClientPage from './AhorrosClientPage'

export default async function AhorrosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [goalsRes, allocationsRes] = await Promise.all([
    supabase
      .from('savings_goals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('savings_allocations')
      .select('*')
      .eq('user_id', user.id)
      .order('fecha', { ascending: false }),
  ])

  return (
    <AhorrosClientPage
      initialGoals={goalsRes.data || []}
      allocations={allocationsRes.data || []}
    />
  )
}
