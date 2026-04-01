import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EfectivoClientPage from './EfectivoClientPage'

export default async function EfectivoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase
    .from('cash_entries')
    .select('*')
    .eq('user_id', user.id)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })

  return <EfectivoClientPage initialEntries={data || []} />
}
