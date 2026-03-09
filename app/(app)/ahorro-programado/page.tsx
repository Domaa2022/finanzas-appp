import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AhorroProgramadoClientPage from './AhorroProgramadoClientPage'

export default async function AhorroProgramadoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Traemos los programados y el último ingreso para preview de montos
  const [scheduledRes, lastIncomeRes] = await Promise.all([
    supabase
      .from('scheduled_savings')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('income_entries')
      .select('monto')
      .eq('user_id', user.id)
      .order('fecha', { ascending: false })
      .limit(1)
      .single(),
  ])

  return (
    <AhorroProgramadoClientPage
      initialScheduled={scheduledRes.data || []}
      ultimoIngreso={lastIncomeRes.data?.monto ?? null}
    />
  )
}
