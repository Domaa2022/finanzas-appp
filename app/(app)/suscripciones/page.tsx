import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SuscripcionesClientPage from './SuscripcionesClientPage'

export default async function SuscripcionesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  return <SuscripcionesClientPage initialSubs={data || []} />
}
