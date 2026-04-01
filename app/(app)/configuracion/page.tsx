import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ConfiguracionClientPage from './ConfiguracionClientPage'

export default async function ConfiguracionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return <ConfiguracionClientPage profile={profile} userId={user.id} />
}
